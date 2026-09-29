import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { itemDefinition, itemDefinitions, inventoryCapacityForCharacter } from './inventory.js';
import { locationDefinition } from './locations.js';
import { adminAccount, adminCharacter } from './adminAccess.js';
import {
  isRotation,
  validatePlacement,
  type Placement,
  type Rotation,
} from '../shared/roomGeometry.js';
import type {
  CropDefinition,
  FurnitureDefinition,
  RoomSnapshot,
  RoomSummary,
} from '../shared/roomTypes.js';

type Failure = { error: string; message: string; status: number };
type CharacterRow = { id: string; current_location: string };
type RoomRow = {
  id: string;
  name: string;
  owner_character_id: string;
  location_id: string;
  width: number;
  depth: number;
  revision: number;
};
type ItemRow = {
  id: string;
  definition_id: string;
  quantity: number;
  location: string;
  equipped: number;
};
type PlacementRow = {
  item_id: string;
  definition_id: string;
  x: number;
  y: number;
  rotation: Rotation;
};

const unavailable = (): Failure => ({
  error: 'ROOM_UNAVAILABLE',
  message: 'This room is unavailable at your current location.',
  status: 404,
});
const invalid = (): Failure => ({
  error: 'VALIDATION_ERROR',
  message: 'Provide a valid item, grid position, rotation, revision and request key.',
  status: 400,
});
const character = (database: DatabaseSync, accountId: string): CharacterRow | undefined =>
  database
    .prepare('SELECT id, current_location FROM characters WHERE account_id = ?')
    .get(accountId) as CharacterRow | undefined;
const roomAtHost = (
  database: DatabaseSync,
  accountId: string,
  roomId: string,
): RoomRow | undefined => {
  const owner = character(database, accountId);
  if (!owner) return undefined;
  return database
    .prepare('SELECT * FROM rooms WHERE id = ? AND owner_character_id = ? AND location_id = ?')
    .get(roomId, owner.id, owner.current_location) as RoomRow | undefined;
};
const definitions = (): FurnitureDefinition[] =>
  itemDefinitions().flatMap((item) =>
    item.furniture ? [{ id: item.id, name: item.name, ...item.furniture }] : [],
  );
const cropDefinitions = (): CropDefinition[] =>
  itemDefinitions().flatMap((item) =>
    item.crop ? [{ id: item.id, name: item.name, ...item.crop }] : [],
  );
const placements = (database: DatabaseSync, roomId: string): PlacementRow[] =>
  database
    .prepare(
      `SELECT p.item_id, i.definition_id, p.x, p.y, p.rotation FROM room_placements p
   JOIN character_items i ON i.id = p.item_id WHERE p.room_id = ? ORDER BY p.item_id`,
    )
    .all(roomId) as unknown as PlacementRow[];
const summary = (room: RoomRow): RoomSummary => ({
  id: room.id,
  name: room.name,
  locationId: room.location_id,
  width: room.width,
  depth: room.depth,
  revision: room.revision,
});

