import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import { getCharacter, type Character } from './character.js';
import { isCityLocation } from './locations.js';
import {
  fishSpecimensForStack,
  isFish,
  moveFishSpecimens,
  type FishSpecimen,
} from './fishSpecimens.js';
import { lockerSlotCount } from './inventoryLayout.js';
import { adminAccount, adminCharacter } from './adminAccess.js';

export const INVENTORY_CAPACITY = 10;
export const ADMIN_INVENTORY_CAPACITY = 50;
export const ADMIN_LOCKER_CAPACITY = 50;
export const CITY_LOCKER_LOCATION = 'new-harbor';

type ItemKind = 'consumable' | 'equipment' | 'tool' | 'furniture';
type EquipmentSlot = 'body' | null;
type ItemLocation = 'inventory' | 'locker';

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  kind: ItemKind;
  stackable: boolean;
  maxStack: number;
  equipmentSlot: EquipmentSlot;
  healHp: number;
  artworkPath?: string;
  furniture?: { width: number; depth: number; artworkKey: string };
  crop?: { width: 1 | 2; depth: 1 | 2; artworkKey: string };
}

export interface InventoryItem extends ItemDefinition {
  instanceId: string;
  slotIndex?: number;
  quantity: number;
  location: ItemLocation;
  equipped: boolean;
  specimens?: FishSpecimen[];
}

export interface InventoryState {
  capacity: number;
  lockerCapacity?: number | null;
  usedSlots: number;
  items: InventoryItem[];
  locker: InventoryItem[];
}

export function inventoryCapacity(
  database: DatabaseSync,
  accountId: string,
  environment?: string,
): number {
  return adminAccount(database, accountId, environment)
    ? ADMIN_INVENTORY_CAPACITY
    : INVENTORY_CAPACITY;
}

export function inventoryCapacityForCharacter(
  database: DatabaseSync,
  characterId: string,
  environment?: string,
): number {
  return adminCharacter(database, characterId, environment)
    ? ADMIN_INVENTORY_CAPACITY
    : INVENTORY_CAPACITY;
}

