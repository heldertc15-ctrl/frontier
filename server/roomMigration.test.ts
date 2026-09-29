// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { createAccount } from './auth.js';
import { createCharacter } from './character.js';
import { openDatabase, seedDatabase } from './database.js';
import { insertFishSpecimen } from './fishSpecimens.js';

it('rebuilds a populated legacy inventory table without losing fish children or sort slots', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'frontier-room-migration-'));
  const file = path.join(directory, 'game.sqlite');
  try {
    const first = openDatabase(file);
    seedDatabase(first);
    const account = createAccount(first, 'legacy', 'test-password');
    const person = createCharacter(first, account.id, 'Legacy');
    const now = new Date().toISOString();
    first
      .prepare(
        "INSERT INTO character_items (id,character_id,definition_id,quantity,location,equipped,sort_index,created_at,updated_at) VALUES ('fish-stack',?,'sardine',2,'inventory',0,7,?,?)",
      )
      .run(person.id, now, now);
    insertFishSpecimen(first, 'fish-stack', 0.2, 'catch');
    insertFishSpecimen(first, 'fish-stack', 0.3, 'catch');
    first.close();
    const old = new DatabaseSync(file);
    old.exec('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;');
    old.exec(`CREATE TABLE character_items_old (
      id TEXT PRIMARY KEY, character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      definition_id TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0),
      location TEXT NOT NULL CHECK(location IN ('inventory','locker')),
      equipped INTEGER NOT NULL DEFAULT 0 CHECK(equipped IN (0,1)), sort_index INTEGER,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      CHECK(NOT(location='locker' AND equipped=1)));
      INSERT INTO character_items_old SELECT * FROM character_items;
      DROP TABLE character_items;
      ALTER TABLE character_items_old RENAME TO character_items;
      COMMIT;`);
    old.close();
    const migrated = openDatabase(file);
    expect(
      migrated
        .prepare(
          "SELECT id,quantity,location,sort_index FROM character_items WHERE id='fish-stack'",
        )
        .get(),
    ).toMatchObject({ id: 'fish-stack', quantity: 2, location: 'inventory', sort_index: 7 });
    expect(
      migrated
        .prepare("SELECT count(*) AS n FROM fish_specimens WHERE stack_id='fish-stack'")
        .get(),
    ).toMatchObject({ n: 2 });
    expect(migrated.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(migrated.prepare('PRAGMA foreign_keys').get()).toMatchObject({ foreign_keys: 1 });
    migrated.close();
    const reopened = openDatabase(file);
    expect(reopened.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
