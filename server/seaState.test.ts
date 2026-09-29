import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, readSchemaVersion, SCHEMA_VERSION, seedDatabase } from './database.js';
import {
  clockSnapshot,
  rollNextSeaState,
  seaSnapshot,
  seaSnapshotWithin,
  updateSeaOverrideWithin,
  updateTimeOverrideWithin,
} from './seaState.js';

const directories: string[] = [];
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'frontier-sea-'));
  directories.push(directory);
  const file = path.join(directory, 'test.sqlite');
  const database = openDatabase(file);
  return { database, file };
}
const at = (value: string) => () => Date.parse(value);
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('shared sea schedule', () => {
  it('removes the obsolete condition from an existing world database', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'frontier-legacy-world-'));
    directories.push(directory);
    const file = path.join(directory, 'test.sqlite');
    const legacy = new DatabaseSync(file);
    legacy.exec(
      "CREATE TABLE fishing_world_state (id INTEGER PRIMARY KEY, time_of_day TEXT NOT NULL, sea_state TEXT NOT NULL, weather TEXT NOT NULL, time_override_state TEXT); INSERT INTO fishing_world_state VALUES (1, 'Day', 'Moderate', 'Sunny', 'Day')",
    );
    legacy.close();
    const upgraded = openDatabase(file);
    try {
      const columns = upgraded.prepare('PRAGMA table_info(fishing_world_state)').all() as Array<{
        name: string;
      }>;
      expect(columns.map((column) => column.name)).not.toContain('weather');
      const anchor = upgraded
        .prepare('SELECT time_override_started_at FROM fishing_world_state WHERE id = 1')
        .get() as { time_override_started_at: string };
      const anchorMs = Date.parse(anchor.time_override_started_at);
      expect(clockSnapshot(upgraded, anchorMs).gameTime).toMatchObject({ hour: 8, minute: 0 });
      expect(clockSnapshot(upgraded, anchorMs + 10_000).gameTime).toMatchObject({
        hour: 8,
        minute: 1,
      });
      expect(seaSnapshot(upgraded).conditions).toEqual({
        timeOfDay: expect.any(String),
        seaState: 'Moderate',
      });
    } finally {
      upgraded.close();
    }
  });
  it('reads the global clock without advancing sea state or fishing liveness', () => {
    const { database } = fixture();
    try {
      const now = Date.parse('2026-09-24T12:10:00.000Z');
      const before = database.prepare('SELECT * FROM fishing_world_state WHERE id = 1').get();
      expect(clockSnapshot(database, now)).toMatchObject({
        serverTime: '2026-09-24T12:10:00.000Z',
        gameTime: { hour: 1, minute: 0, scheduledPhase: 'Night' },
        timeOfDay: 'Night',
      });
      expect(database.prepare('SELECT * FROM fishing_world_state WHERE id = 1').get()).toEqual(
        before,
      );
      seaSnapshot(database, { now: () => now });
      updateTimeOverrideWithin(database, 'Dusk', now);
      expect(clockSnapshot(database, now)).toMatchObject({
        timeOfDay: 'Dusk',
        gameTime: { hour: 17, minute: 0 },
      });
      expect(clockSnapshot(database, now + 10_000)).toMatchObject({
        timeOfDay: 'Dusk',
        gameTime: { hour: 17, minute: 1 },
      });
      expect(clockSnapshot(database, now + 30 * 60_000)).toMatchObject({
        timeOfDay: 'Night',
        gameTime: { hour: 20, minute: 0 },
      });
      for (const [phase, hour] of [
        ['Dawn', 5],
        ['Day', 8],
        ['Night', 20],
      ] as const) {
        updateTimeOverrideWithin(database, phase, now);
        expect(seaSnapshot(database, { now: () => now }).gameTime).toMatchObject({
          hour,
          minute: 0,
        });
      }
      updateTimeOverrideWithin(database, null);
      expect(clockSnapshot(database, now).gameTime).toMatchObject({ hour: 1, minute: 0 });
    } finally {
      database.close();
    }
  });
  it('uses the exact cumulative matrix thresholds', () => {
    expect(rollNextSeaState('Calm', () => 0.599999)).toBe('Calm');
    expect(rollNextSeaState('Calm', () => 0.6)).toBe('Moderate');
    expect(rollNextSeaState('Calm', () => 0.999)).toBe('Moderate');
    expect(rollNextSeaState('Moderate', () => 0.249999)).toBe('Calm');
    expect(rollNextSeaState('Moderate', () => 0.25)).toBe('Moderate');
    expect(rollNextSeaState('Moderate', () => 0.799999)).toBe('Moderate');
    expect(rollNextSeaState('Moderate', () => 0.8)).toBe('Dangerous');
    expect(rollNextSeaState('Dangerous', () => 0.649999)).toBe('Moderate');
    expect(rollNextSeaState('Dangerous', () => 0.65)).toBe('Dangerous');
  });
  it('initializes once, retains forecast through final millisecond and promotes at :30', () => {
    const { database } = fixture();
    const first = seaSnapshot(database, { now: at('2026-09-24T12:12:00.000Z'), random: () => 0.9 });
    expect(first.sea).toMatchObject({
      scheduledCurrentState: 'Moderate',
      nextState: 'Dangerous',
      blockStartedAt: '2026-09-24T12:00:00.000Z',
    });
    expect(
      seaSnapshot(database, { now: at('2026-09-24T12:29:59.999Z'), random: () => 0 }),
    ).toMatchObject({
      sea: first.sea,
      conditions: first.conditions,
      serverTime: '2026-09-24T12:29:59.999Z',
    });
    const boundary = seaSnapshot(database, {
      now: at('2026-09-24T12:30:00.000Z'),
      random: () => 0.9,
    });
    expect(boundary.sea).toMatchObject({
      scheduledCurrentState: 'Dangerous',
      nextState: 'Dangerous',
      blockStartedAt: '2026-09-24T12:30:00.000Z',
    });
    expect(
      seaSnapshot(database, {
        now: at('2026-09-24T12:30:01.000Z'),
        random: () => {
          throw Error('rerolled');
        },
      }).sea,
    ).toEqual(boundary.sea);
    database.close();
  });
  it('recovers every missed block after reopen and preserves an override', () => {
    const { database, file } = fixture();
    const first = seaSnapshot(database, { now: at('2026-09-24T12:00:00.000Z'), random: () => 0 });
    database.exec('BEGIN IMMEDIATE');
    updateSeaOverrideWithin(database, 'Dangerous');
    database.exec('COMMIT');
    database.close();
    const reopened = openDatabase(file);
    seedDatabase(reopened);
    expect(readSchemaVersion(reopened)).toBe(SCHEMA_VERSION);
    expect(
      seaSnapshot(reopened, {
        now: at('2026-09-24T12:10:00.000Z'),
        random: () => {
          throw Error('rerolled');
        },
      }).sea,
    ).toEqual(first.sea);
    const recovered = seaSnapshot(reopened, {
      now: at('2026-09-24T13:00:00.000Z'),
      random: () => 0.9,
    });
    expect(recovered.sea).toMatchObject({
      blockStartedAt: '2026-09-24T13:00:00.000Z',
      scheduledCurrentState: 'Moderate',
      nextState: 'Dangerous',
    });
    expect(recovered.conditions.seaState).toBe('Dangerous');
    expect(recovered.overrideState).toBe('Dangerous');
    reopened.close();
  });
  it('rolls back an attempted advancement and rejects invalid persisted schedules or backward time', () => {
    const { database } = fixture();
    const first = seaSnapshot(database, { now: at('2026-09-24T12:01:00.000Z'), random: () => 0 });
    database.exec('BEGIN IMMEDIATE');
    seaSnapshotWithin(database, { now: at('2026-09-24T12:30:00.000Z'), random: () => 0.9 });
    database.exec('ROLLBACK');
    expect(seaSnapshot(database, { now: at('2026-09-24T12:02:00.000Z') }).sea).toEqual(first.sea);
    expect(() => seaSnapshot(database, { now: at('2026-09-24T11:59:00.000Z') })).toThrow('clock');
    database.prepare('UPDATE fishing_world_state SET sea_next_state = ? WHERE id = 1').run('Storm');
    expect(() => seaSnapshot(database, { now: at('2026-09-24T12:05:00.000Z') })).toThrow(
      'next sea',
    );
    database.close();
  });
  it('serializes an independent process at a boundary without rerolling its committed forecast', async () => {
    const { database, file } = fixture();
    seaSnapshot(database, { now: at('2026-09-24T12:10:00.000Z'), random: () => 0.9 });
    const worker = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `
      import { openDatabase } from './server/database.ts';
      import { seaSnapshotWithin } from './server/seaState.ts';
      const db = openDatabase(process.argv[1]);
      db.exec('BEGIN IMMEDIATE');
      seaSnapshotWithin(db, { now: () => Date.parse('2026-09-24T12:30:00.000Z'), random: () => 0.9 });
      process.stdout.write('LOCKED\\n');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
      db.exec('COMMIT');
      db.close();
    `,
        file,
      ],
      { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const exit = once(worker, 'exit');
    const ready = await Promise.race([
      once(worker.stdout!, 'data'),
      exit.then(() => {
        throw Error('Sea contention worker exited early.');
      }),
    ]);
    expect(String(ready[0])).toContain('LOCKED');
    const second = openDatabase(file);
    const observed = seaSnapshot(second, {
      now: at('2026-09-24T12:30:00.000Z'),
      random: () => {
        throw Error('second connection rerolled');
      },
    });
    expect(observed.sea).toMatchObject({
      scheduledCurrentState: 'Dangerous',
      nextState: 'Dangerous',
    });
    const [code] = await exit;
    expect(code).toBe(0);
    second.close();
    database.close();
  });
});