const definitions: Record<string, ItemDefinition> = {
  fixture_chair: {
    id: 'fixture_chair',
    name: 'Test chair',
    description: 'Development placement fixture.',
    kind: 'furniture',
    stackable: false,
    maxStack: 1,
    equipmentSlot: null,
    healHp: 0,
    furniture: { width: 1, depth: 1, artworkKey: 'chair' },
  },
  fixture_bench: {
    id: 'fixture_bench',
    name: 'Test bench',
    description: 'Development placement fixture.',
    kind: 'furniture',
    stackable: false,
    maxStack: 1,
    equipmentSlot: null,
    healHp: 0,
    furniture: { width: 2, depth: 1, artworkKey: 'bench' },
  },
  fixture_table: {
    id: 'fixture_table',
    name: 'Test table',
    description: 'Development placement fixture.',
    kind: 'furniture',
    stackable: false,
    maxStack: 1,
    equipmentSlot: null,
    healHp: 0,
    furniture: { width: 2, depth: 2, artworkKey: 'table' },
  },
  fixture_farm_bed: {
    id: 'fixture_farm_bed',
    name: 'Temporary farm bed',
    description: 'Temporary farming-bed placement fixture for development rooms.',
    kind: 'furniture',
    stackable: false,
    maxStack: 1,
    equipmentSlot: null,
    healHp: 0,
    furniture: { width: 2, depth: 2, artworkKey: 'temporary_farm_bed' },
  },
  fixture_tomato_crop: {
    id: 'fixture_tomato_crop',
    name: 'Tomato plant · 1×1',
    description: 'Development crop placement fixture.',
    kind: 'furniture',
    stackable: false,
    maxStack: 1,
    equipmentSlot: null,
    healHp: 0,
    crop: { width: 1, depth: 1, artworkKey: 'tomato_crop' },
  },
  basic_fishing_rod: {
    id: 'basic_fishing_rod',
    name: 'Basic Fishing Rod',
    description: 'A reliable starter rod.',
    kind: 'tool',
    stackable: false,
    maxStack: 1,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/basic-fishing-rod.webp',
  },
  reinforced_fishing_rod: {
    id: 'reinforced_fishing_rod',
    name: 'Reinforced Fishing Rod',
    description: 'A sturdier rod for pier fishing.',
    kind: 'tool',
    stackable: false,
    maxStack: 1,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/reinforced-fishing-rod.webp',
  },
  surfcasting_fishing_rod: {
    id: 'surfcasting_fishing_rod',
    name: 'Surfcasting Rod',
    description: 'A longer rod suited to fishing the surf.',
    kind: 'tool',
    stackable: false,
    maxStack: 1,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/surfcasting-fishing-rod.webp',
  },
  heavy_game_fishing_rod: {
    id: 'heavy_game_fishing_rod',
    name: 'Heavy Game Rod',
    description: 'Heavy tackle for large fish.',
    kind: 'tool',
    stackable: false,
    maxStack: 1,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/heavy-game-fishing-rod.webp',
  },
  worm_bait: {
    id: 'worm_bait',
    name: 'Worm Bait',
    description: 'Bait for a pier fishing attempt.',
    kind: 'tool',
    stackable: true,
    maxStack: 120,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/worm-bait.webp',
  },
  squid_bait: {
    id: 'squid_bait',
    name: 'Squid Bait',
    description: 'Bait for a pier fishing attempt.',
    kind: 'tool',
    stackable: true,
    maxStack: 120,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/squid-bait.webp',
  },
  crab_bait: {
    id: 'crab_bait',
    name: 'Crab Bait',
    description: 'Bait for a pier fishing attempt.',
    kind: 'tool',
    stackable: true,
    maxStack: 120,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/crab-bait.webp',
  },
  shrimp_bait: {
    id: 'shrimp_bait',
    name: 'Shrimp Bait',
    description: 'Bait for a pier fishing attempt.',
    kind: 'tool',
    stackable: true,
    maxStack: 120,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/shrimp-bait.webp',
  },
  fish_chunks_bait: {
    id: 'fish_chunks_bait',
    name: 'Fish Chunks Bait',
    description: 'Bait for a pier fishing attempt.',
    kind: 'tool',
    stackable: true,
    maxStack: 120,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/fish-chunks-bait.webp',
  },
  sardine: {
    id: 'sardine',
    name: 'Sardine',
    description: 'A fresh pier catch.',
    kind: 'tool',
    stackable: true,
    maxStack: 10,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/sardine.webp',
  },
  mackerel: {
    id: 'mackerel',
    name: 'Mackerel',
    description: 'A fresh pier catch.',
    kind: 'tool',
    stackable: true,
    maxStack: 10,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/mackerel.webp',
  },
  bluefin_tuna: {
    id: 'bluefin_tuna',
    name: 'Bluefin Tuna',
    description: 'A large pier catch.',
    kind: 'tool',
    stackable: true,
    maxStack: 10,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/bluefin-tuna.webp',
  },
  red_mullet: {
    id: 'red_mullet',
    name: 'Red Mullet',
    description: 'A fresh pier catch.',
    kind: 'tool',
    stackable: true,
    maxStack: 10,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/red-mullet.webp',
  },
  seabass: {
    id: 'seabass',
    name: 'Seabass',
    description: 'A fresh pier catch.',
    kind: 'tool',
    stackable: true,
    maxStack: 10,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/seabass.webp',
  },
  conger_eel: {
    id: 'conger_eel',
    name: 'Conger Eel',
    description: 'A fresh pier catch.',
    kind: 'tool',
    stackable: true,
    maxStack: 10,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/conger-eel.webp',
  },
  barracuda: {
    id: 'barracuda',
    name: 'Barracuda',
    description: 'A fresh pier catch.',
    kind: 'tool',
    stackable: true,
    maxStack: 10,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/barracuda.webp',
  },
  swordfish: {
    id: 'swordfish',
    name: 'Swordfish',
    description: 'A large pier catch.',
    kind: 'tool',
    stackable: true,
    maxStack: 10,
    equipmentSlot: null,
    healHp: 0,
    artworkPath: '/assets/items/swordfish.webp',
  },
  field_rations: {
    id: 'field_rations',
    name: 'Field rations',
    description: 'A compact meal for the road.',
    kind: 'consumable',
    stackable: true,
    maxStack: 20,
    equipmentSlot: null,
    healHp: 12,
  },
  bandage: {
    id: 'bandage',
    name: 'Bandage',
    description: 'Clean dressing for a quick recovery.',
    kind: 'consumable',
    stackable: true,
    maxStack: 20,
    equipmentSlot: null,
    healHp: 25,
  },
  newcomer_jacket: {
    id: 'newcomer_jacket',
    name: 'Newcomer jacket',
    description: 'Practical city clothing.',
    kind: 'equipment',
    stackable: false,
    maxStack: 1,
    equipmentSlot: 'body',
    healHp: 0,
  },
  basic_toolkit: {
    id: 'basic_toolkit',
    name: 'Basic toolkit',
    description: 'Simple hand tools for future work.',
    kind: 'tool',
    stackable: false,
    maxStack: 1,
    equipmentSlot: null,
    healHp: 0,
  },
};

