import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { FishSpecies } from './fishingConfig.js';
import { insertFishSpecimen, isFish } from './fishSpecimens.js';

export const SCHEMA_VERSION = 16;

function migrateRoomSchema(database: DatabaseSync): void {
  const table = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'character_items'")
    .get() as { sql: string };
  if (!table.sql.includes("'room'")) {
    database.exec('PRAGMA foreign_keys = OFF');
    try {
      database.exec('BEGIN IMMEDIATE');
      database.exec(`
        CREATE TABLE character_items_replacement (
          id TEXT PRIMARY KEY,
          character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
          definition_id TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          location TEXT NOT NULL CHECK (location IN ('inventory', 'locker', 'room')),
          equipped INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0, 1)),
          sort_index INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (NOT (location IN ('locker', 'room') AND equipped = 1)),
          CHECK (location != 'room' OR (quantity = 1 AND sort_index IS NULL))
        );
        INSERT INTO character_items_replacement
          (id, character_id, definition_id, quantity, location, equipped, sort_index, created_at, updated_at)
        SELECT id, character_id, definition_id, quantity, location, equipped, sort_index, created_at, updated_at
        FROM character_items;
        DROP TABLE character_items;
        ALTER TABLE character_items_replacement RENAME TO character_items;
        CREATE INDEX character_items_character_location_index ON character_items(character_id, location);
      `);
      const violations = database.prepare('PRAGMA foreign_key_check').all();
      if (violations.length) throw new Error('Room migration found broken foreign keys.');
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    } finally {
      database.exec('PRAGMA foreign_keys = ON');
    }
    const enabled = database.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    if (enabled.foreign_keys !== 1)
      throw new Error('Foreign key enforcement could not be restored.');
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      owner_character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      location_id TEXT NOT NULL,
      width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 64),
      depth INTEGER NOT NULL CHECK (depth BETWEEN 1 AND 64),
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS rooms_owner_location_index ON rooms(owner_character_id, location_id);
    CREATE TABLE IF NOT EXISTS room_placements (
      item_id TEXT PRIMARY KEY REFERENCES character_items(id) ON DELETE RESTRICT,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      x INTEGER NOT NULL CHECK (x >= 0),
      y INTEGER NOT NULL CHECK (y >= 0),
      rotation INTEGER NOT NULL CHECK (rotation IN (0, 90, 180, 270))
    );
    CREATE INDEX IF NOT EXISTS room_placements_room_index ON room_placements(room_id);
    CREATE TABLE IF NOT EXISTS room_crops (
      item_id TEXT PRIMARY KEY REFERENCES character_items(id) ON DELETE RESTRICT,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      bed_item_id TEXT NOT NULL REFERENCES character_items(id) ON DELETE RESTRICT,
      x INTEGER NOT NULL CHECK (x BETWEEN 0 AND 1),
      y INTEGER NOT NULL CHECK (y BETWEEN 0 AND 1),
      UNIQUE (room_id, bed_item_id, x, y)
    );
    CREATE INDEX IF NOT EXISTS room_crops_room_bed_index ON room_crops(room_id, bed_item_id);
    CREATE TABLE IF NOT EXISTS room_commands (
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      request_key TEXT NOT NULL,
      signature TEXT NOT NULL,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      applied_revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (character_id, request_key)
    );
  `);
}

function migrateFishSpecimens(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS fish_specimens (
      id TEXT PRIMARY KEY,
      stack_id TEXT NOT NULL REFERENCES character_items(id) ON DELETE CASCADE,
      weight_kg REAL,
      source TEXT NOT NULL CHECK (source IN ('catch', 'admin_unknown', 'legacy_known', 'legacy_unknown')),
      created_at TEXT NOT NULL,
      CHECK (weight_kg IS NULL OR weight_kg > 0)
    );
    CREATE INDEX IF NOT EXISTS fish_specimens_stack_index ON fish_specimens(stack_id);
  `);
  if (database.prepare("SELECT 1 FROM app_metadata WHERE key = 'fish_specimen_migration'").get())
    return;
  database.exec('BEGIN IMMEDIATE');
  try {
    const migrationTime = new Date().toISOString();
    const oldStacks = database
      .prepare(
        "SELECT id, character_id, definition_id, quantity, location FROM character_items WHERE definition_id IN ('sardine', 'mackerel', 'bluefin_tuna') ORDER BY character_id, definition_id, created_at, id",
      )
      .all() as unknown as Array<{
      id: string;
      character_id: string;
      definition_id: FishSpecies;
      quantity: number;
      location: string;
    }>;
    let unknownWeights = 0;
    let recoveredWeights = 0;
    let movedToLocker = 0;
    const keys = new Set(oldStacks.map((row) => `${row.character_id}:${row.definition_id}`));
    const historicWeights = new Map<string, number[]>();
    for (const key of keys) {
      const separator = key.indexOf(':');
      const characterId = key.slice(0, separator);
      const species = key.slice(separator + 1);
      const traces = database
        .prepare(
          `SELECT a.trace_json FROM fishing_attempts a
           JOIN fishing_sessions s ON s.id = a.session_id
           WHERE s.character_id = ? ORDER BY a.created_at DESC, a.rowid DESC`,
        )
        .all(characterId) as unknown as Array<{ trace_json: string }>;
      historicWeights.set(
        key,
        traces.flatMap(({ trace_json }) => {
          try {
            const trace = JSON.parse(trace_json) as {
              species?: string;
              weightKg?: number;
              inventoryResult?: { action?: string };
            };
            return trace.species === species &&
              typeof trace.weightKg === 'number' &&
              Number.isFinite(trace.weightKg) &&
              trace.weightKg > 0 &&
              ['merge', 'new stack'].includes(trace.inventoryResult?.action ?? '')
              ? [trace.weightKg]
              : [];
          } catch {
            return [];
          }
        }),
      );
    }
    for (const row of oldStacks) {
      if (!isFish(row.definition_id)) continue;
      const key = `${row.character_id}:${row.definition_id}`;
      const weights = historicWeights.get(key)!;
      let remaining = row.quantity;
      let first = true;
      while (remaining > 0) {
        const amount = Math.min(10, remaining);
        const stackId = first ? row.id : randomId();
        const slots = (
          database
            .prepare(
              "SELECT count(*) AS count FROM character_items WHERE character_id = ? AND location = 'inventory'",
            )
            .get(row.character_id) as { count: number }
        ).count;
        const location =
          row.location === 'inventory' && !first && slots >= 10 ? 'locker' : row.location;
        if (location === 'locker' && row.location === 'inventory') movedToLocker += amount;
        if (first)
          database
            .prepare('UPDATE character_items SET quantity = ?, updated_at = ? WHERE id = ?')
            .run(amount, migrationTime, stackId);
        else
          database
            .prepare(
              `INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
            )
            .run(
              stackId,
              row.character_id,
              row.definition_id,
              amount,
              location,
              migrationTime,
              migrationTime,
            );
        for (let index = 0; index < amount; index++) {
          const weight = weights.shift() ?? null;
          if (weight === null) unknownWeights++;
          else recoveredWeights++;
          insertFishSpecimen(
            database,
            stackId,
            weight,
            weight === null ? 'legacy_unknown' : 'legacy_known',
            migrationTime,
          );
        }
        remaining -= amount;
        first = false;
      }
    }
    database
      .prepare('INSERT INTO app_metadata (key, value, updated_at) VALUES (?, ?, ?)')
      .run(
        'fish_specimen_migration',
        JSON.stringify({ recoveredWeights, unknownWeights, movedToLocker }),
        migrationTime,
      );
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function randomId(): string {
  return randomUUID();
}

export function openDatabase(databasePath: string): DatabaseSync {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA busy_timeout = 5000;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      credits INTEGER NOT NULL DEFAULT 250 CHECK (credits >= 0),
      hp INTEGER NOT NULL DEFAULT 100 CHECK (hp >= 0),
      max_hp INTEGER NOT NULL DEFAULT 100 CHECK (max_hp > 0 AND hp <= max_hp),
      character_xp INTEGER NOT NULL DEFAULT 0 CHECK (character_xp >= 0),
      character_level INTEGER NOT NULL DEFAULT 1 CHECK (character_level >= 1),
      current_location TEXT NOT NULL DEFAULT 'New Harbor',
      active_status TEXT NOT NULL DEFAULT 'idle',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_account_id_index ON sessions(account_id);

    CREATE TABLE IF NOT EXISTS character_items (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      definition_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      location TEXT NOT NULL CHECK (location IN ('inventory', 'locker')),
      equipped INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0, 1)),
      sort_index INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (NOT (location = 'locker' AND equipped = 1))
    );
    CREATE INDEX IF NOT EXISTS character_items_character_location_index ON character_items(character_id, location);

    CREATE TABLE IF NOT EXISTS character_discovered_locations (
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      location_id TEXT NOT NULL,
      discovered_at TEXT NOT NULL,
      PRIMARY KEY (character_id, location_id)
    );
    CREATE TABLE IF NOT EXISTS character_pinned_locations (
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      location_id TEXT NOT NULL,
      pinned_at TEXT NOT NULL,
      PRIMARY KEY (character_id, location_id)
    );
    CREATE TABLE IF NOT EXISTS fishing_sessions (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('active', 'stopped')),
      rod_item_id TEXT NOT NULL,
      bait_item_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      next_attempt_at TEXT NOT NULL,
      attempt_started_at TEXT,
      attempt_duration_ms INTEGER NOT NULL DEFAULT 30000 CHECK (attempt_duration_ms > 0),
      stopped_at TEXT,
      stop_reason TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      catch_count INTEGER NOT NULL DEFAULT 0,
      latest_species TEXT,
      latest_weight_kg REAL,
      latest_result TEXT
    );
    CREATE INDEX IF NOT EXISTS fishing_sessions_character_index ON fishing_sessions(character_id, started_at);
    CREATE UNIQUE INDEX IF NOT EXISTS fishing_one_active_session ON fishing_sessions(character_id) WHERE status = 'active';
    CREATE TABLE IF NOT EXISTS fishing_attempts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES fishing_sessions(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL,
      request_key TEXT UNIQUE,
      trace_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(session_id, sequence)
    );
    CREATE TABLE IF NOT EXISTS fishing_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES fishing_sessions(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      event TEXT NOT NULL,
      detail_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fishing_random_event_clocks (
      character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
      clock_json TEXT NOT NULL,
      last_accounted_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fishing_random_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES fishing_sessions(id) ON DELETE CASCADE,
      attempt_count INTEGER NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('natural', 'forced')),
      status TEXT NOT NULL CHECK(status IN ('pending', 'used', 'cleared')),
      request_key TEXT,
      created_at TEXT NOT NULL,
      used_at TEXT,
      UNIQUE(session_id, request_key)
    );
    CREATE INDEX IF NOT EXISTS fishing_random_event_attempt ON fishing_random_events(session_id, attempt_count);
    CREATE TABLE IF NOT EXISTS character_discovered_fish (
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      species_id TEXT NOT NULL,
      discovered_at TEXT NOT NULL,
      PRIMARY KEY (character_id, species_id)
    );
    CREATE TABLE IF NOT EXISTS fishing_world_state (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      time_of_day TEXT NOT NULL,
      sea_state TEXT NOT NULL
    );
    INSERT OR IGNORE INTO fishing_world_state (id, time_of_day, sea_state) VALUES (1, 'Day', 'Moderate');
    CREATE TABLE IF NOT EXISTS admin_inventory_audit (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      actor_account_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      request_key TEXT,
      action TEXT NOT NULL,
      detail_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS npc_fish_sales (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      request_key TEXT NOT NULL,
      signature TEXT NOT NULL,
      species_id TEXT NOT NULL,
      specimen_count INTEGER NOT NULL CHECK (specimen_count > 0),
      credits_earned INTEGER NOT NULL CHECK (credits_earned > 0),
      detail_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(character_id, request_key)
    );
  `);
  // Early A01 databases can contain these tables before request idempotency was added.
  // CREATE TABLE IF NOT EXISTS does not upgrade an existing table.
  const itemColumns = database
    .prepare('PRAGMA table_info(character_items)')
    .all() as unknown as Array<{ name: string }>;
  if (!itemColumns.some((column) => column.name === 'sort_index'))
    database.exec('ALTER TABLE character_items ADD COLUMN sort_index INTEGER');
  const fishingSessionColumns = database
    .prepare('PRAGMA table_info(fishing_sessions)')
    .all() as unknown as Array<{ name: string }>;
  if (!fishingSessionColumns.some((column) => column.name === 'attempt_started_at'))
    database.exec('ALTER TABLE fishing_sessions ADD COLUMN attempt_started_at TEXT');
  if (!fishingSessionColumns.some((column) => column.name === 'attempt_duration_ms'))
    database.exec(
      'ALTER TABLE fishing_sessions ADD COLUMN attempt_duration_ms INTEGER NOT NULL DEFAULT 60000 CHECK (attempt_duration_ms > 0)',
    );
  if (!fishingSessionColumns.some((column) => column.name === 'event_revision'))
    database.exec(
      'ALTER TABLE fishing_sessions ADD COLUMN event_revision INTEGER NOT NULL DEFAULT 0',
    );
  // Existing attempts were scheduled for exactly 60 seconds. Preserve their deadline/history.
  database.exec(`
    UPDATE fishing_sessions
    SET attempt_started_at = strftime('%Y-%m-%dT%H:%M:%fZ', next_attempt_at, '-60 seconds')
    WHERE attempt_started_at IS NULL;
  `);
  for (const table of ['fishing_attempts', 'admin_inventory_audit'] as const) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{
      name: string;
    }>;
    if (!columns.some((column) => column.name === 'request_key'))
      database.exec(`ALTER TABLE ${table} ADD COLUMN request_key TEXT`);
  }
  const worldColumns = database
    .prepare('PRAGMA table_info(fishing_world_state)')
    .all() as unknown as Array<{ name: string }>;
  if (worldColumns.some((entry) => entry.name === 'weather'))
    database.exec('ALTER TABLE fishing_world_state DROP COLUMN weather');
  for (const column of [
    'sea_block_started_at',
    'sea_next_state',
    'sea_override_state',
    'time_override_state',
    'time_override_started_at',
  ]) {
    if (!worldColumns.some((entry) => entry.name === column))
      database.exec(`ALTER TABLE fishing_world_state ADD COLUMN ${column} TEXT`);
  }
  database
    .prepare(
      'UPDATE fishing_world_state SET time_override_started_at = ? WHERE time_override_state IS NOT NULL AND time_override_started_at IS NULL',
    )
    .run(new Date().toISOString());
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS fishing_attempt_request_key ON fishing_attempts(request_key) WHERE request_key IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS admin_inventory_request_key ON admin_inventory_audit(actor_account_id, request_key) WHERE request_key IS NOT NULL;
  `);
  database
    .prepare(
      "UPDATE characters SET current_location = 'new-harbor' WHERE current_location = 'New Harbor'",
    )
    .run();
  database
    .prepare(
      `INSERT OR IGNORE INTO character_discovered_locations (character_id, location_id, discovered_at)
       SELECT id, 'new-harbor', ? FROM characters`,
    )
    .run(new Date().toISOString());

  migrateFishSpecimens(database);
  migrateRoomSchema(database);

  return database;
}

export function seedDatabase(database: DatabaseSync): void {
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO app_metadata (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run('schema_version', String(SCHEMA_VERSION), now);
  database
    .prepare(
      `INSERT INTO app_metadata (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run('seed_status', 'ready', now);
}

export function readSchemaVersion(database: DatabaseSync): number {
  const row = database
    .prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get('schema_version') as { value: string } | undefined;

  return row ? Number(row.value) : 0;
}