function buildSnapshot(database: DatabaseSync, room: RoomRow, environment?: string): RoomSnapshot {
  const placed = placements(database, room.id);
  const carried = database
    .prepare(
      "SELECT id, definition_id FROM character_items WHERE character_id = ? AND location = 'inventory' ORDER BY sort_index IS NULL, sort_index, created_at, id",
    )
    .all(room.owner_character_id) as unknown as Array<{ id: string; definition_id: string }>;
  const usedSlots = carried.length;
  const furniture = definitions();
  const cropCatalog = cropDefinitions();
  const canBuild = adminCharacter(database, room.owner_character_id, environment);
  const crops = database
    .prepare(
      'SELECT c.item_id, i.definition_id, c.bed_item_id, c.x, c.y FROM room_crops c JOIN character_items i ON i.id = c.item_id WHERE c.room_id = ? ORDER BY c.bed_item_id, c.y, c.x',
    )
    .all(room.id) as unknown as Array<{
    item_id: string;
    definition_id: string;
    bed_item_id: string;
    x: number;
    y: number;
  }>;
  return {
    room: summary(room),
    definitions: furniture,
    buildCatalog: canBuild ? furniture : [],
    cropCatalog: canBuild ? cropCatalog : [],
    placements: placed.map((row) => ({
      itemId: row.item_id,
      x: row.x,
      y: row.y,
      rotation: row.rotation,
    })),
    crops: crops.map((row) => ({
      itemId: row.item_id,
      definitionId: row.definition_id,
      name: itemDefinition(row.definition_id)?.name ?? row.definition_id,
      bedItemId: row.bed_item_id,
      x: row.x,
      y: row.y,
      width: itemDefinition(row.definition_id)?.crop?.width ?? 1,
      depth: itemDefinition(row.definition_id)?.crop?.depth ?? 1,
    })),
    placedItems: placed.map((row) => ({
      instanceId: row.item_id,
      definitionId: row.definition_id,
      name: itemDefinition(row.definition_id)?.name ?? row.definition_id,
    })),
    carriedInventory: {
      capacity: inventoryCapacityForCharacter(database, room.owner_character_id, environment),
      usedSlots,
      items: carried.map((row) => ({
        instanceId: row.id,
        definitionId: row.definition_id,
        name: itemDefinition(row.definition_id)?.name ?? row.definition_id,
      })),
    },
  };
}

export function roomSummaries(database: DatabaseSync, accountId: string): RoomSummary[] {
  const owner = character(database, accountId);
  if (!owner) return [];
  return (
    database
      .prepare(
        'SELECT * FROM rooms WHERE owner_character_id = ? AND location_id = ? ORDER BY created_at, id',
      )
      .all(owner.id, owner.current_location) as unknown as RoomRow[]
  ).map(summary);
}