interface ItemRow {
  id: string;
  definition_id: string;
  quantity: number;
  location: ItemLocation;
  equipped: number;
  sort_index?: number | null;
}

function newId(): string {
  return randomBytes(16).toString('hex');
}
function definition(id: string): ItemDefinition {
  const value = definitions[id];
  if (!value) throw new Error(`Unknown item definition: ${id}`);
  return value;
}
function mapItem(database: DatabaseSync, row: ItemRow): InventoryItem {
  return {
    ...definition(row.definition_id),
    instanceId: row.id,
    quantity: row.quantity,
    location: row.location,
    equipped: Boolean(row.equipped),
    ...(isFish(row.definition_id)
      ? { specimens: fishSpecimensForStack(database, row.id, row.definition_id) }
      : {}),
  };
}
function characterId(database: DatabaseSync, accountId: string): string | null {
  const row = database.prepare('SELECT id FROM characters WHERE account_id = ?').get(accountId) as
    { id: string } | undefined;
  return row?.id ?? null;
}
function rows(database: DatabaseSync, id: string, location?: ItemLocation): ItemRow[] {
  return database
    .prepare(
      `SELECT id, definition_id, quantity, location, equipped, sort_index FROM character_items
    WHERE character_id = ?${location ? ' AND location = ?' : " AND location IN ('inventory', 'locker')"} ORDER BY sort_index IS NULL, sort_index, created_at, id`,
    )
    .all(...(location ? [id, location] : [id])) as unknown as ItemRow[];
}
function usedSlots(database: DatabaseSync, id: string): number {
  return (
    database
      .prepare(
        "SELECT count(*) AS count FROM character_items WHERE character_id = ? AND location = 'inventory'",
      )
      .get(id) as { count: number }
  ).count;
}

export function itemDefinitions(): ItemDefinition[] {
  return Object.values(definitions);
}

export function itemDefinition(id: string): ItemDefinition | null {
  return definitions[id] ?? null;
}