export function roomSnapshot(
  database: DatabaseSync,
  accountId: string,
  roomId: string,
  environment?: string,
): RoomSnapshot | Failure {
  database.exec('BEGIN');
  try {
    const room = roomAtHost(database, accountId, roomId);
    const result = room ? buildSnapshot(database, room, environment) : unavailable();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function provisionRoomFixture(
  database: DatabaseSync,
  accountId: string,
  environment?: string,
): RoomSnapshot | Failure {
  database.exec('BEGIN IMMEDIATE');
  try {
    const owner = character(database, accountId);
    if (!owner || !locationDefinition(owner.current_location)) {
      database.exec('ROLLBACK');
      return unavailable();
    }
    const existing = database
      .prepare('SELECT * FROM rooms WHERE owner_character_id = ? AND location_id = ? AND name = ?')
      .get(owner.id, owner.current_location, 'Placement test room') as RoomRow | undefined;
    if (existing) {
      const hasFarmBed = database
        .prepare('SELECT 1 FROM character_items WHERE character_id = ? AND definition_id = ?')
        .get(owner.id, 'fixture_farm_bed');
      if (!hasFarmBed) {
        const count = (
          database
            .prepare(
              "SELECT count(*) AS n FROM character_items WHERE character_id = ? AND location = 'inventory'",
            )
            .get(owner.id) as { n: number }
        ).n;
        if (count >= inventoryCapacityForCharacter(database, owner.id, environment)) {
          database.exec('ROLLBACK');
          return {
            error: 'INVENTORY_FULL',
            message: 'Free one carried slot before adding the temporary farm bed fixture.',
            status: 400,
          };
        }
        const now = new Date().toISOString();
        database
          .prepare(
            "INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, 'fixture_farm_bed', 1, 'inventory', 0, ?, ?)",
          )
          .run(randomUUID(), owner.id, now, now);
      }
      const result = buildSnapshot(database, existing, environment);
      database.exec('COMMIT');
      return result;
    }
    const count = (
      database
        .prepare(
          "SELECT count(*) AS n FROM character_items WHERE character_id = ? AND location = 'inventory'",
        )
        .get(owner.id) as { n: number }
    ).n;
    if (count + 4 > inventoryCapacityForCharacter(database, owner.id, environment)) {
      database.exec('ROLLBACK');
      return {
        error: 'INVENTORY_FULL',
        message: 'Free four carried slots before creating a test room.',
        status: 400,
      };
    }
    const now = new Date().toISOString();
    const roomId = randomUUID();
    database
      .prepare(
        'INSERT INTO rooms (id, owner_character_id, name, location_id, width, depth, revision, created_at, updated_at) VALUES (?, ?, ?, ?, 8, 8, 0, ?, ?)',
      )
      .run(roomId, owner.id, 'Placement test room', owner.current_location, now, now);
    for (const id of ['fixture_chair', 'fixture_bench', 'fixture_table', 'fixture_farm_bed'])
      database
        .prepare(
          "INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, 1, 'inventory', 0, ?, ?)",
        )
        .run(randomUUID(), owner.id, id, now, now);
    const room = roomAtHost(database, accountId, roomId)!;
    const result = buildSnapshot(database, room, environment);
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function roomCommand(
  database: DatabaseSync,
  accountId: string,
  roomId: string,
  action: 'place' | 'move' | 'remove',
  body: Record<string, unknown> | null,
  environment?: string,
): RoomSnapshot | Failure {
  if (
    !body ||
    typeof body.itemId !== 'string' ||
    body.itemId.length < 1 ||
    body.itemId.length > 128 ||
    (action !== 'remove' &&
      (!Number.isSafeInteger(body.x) ||
        !Number.isSafeInteger(body.y) ||
        !isRotation(body.rotation))) ||
    !Number.isSafeInteger(body.expectedRevision) ||
    (body.expectedRevision as number) < 0 ||
    typeof body.requestKey !== 'string' ||
    body.requestKey.length < 1 ||
    body.requestKey.length > 128
  )
    return invalid();
  const itemId = body.itemId as string;
  const x = body.x as number;
  const y = body.y as number;
  const rotation = body.rotation as Rotation;
  const expectedRevision = body.expectedRevision as number;
  const requestKey = body.requestKey as string;
  const signature = JSON.stringify({ action, roomId, itemId, x, y, rotation, expectedRevision });
  database.exec('BEGIN IMMEDIATE');
  try {
    const room = roomAtHost(database, accountId, roomId);
    const owner = character(database, accountId);
    if (!room || !owner) {
      database.exec('ROLLBACK');
      return unavailable();
    }
    const receipt = database
      .prepare(
        'SELECT signature, applied_revision FROM room_commands WHERE character_id = ? AND request_key = ?',
      )
      .get(owner.id, requestKey) as { signature: string; applied_revision: number } | undefined;
    if (receipt) {
      if (receipt.signature !== signature) {
        database.exec('ROLLBACK');
        return {
          error: 'REQUEST_KEY_REUSED',
          message: 'This request key belongs to another action.',
          status: 409,
        };
      }
      const result = buildSnapshot(database, room, environment);
      result.command = { requestKey, appliedRevision: receipt.applied_revision };
      database.exec('COMMIT');
      return result;
    }
    if (room.revision !== expectedRevision) {
      database.exec('ROLLBACK');
      return {
        error: 'ROOM_CHANGED',
        message: 'The room changed. Refresh and try again.',
        status: 409,
      };
    }
    const item = database
      .prepare(
        'SELECT id, definition_id, quantity, location, equipped FROM character_items WHERE id = ? AND character_id = ?',
      )
      .get(itemId, owner.id) as ItemRow | undefined;
    const furniture = item && itemDefinition(item.definition_id)?.furniture;
    const alreadyPlaced = database
      .prepare('SELECT room_id FROM room_placements WHERE item_id = ?')
      .get(itemId) as { room_id: string } | undefined;
    if (
      !item ||
      !furniture ||
      item.quantity !== 1 ||
      item.equipped ||
      (action === 'place'
        ? item.location !== 'inventory' || alreadyPlaced
        : item.location !== 'room' || alreadyPlaced?.room_id !== roomId)
    ) {
      database.exec('ROLLBACK');
      return {
        error: 'ITEM_NOT_AVAILABLE',
        message: 'That furniture instance is not available here.',
        status: 400,
      };
    }
    if (
      action === 'remove' &&
      database
        .prepare('SELECT 1 FROM room_crops WHERE room_id = ? AND bed_item_id = ?')
        .get(roomId, itemId)
    ) {
      database.exec('ROLLBACK');
      return {
        error: 'FARM_BED_HAS_CROPS',
        message: 'Remove the crops before returning this farming bed.',
        status: 400,
      };
    }
    if (action === 'remove') {
      const carriedCount = (
        database
          .prepare(
            "SELECT count(*) AS n FROM character_items WHERE character_id = ? AND location = 'inventory'",
          )
          .get(owner.id) as { n: number }
      ).n;
      if (carriedCount >= inventoryCapacityForCharacter(database, owner.id, environment)) {
        database.exec('ROLLBACK');
        return {
          error: 'INVENTORY_FULL',
          message: 'Free one carried slot before returning this furniture to inventory.',
          status: 400,
        };
      }
      database
        .prepare('DELETE FROM room_placements WHERE item_id = ? AND room_id = ?')
        .run(itemId, roomId);
      database
        .prepare("UPDATE character_items SET location = 'inventory', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), itemId);
      const now = new Date().toISOString();
      database
        .prepare('UPDATE rooms SET revision = revision + 1, updated_at = ? WHERE id = ?')
        .run(now, roomId);
      database
        .prepare(
          'INSERT INTO room_commands (character_id, request_key, signature, room_id, applied_revision, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(owner.id, requestKey, signature, roomId, room.revision + 1, now);
      const updated = roomAtHost(database, accountId, roomId)!;
      const result = buildSnapshot(database, updated, environment);
      result.command = { requestKey, appliedRevision: updated.revision };
      database.exec('COMMIT');
      return result;
    }
    const candidate: Placement = { itemId, x, y, rotation };
    const existing = placements(database, roomId).map((row) => ({
      placement: { itemId: row.item_id, x: row.x, y: row.y, rotation: row.rotation },
      size: itemDefinition(row.definition_id)!.furniture!,
    }));
    const problem = validatePlacement(
      room,
      candidate,
      furniture,
      existing,
      action === 'move' ? itemId : undefined,
    );
    if (problem) {
      database.exec('ROLLBACK');
      return {
        error: problem,
        message:
          problem === 'SPACE_OCCUPIED'
            ? 'Another object occupies those cells.'
            : problem === 'OUT_OF_BOUNDS'
              ? 'The object extends beyond the room.'
              : 'The placement is invalid.',
        status: 400,
      };
    }
    const now = new Date().toISOString();
    if (action === 'place') {
      database
        .prepare(
          "UPDATE character_items SET location = 'room', sort_index = NULL, updated_at = ? WHERE id = ?",
        )
        .run(now, itemId);
      database
        .prepare(
          'INSERT INTO room_placements (item_id, room_id, x, y, rotation) VALUES (?, ?, ?, ?, ?)',
        )
        .run(itemId, roomId, x, y, rotation);
    } else
      database
        .prepare(
          'UPDATE room_placements SET x = ?, y = ?, rotation = ? WHERE item_id = ? AND room_id = ?',
        )
        .run(x, y, rotation, itemId, roomId);
    database
      .prepare('UPDATE rooms SET revision = revision + 1, updated_at = ? WHERE id = ?')
      .run(now, roomId);
    database
      .prepare(
        'INSERT INTO room_commands (character_id, request_key, signature, room_id, applied_revision, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(owner.id, requestKey, signature, roomId, room.revision + 1, now);
    const updated = roomAtHost(database, accountId, roomId)!;
    const result = buildSnapshot(database, updated, environment);
    result.command = { requestKey, appliedRevision: updated.revision };
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function buildRoomItem(
  database: DatabaseSync,
  accountId: string,
  roomId: string,
  body: Record<string, unknown> | null,
  environment?: string,
): RoomSnapshot | Failure {
  if (
    !body ||
    typeof body.definitionId !== 'string' ||
    body.definitionId.length < 1 ||
    body.definitionId.length > 128 ||
    !Number.isSafeInteger(body.expectedRevision) ||
    (body.expectedRevision as number) < 0 ||
    typeof body.requestKey !== 'string' ||
    body.requestKey.length < 1 ||
    body.requestKey.length > 128
  )
    return invalid();
  const definitionId = body.definitionId;
  const expectedRevision = body.expectedRevision as number;
  const requestKey = body.requestKey;
  const signature = JSON.stringify({ action: 'build', roomId, definitionId, expectedRevision });
  database.exec('BEGIN IMMEDIATE');
  try {
    const room = roomAtHost(database, accountId, roomId);
    const owner = character(database, accountId);
    if (!room || !owner) {
      database.exec('ROLLBACK');
      return unavailable();
    }
    if (!adminAccount(database, accountId, environment)) {
      database.exec('ROLLBACK');
      return {
        error: 'ADMIN_REQUIRED',
        message: 'Developer authorization is required.',
        status: 403,
      };
    }
    const receipt = database
      .prepare(
        'SELECT signature, applied_revision FROM room_commands WHERE character_id = ? AND request_key = ?',
      )
      .get(owner.id, requestKey) as { signature: string; applied_revision: number } | undefined;
    if (receipt) {
      if (receipt.signature !== signature) {
        database.exec('ROLLBACK');
        return {
          error: 'REQUEST_KEY_REUSED',
          message: 'This request key belongs to another action.',
          status: 409,
        };
      }
      const result = buildSnapshot(database, room, environment);
      result.command = { requestKey, appliedRevision: receipt.applied_revision };
      database.exec('COMMIT');
      return result;
    }
    if (room.revision !== expectedRevision) {
      database.exec('ROLLBACK');
      return {
        error: 'ROOM_CHANGED',
        message: 'The room changed. Refresh and try again.',
        status: 409,
      };
    }
    const item = itemDefinition(definitionId);
    if (!item?.furniture && !item?.crop) {
      database.exec('ROLLBACK');
      return {
        error: 'ITEM_NOT_BUILDABLE',
        message: 'That item cannot be built in this room.',
        status: 400,
      };
    }
    const carriedCount = (
      database
        .prepare(
          "SELECT count(*) AS n FROM character_items WHERE character_id = ? AND location = 'inventory'",
        )
        .get(owner.id) as { n: number }
    ).n;
    if (carriedCount >= inventoryCapacityForCharacter(database, owner.id, environment)) {
      database.exec('ROLLBACK');
      return {
        error: 'INVENTORY_FULL',
        message: 'Free one carried slot before building furniture.',
        status: 400,
      };
    }
    const now = new Date().toISOString();
    const itemId = randomUUID();
    database
      .prepare(
        "INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, 1, 'inventory', 0, ?, ?)",
      )
      .run(itemId, owner.id, definitionId, now, now);
    database
      .prepare('UPDATE rooms SET revision = revision + 1, updated_at = ? WHERE id = ?')
      .run(now, roomId);
    database
      .prepare(
        'INSERT INTO room_commands (character_id, request_key, signature, room_id, applied_revision, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(owner.id, requestKey, signature, roomId, room.revision + 1, now);
    const updated = roomAtHost(database, accountId, roomId)!;
    const result = buildSnapshot(database, updated, environment);
    result.command = { requestKey, appliedRevision: updated.revision };
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function placeRoomCrop(
  database: DatabaseSync,
  accountId: string,
  roomId: string,
  body: Record<string, unknown> | null,
  environment?: string,
): RoomSnapshot | Failure {
  if (
    !body ||
    typeof body.itemId !== 'string' ||
    typeof body.bedItemId !== 'string' ||
    !Number.isSafeInteger(body.x) ||
    !Number.isSafeInteger(body.y) ||
    (body.x as number) < 0 ||
    (body.x as number) > 1 ||
    (body.y as number) < 0 ||
    (body.y as number) > 1 ||
    !Number.isSafeInteger(body.expectedRevision) ||
    (body.expectedRevision as number) < 0 ||
    typeof body.requestKey !== 'string' ||
    body.requestKey.length < 1 ||
    body.requestKey.length > 128
  )
    return invalid();
  const { itemId, bedItemId } = body as { itemId: string; bedItemId: string };
  const x = body.x as number;
  const y = body.y as number;
  const expectedRevision = body.expectedRevision as number;
  const requestKey = body.requestKey;
  const signature = JSON.stringify({
    action: 'crop-place',
    roomId,
    itemId,
    bedItemId,
    x,
    y,
    expectedRevision,
  });
  database.exec('BEGIN IMMEDIATE');
  try {
    const room = roomAtHost(database, accountId, roomId);
    const owner = character(database, accountId);
    if (!room || !owner) {
      database.exec('ROLLBACK');
      return unavailable();
    }
    const receipt = database
      .prepare(
        'SELECT signature, applied_revision FROM room_commands WHERE character_id = ? AND request_key = ?',
      )
      .get(owner.id, requestKey) as { signature: string; applied_revision: number } | undefined;
    if (receipt) {
      if (receipt.signature !== signature) {
        database.exec('ROLLBACK');
        return {
          error: 'REQUEST_KEY_REUSED',
          message: 'This request key belongs to another action.',
          status: 409,
        };
      }
      const result = buildSnapshot(database, room, environment);
      result.command = { requestKey, appliedRevision: receipt.applied_revision };
      database.exec('COMMIT');
      return result;
    }
    if (room.revision !== expectedRevision) {
      database.exec('ROLLBACK');
      return {
        error: 'ROOM_CHANGED',
        message: 'The room changed. Refresh and try again.',
        status: 409,
      };
    }
    const crop = database
      .prepare(
        "SELECT definition_id FROM character_items WHERE id = ? AND character_id = ? AND location = 'inventory'",
      )
      .get(itemId, owner.id) as { definition_id: string } | undefined;
    const bed = database
      .prepare(
        `SELECT i.definition_id FROM room_placements p JOIN character_items i ON i.id = p.item_id WHERE p.item_id = ? AND p.room_id = ?`,
      )
      .get(bedItemId, roomId) as { definition_id: string } | undefined;
    const cropSize = crop && itemDefinition(crop.definition_id)?.crop;
    if (
      !crop ||
      !cropSize ||
      !bed ||
      itemDefinition(bed.definition_id)?.furniture?.artworkKey !== 'temporary_farm_bed'
    ) {
      database.exec('ROLLBACK');
      return {
        error: 'CROP_NOT_AVAILABLE',
        message: 'Choose a carried crop and a placed farming bed.',
        status: 400,
      };
    }
    if ((cropSize.width === 2 || cropSize.depth === 2) && (x !== 0 || y !== 0)) {
      database.exec('ROLLBACK');
      return {
        error: 'CROP_NOT_AVAILABLE',
        message: 'A full-bed crop must be centered on the farming bed.',
        status: 400,
      };
    }
    const existingCrops = database
      .prepare(
        'SELECT c.x, c.y, i.definition_id FROM room_crops c JOIN character_items i ON i.id = c.item_id WHERE c.room_id = ? AND c.bed_item_id = ?',
      )
      .all(roomId, bedItemId) as unknown as Array<{ x: number; y: number; definition_id: string }>;
    const collides = existingCrops.some((existing) => {
      const existingSize = itemDefinition(existing.definition_id)?.crop;
      return Boolean(
        existingSize &&
          x < existing.x + existingSize.width &&
          x + cropSize.width > existing.x &&
          y < existing.y + existingSize.depth &&
          y + cropSize.depth > existing.y,
      );
    });
    if (collides) {
      database.exec('ROLLBACK');
      return {
        error: 'CROP_SPACE_OCCUPIED',
        message: 'That part of the bed already has a crop.',
        status: 400,
      };
    }
    const now = new Date().toISOString();
    try {
      database
        .prepare(
          "UPDATE character_items SET location = 'room', sort_index = NULL, updated_at = ? WHERE id = ?",
        )
        .run(now, itemId);
      database
        .prepare(
          'INSERT INTO room_crops (item_id, room_id, bed_item_id, x, y) VALUES (?, ?, ?, ?, ?)',
        )
        .run(itemId, roomId, bedItemId, x, y);
    } catch {
      database.exec('ROLLBACK');
      return {
        error: 'CROP_SPACE_OCCUPIED',
        message: 'That square already has a crop.',
        status: 400,
      };
    }
    database
      .prepare('UPDATE rooms SET revision = revision + 1, updated_at = ? WHERE id = ?')
      .run(now, roomId);
    database
      .prepare(
        'INSERT INTO room_commands (character_id, request_key, signature, room_id, applied_revision, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(owner.id, requestKey, signature, roomId, room.revision + 1, now);
    const result = buildSnapshot(database, roomAtHost(database, accountId, roomId)!, environment);
    result.command = { requestKey, appliedRevision: room.revision + 1 };
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function removeRoomCrop(
  database: DatabaseSync,
  accountId: string,
  roomId: string,
  body: Record<string, unknown> | null,
  environment?: string,
): RoomSnapshot | Failure {
  if (
    !body ||
    typeof body.itemId !== 'string' ||
    !Number.isSafeInteger(body.expectedRevision) ||
    (body.expectedRevision as number) < 0 ||
    typeof body.requestKey !== 'string' ||
    body.requestKey.length < 1 ||
    body.requestKey.length > 128
  )
    return invalid();
  const itemId = body.itemId;
  const expectedRevision = body.expectedRevision as number;
  const requestKey = body.requestKey;
  const signature = JSON.stringify({ action: 'crop-remove', roomId, itemId, expectedRevision });
  database.exec('BEGIN IMMEDIATE');
  try {
    const room = roomAtHost(database, accountId, roomId);
    const owner = character(database, accountId);
    if (!room || !owner) {
      database.exec('ROLLBACK');
      return unavailable();
    }
    const receipt = database
      .prepare(
        'SELECT signature, applied_revision FROM room_commands WHERE character_id = ? AND request_key = ?',
      )
      .get(owner.id, requestKey) as { signature: string; applied_revision: number } | undefined;
    if (receipt) {
      if (receipt.signature !== signature) {
        database.exec('ROLLBACK');
        return {
          error: 'REQUEST_KEY_REUSED',
          message: 'This request key belongs to another action.',
          status: 409,
        };
      }
      const result = buildSnapshot(database, room, environment);
      result.command = { requestKey, appliedRevision: receipt.applied_revision };
      database.exec('COMMIT');
      return result;
    }
    if (room.revision !== expectedRevision) {
      database.exec('ROLLBACK');
      return {
        error: 'ROOM_CHANGED',
        message: 'The room changed. Refresh and try again.',
        status: 409,
      };
    }
    const crop = database
      .prepare('SELECT 1 FROM room_crops WHERE room_id = ? AND item_id = ?')
      .get(roomId, itemId);
    const carriedCount = (
      database
        .prepare(
          "SELECT count(*) AS n FROM character_items WHERE character_id = ? AND location = 'inventory'",
        )
        .get(owner.id) as { n: number }
    ).n;
    if (!crop || carriedCount >= inventoryCapacityForCharacter(database, owner.id, environment)) {
      database.exec('ROLLBACK');
      return {
        error: crop ? 'INVENTORY_FULL' : 'CROP_NOT_AVAILABLE',
        message: crop
          ? 'Free one carried slot before removing this crop.'
          : 'That crop is not in this room.',
        status: 400,
      };
    }
    const now = new Date().toISOString();
    database
      .prepare('DELETE FROM room_crops WHERE room_id = ? AND item_id = ?')
      .run(roomId, itemId);
    database
      .prepare("UPDATE character_items SET location = 'inventory', updated_at = ? WHERE id = ?")
      .run(now, itemId);
    database
      .prepare('UPDATE rooms SET revision = revision + 1, updated_at = ? WHERE id = ?')
      .run(now, roomId);
    database
      .prepare(
        'INSERT INTO room_commands (character_id, request_key, signature, room_id, applied_revision, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(owner.id, requestKey, signature, roomId, room.revision + 1, now);
    const result = buildSnapshot(database, roomAtHost(database, accountId, roomId)!, environment);
    result.command = { requestKey, appliedRevision: room.revision + 1 };
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