export function seedStarterItems(database: DatabaseSync, accountId: string): void {
  const id = characterId(database, accountId);
  if (!id) throw new Error('Cannot seed inventory without a character.');
  const count = database
    .prepare('SELECT count(*) AS count FROM character_items WHERE character_id = ?')
    .get(id) as { count: number };
  if (count.count) return;
  const now = new Date().toISOString();
  const insert = database.prepare(
    'INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  insert.run(newId(), id, 'field_rations', 3, 'inventory', 0, now, now);
  insert.run(newId(), id, 'bandage', 2, 'inventory', 0, now, now);
  insert.run(newId(), id, 'newcomer_jacket', 1, 'inventory', 0, now, now);
  insert.run(newId(), id, 'basic_toolkit', 1, 'inventory', 0, now, now);
}

export function getInventory(
  database: DatabaseSync,
  accountId: string,
  environment?: string,
): InventoryState | null {
  const id = characterId(database, accountId);
  if (!id) return null;
  const isAdmin = adminAccount(database, accountId, environment);
  const capacity = isAdmin ? ADMIN_INVENTORY_CAPACITY : INVENTORY_CAPACITY;
  return {
    capacity,
    lockerCapacity: isAdmin ? ADMIN_LOCKER_CAPACITY : null,
    usedSlots: usedSlots(database, id),
    items: positionedItems(database, rows(database, id, 'inventory'), capacity),
    locker: positionedItems(database, rows(database, id, 'locker'), 0),
  };
}

function positionedItems(
  database: DatabaseSync,
  itemRows: ItemRow[],
  minimum: number,
): InventoryItem[] {
  const highest = itemRows.reduce((last, row) => Math.max(last, row.sort_index ?? -1), -1);
  const slots: Array<ItemRow | null> = Array(Math.max(minimum, itemRows.length, highest + 1)).fill(
    null,
  );
  const placed = new Set<string>();
  for (const row of itemRows) {
    if (
      row.sort_index === null ||
      row.sort_index === undefined ||
      !Number.isInteger(row.sort_index) ||
      row.sort_index < 0 ||
      row.sort_index >= slots.length ||
      slots[row.sort_index]
    )
      continue;
    slots[row.sort_index] = row;
    placed.add(row.id);
  }
  for (const row of itemRows) {
    if (placed.has(row.id)) continue;
    const available = slots.findIndex((slot) => !slot);
    slots[available] = row;
  }
  return slots.flatMap((row, slotIndex) => (row ? [{ ...mapItem(database, row), slotIndex }] : []));
}

function requiresLockerAccess(character: Character | null): boolean {
  return character ? isCityLocation(character.currentLocationId) : false;
}
function result(database: DatabaseSync, accountId: string, environment?: string): InventoryState {
  const state = getInventory(database, accountId, environment);
  if (!state) throw new Error('Character not found.');
  return state;
}

export type InventoryResult = { state: InventoryState } | { error: string; message: string };
export type MergeResult =
  { state: InventoryState; moved: number } | { error: string; message: string };

export function mergeStacks(
  database: DatabaseSync,
  accountId: string,
  sourceId: unknown,
  targetId: unknown,
  environment?: string,
): MergeResult {
  if (typeof sourceId !== 'string' || typeof targetId !== 'string' || sourceId === targetId)
    return { error: 'VALIDATION_ERROR', message: 'Choose two different stacks.' };
  const character = getCharacter(database, accountId);
  const id = characterId(database, accountId);
  if (!id) return { error: 'NOT_FOUND', message: 'Character not found.' };
  if (!requiresLockerAccess(character))
    return {
      error: 'LOCKER_UNAVAILABLE',
      message: 'The city locker is only available in New Harbor.',
    };

  database.exec('BEGIN IMMEDIATE');
  try {
    const stack = database.prepare(
      'SELECT id, definition_id, quantity, location, equipped FROM character_items WHERE id = ? AND character_id = ?',
    );
    const source = stack.get(sourceId, id) as ItemRow | undefined;
    const target = stack.get(targetId, id) as ItemRow | undefined;
    if (
      !source ||
      !target ||
      (source.location !== 'inventory' && source.location !== 'locker') ||
      (target.location !== 'inventory' && target.location !== 'locker') ||
      source.definition_id !== target.definition_id ||
      source.equipped ||
      target.equipped
    ) {
      database.exec('ROLLBACK');
      return {
        error: 'STACK_NOT_COMPATIBLE',
        message: 'Choose two available stacks of the same item.',
      };
    }
    const item = definition(source.definition_id);
    if (!item.stackable) {
      database.exec('ROLLBACK');
      return { error: 'STACK_NOT_COMPATIBLE', message: 'These items cannot be combined.' };
    }
    const moved = Math.min(source.quantity, item.maxStack - target.quantity);
    if (moved <= 0) {
      database.exec('ROLLBACK');
      return { error: 'STACK_FULL', message: 'That stack is already full.' };
    }
    const now = new Date().toISOString();
    database
      .prepare('UPDATE character_items SET quantity = quantity + ?, updated_at = ? WHERE id = ?')
      .run(moved, now, target.id);
    if (isFish(source.definition_id)) moveFishSpecimens(database, source.id, target.id, moved);
    if (moved === source.quantity)
      database.prepare('DELETE FROM character_items WHERE id = ?').run(source.id);
    else
      database
        .prepare('UPDATE character_items SET quantity = quantity - ?, updated_at = ? WHERE id = ?')
        .run(moved, now, source.id);
    database.exec('COMMIT');
    return { state: result(database, accountId, environment), moved };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function reorderItems(
  database: DatabaseSync,
  accountId: string,
  location: unknown,
  itemIds: unknown,
  environment?: string,
): InventoryResult {
  if (
    (location !== 'inventory' && location !== 'locker') ||
    !Array.isArray(itemIds) ||
    !itemIds.every((itemId) => typeof itemId === 'string' || itemId === null) ||
    new Set(itemIds.filter((itemId) => itemId !== null)).size !==
      itemIds.filter((itemId) => itemId !== null).length
  )
    return { error: 'VALIDATION_ERROR', message: 'Provide a container and each item once.' };
  const character = getCharacter(database, accountId);
  const id = characterId(database, accountId);
  if (!id) return { error: 'NOT_FOUND', message: 'Character not found.' };
  if (!requiresLockerAccess(character))
    return {
      error: 'LOCKER_UNAVAILABLE',
      message: 'The city locker is only available in New Harbor.',
    };

  database.exec('BEGIN IMMEDIATE');
  try {
    const currentRows = rows(database, id, location);
    const currentIds = currentRows.map((row) => row.id);
    const requestedIds = itemIds.filter((itemId): itemId is string => itemId !== null);
    const capacity = inventoryCapacity(database, accountId, environment);
    const lockerCapacity =
      capacity === ADMIN_INVENTORY_CAPACITY ? ADMIN_LOCKER_CAPACITY : undefined;
    const expectedSize =
      location === 'inventory'
        ? Math.max(capacity, currentIds.length)
        : lockerSlotCount(positionedItems(database, currentRows, 0), lockerCapacity);
    const legacyLockerList =
      location === 'locker' &&
      itemIds.length === currentIds.length &&
      itemIds.every((itemId) => typeof itemId === 'string');
    if (
      (itemIds.length !== expectedSize && !legacyLockerList) ||
      requestedIds.length !== currentIds.length ||
      !requestedIds.every((itemId) => currentIds.includes(itemId))
    ) {
      database.exec('ROLLBACK');
      return { error: 'INVENTORY_CHANGED', message: 'Your items changed. Refresh and try again.' };
    }
    const update = database.prepare(
      'UPDATE character_items SET sort_index = ?, updated_at = ? WHERE id = ? AND character_id = ? AND location = ?',
    );
    const now = new Date().toISOString();
    for (const [index, itemId] of itemIds.entries())
      if (itemId !== null) update.run(index, now, itemId, id, location);
    database.exec('COMMIT');
    return { state: result(database, accountId, environment) };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
export function transferItem(
  database: DatabaseSync,
  accountId: string,
  instanceId: unknown,
  destination: unknown,
  quantity: unknown,
  environment?: string,
): InventoryResult {
  if (
    typeof instanceId !== 'string' ||
    (destination !== 'locker' && destination !== 'inventory') ||
    typeof quantity !== 'number' ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  )
    return {
      error: 'VALIDATION_ERROR',
      message: 'Provide an item, destination, and positive whole quantity.',
    };
  const character = getCharacter(database, accountId);
  const id = characterId(database, accountId);
  if (!id) return { error: 'NOT_FOUND', message: 'Character not found.' };
  const transferQuantity = quantity;
  if (!requiresLockerAccess(character))
    return {
      error: 'LOCKER_UNAVAILABLE',
      message: 'The city locker is only available in New Harbor.',
    };
  const row = database
    .prepare(
      'SELECT id, definition_id, quantity, location, equipped FROM character_items WHERE id = ? AND character_id = ?',
    )
    .get(instanceId, id) as ItemRow | undefined;
  if (
    !row ||
    (row.location !== 'inventory' && row.location !== 'locker') ||
    row.location === destination
  )
    return {
      error: 'ITEM_NOT_AVAILABLE',
      message: 'That item is not available for this transfer.',
    };
  if (row.equipped)
    return { error: 'ITEM_EQUIPPED', message: 'Unequip this item before moving it.' };
  if (transferQuantity > row.quantity)
    return { error: 'INVALID_QUANTITY', message: 'You do not have that many items.' };
  const def = definition(row.definition_id);
  const capacity = inventoryCapacity(database, accountId, environment);
  const lockerCapacity = capacity === ADMIN_INVENTORY_CAPACITY ? ADMIN_LOCKER_CAPACITY : null;
  if (isFish(row.definition_id)) {
    database.exec('BEGIN IMMEDIATE');
    try {
      const fresh = database
        .prepare(
          'SELECT id, definition_id, quantity, location, equipped FROM character_items WHERE id = ? AND character_id = ?',
        )
        .get(row.id, id) as ItemRow | undefined;
      if (
        !fresh ||
        !requiresLockerAccess(getCharacter(database, accountId)) ||
        (fresh.location !== 'inventory' && fresh.location !== 'locker') ||
        fresh.quantity !== row.quantity ||
        fresh.location !== row.location ||
        fresh.equipped ||
        transferQuantity > fresh.quantity
      ) {
        database.exec('ROLLBACK');
        return {
          error: 'ITEM_NOT_AVAILABLE',
          message: 'That item changed. Refresh inventory and try again.',
        };
      }
      const targets = database
        .prepare(
          'SELECT id, quantity FROM character_items WHERE character_id = ? AND definition_id = ? AND location = ? AND quantity < 10 ORDER BY created_at, id',
        )
        .all(id, row.definition_id, destination) as unknown as Array<{
        id: string;
        quantity: number;
      }>;
      let remaining = transferQuantity;
      const available = targets.reduce((sum, target) => sum + 10 - target.quantity, 0);
      const newStacks = Math.ceil(Math.max(0, remaining - available) / 10);
      const released = row.location === 'inventory' && transferQuantity === row.quantity ? 1 : 0;
      if (
        destination === 'inventory' &&
        usedSlots(database, id) - released + newStacks > capacity
      ) {
        database.exec('ROLLBACK');
        return { error: 'INVENTORY_FULL', message: 'Your carried inventory is full.' };
      }
      if (
        destination === 'locker' &&
        lockerCapacity !== null &&
        rows(database, id, 'locker').length + newStacks > lockerCapacity
      ) {
        database.exec('ROLLBACK');
        return { error: 'LOCKER_FULL', message: 'Your city locker is full.' };
      }
      const now = new Date().toISOString();
      for (const target of targets) {
        const amount = Math.min(remaining, 10 - target.quantity);
        if (!amount) continue;
        moveFishSpecimens(database, row.id, target.id, amount);
        database
          .prepare(
            'UPDATE character_items SET quantity = quantity + ?, updated_at = ? WHERE id = ?',
          )
          .run(amount, now, target.id);
        remaining -= amount;
      }
      if (remaining) {
        if (remaining === row.quantity && transferQuantity === row.quantity) {
          database
            .prepare(
              'UPDATE character_items SET location = ?, sort_index = NULL, updated_at = ? WHERE id = ?',
            )
            .run(destination, now, row.id);
          remaining = 0;
        } else {
          const targetId = newId();
          database
            .prepare(
              'INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
            )
            .run(targetId, id, row.definition_id, remaining, destination, now, now);
          moveFishSpecimens(database, row.id, targetId, remaining);
          remaining = 0;
        }
      }
      const sourceLeft = row.quantity - transferQuantity;
      if (sourceLeft === 0) {
        // A full-stack move without a merge already changed its location in place.
        const moved = database
          .prepare('SELECT location FROM character_items WHERE id = ?')
          .get(row.id) as { location: string };
        if (moved.location === row.location)
          database.prepare('DELETE FROM character_items WHERE id = ?').run(row.id);
      } else if (sourceLeft > 0) {
        database
          .prepare('UPDATE character_items SET quantity = ?, updated_at = ? WHERE id = ?')
          .run(sourceLeft, now, row.id);
      }
      database.exec('COMMIT');
      return { state: result(database, accountId, environment) };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  const now = new Date().toISOString();
  database.exec('BEGIN IMMEDIATE');
  try {
    const fresh = database
      .prepare(
        'SELECT quantity, location, equipped FROM character_items WHERE id = ? AND character_id = ?',
      )
      .get(row.id, id) as Pick<ItemRow, 'quantity' | 'location' | 'equipped'> | undefined;
    if (
      !fresh ||
      !requiresLockerAccess(getCharacter(database, accountId)) ||
      (fresh.location !== 'inventory' && fresh.location !== 'locker') ||
      fresh.quantity !== row.quantity ||
      fresh.location !== row.location ||
      fresh.equipped
    ) {
      database.exec('ROLLBACK');
      return {
        error: 'ITEM_NOT_AVAILABLE',
        message: 'That item changed. Refresh inventory and try again.',
      };
    }
    const matching = def.stackable
      ? (database
          .prepare(
            'SELECT id, quantity FROM character_items WHERE character_id = ? AND definition_id = ? AND location = ? AND equipped = 0 AND quantity + ? <= ? LIMIT 1',
          )
          .get(id, row.definition_id, destination, transferQuantity, def.maxStack) as unknown as
          { id: string; quantity: number } | undefined)
      : undefined;
    if (destination === 'inventory' && !matching && usedSlots(database, id) >= capacity) {
      database.exec('ROLLBACK');
      return { error: 'INVENTORY_FULL', message: 'Your carried inventory is full.' };
    }
    if (
      destination === 'locker' &&
      !matching &&
      lockerCapacity !== null &&
      rows(database, id, 'locker').length >= lockerCapacity
    ) {
      database.exec('ROLLBACK');
      return { error: 'LOCKER_FULL', message: 'Your city locker is full.' };
    }
    if (matching) {
      database
        .prepare('UPDATE character_items SET quantity = ?, updated_at = ? WHERE id = ?')
        .run(matching.quantity + transferQuantity, now, matching.id);
      if (transferQuantity === row.quantity)
        database.prepare('DELETE FROM character_items WHERE id = ?').run(row.id);
      else
        database
          .prepare('UPDATE character_items SET quantity = ?, updated_at = ? WHERE id = ?')
          .run(row.quantity - transferQuantity, now, row.id);
    } else if (transferQuantity === row.quantity) {
      database
        .prepare(
          'UPDATE character_items SET location = ?, sort_index = NULL, updated_at = ? WHERE id = ?',
        )
        .run(destination, now, row.id);
    } else {
      database
        .prepare(
          'INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
        )
        .run(newId(), id, row.definition_id, transferQuantity, destination, now, now);
      database
        .prepare('UPDATE character_items SET quantity = ?, updated_at = ? WHERE id = ?')
        .run(row.quantity - transferQuantity, now, row.id);
    }
    database.exec('COMMIT');
    return { state: result(database, accountId, environment) };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function useItem(
  database: DatabaseSync,
  accountId: string,
  instanceId: unknown,
): InventoryResult & { character?: Character } {
  if (typeof instanceId !== 'string')
    return { error: 'VALIDATION_ERROR', message: 'Provide an inventory item.' };
  const character = getCharacter(database, accountId);
  const id = characterId(database, accountId);
  if (!character || !id) return { error: 'NOT_FOUND', message: 'Character not found.' };
  const row = database
    .prepare(
      "SELECT id, definition_id, quantity, location, equipped FROM character_items WHERE id = ? AND character_id = ? AND location = 'inventory'",
    )
    .get(instanceId, id) as ItemRow | undefined;
  if (!row) return { error: 'ITEM_NOT_AVAILABLE', message: 'That carried item is not available.' };
  const def = definition(row.definition_id);
  if (def.kind !== 'consumable' || !def.healHp)
    return { error: 'ITEM_NOT_USABLE', message: 'This item cannot be used right now.' };
  if (character.hp >= character.maxHp)
    return { error: 'HEALTH_FULL', message: 'Your health is already full.' };
  const now = new Date().toISOString();
  database.exec('BEGIN');
  try {
    if (row.quantity === 1)
      database.prepare('DELETE FROM character_items WHERE id = ?').run(row.id);
    else
      database
        .prepare('UPDATE character_items SET quantity = ?, updated_at = ? WHERE id = ?')
        .run(row.quantity - 1, now, row.id);
    database
      .prepare('UPDATE characters SET hp = ?, updated_at = ? WHERE id = ?')
      .run(Math.min(character.maxHp, character.hp + def.healHp), now, character.id);
    database.exec('COMMIT');
    return { state: result(database, accountId), character: getCharacter(database, accountId)! };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function setEquipped(
  database: DatabaseSync,
  accountId: string,
  instanceId: unknown,
  equipped: boolean,
): InventoryResult {
  if (typeof instanceId !== 'string')
    return { error: 'VALIDATION_ERROR', message: 'Provide an inventory item.' };
  const id = characterId(database, accountId);
  if (!id) return { error: 'NOT_FOUND', message: 'Character not found.' };
  const row = database
    .prepare(
      "SELECT id, definition_id, quantity, location, equipped FROM character_items WHERE id = ? AND character_id = ? AND location = 'inventory'",
    )
    .get(instanceId, id) as ItemRow | undefined;
  if (!row) return { error: 'ITEM_NOT_AVAILABLE', message: 'That carried item is not available.' };
  const def = definition(row.definition_id);
  if (!def.equipmentSlot)
    return { error: 'ITEM_NOT_EQUIPPABLE', message: 'This item cannot be equipped.' };
  const now = new Date().toISOString();
  database.exec('BEGIN');
  try {
    if (equipped)
      database
        .prepare(
          "UPDATE character_items SET equipped = 0, updated_at = ? WHERE character_id = ? AND location = 'inventory' AND definition_id IN ('newcomer_jacket')",
        )
        .run(now, id);
    database
      .prepare('UPDATE character_items SET equipped = ?, updated_at = ? WHERE id = ?')
      .run(equipped ? 1 : 0, now, row.id);
    database.exec('COMMIT');
    return { state: result(database, accountId) };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
