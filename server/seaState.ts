import type { DatabaseSync } from 'node:sqlite';
import { fishingConfig, type SeaState, type TimeOfDay } from './fishingConfig.js';
import { effectiveGameTime, type GameTime } from './gameTime.js';

type WorldRow = {
  time_of_day: string;
  sea_state: string;
  sea_block_started_at: string | null;
  sea_next_state: string | null;
  sea_override_state: string | null;
  time_override_state: string | null;
  time_override_started_at: string | null;
};

export interface SeaSnapshot {
  serverTime: string;
  conditions: { timeOfDay: TimeOfDay; seaState: SeaState };
  sea: {
    zoneId: string;
    blockStartedAt: string;
    blockEndsAt: string;
    scheduledCurrentState: SeaState;
    nextState: SeaState;
  };
  gameTime: GameTime;
  overrideState: SeaState | null;
  timeOverrideState: TimeOfDay | null;
}

export type PublicWorldSnapshot = Pick<
  SeaSnapshot,
  'serverTime' | 'conditions' | 'sea' | 'gameTime'
>;

export const isSeaState = (value: unknown): value is SeaState =>
  typeof value === 'string' && Object.hasOwn(fishingConfig.conditions.seaState, value);

export function rollNextSeaState(current: SeaState, random: () => number): SeaState {
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error('Invalid sea RNG value.');
  let cumulative = 0;
  for (const state of ['Calm', 'Moderate', 'Dangerous'] as const) {
    cumulative += fishingConfig.seaTransitions[current][state];
    if (roll < cumulative) return state;
  }
  throw new Error('Invalid sea transition matrix.');
}

const canonicalTime = (value: string): number => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value)
    throw new Error('Invalid persisted sea block timestamp.');
  if (milliseconds % fishingConfig.seaBlockMs !== 0)
    throw new Error('Persisted sea block is not UTC aligned.');
  return milliseconds;
};

/** Caller already owns BEGIN IMMEDIATE. Never use this after a stale read. */
export function seaSnapshotWithin(
  database: DatabaseSync,
  options: { now?: () => number; random?: () => number } = {},
): SeaSnapshot {
  const nowMs = (options.now ?? Date.now)();
  if (!Number.isFinite(nowMs)) throw new Error('Invalid server clock.');
  const row = database.prepare('SELECT * FROM fishing_world_state WHERE id = 1').get() as
    WorldRow | undefined;
  if (!row) throw new Error('Fishing sea world row is missing.');
  if (!isSeaState(row.sea_state)) throw new Error('Invalid persisted sea state.');
  if (
    row.time_override_state !== null &&
    !Object.hasOwn(fishingConfig.conditions.timeOfDay, row.time_override_state)
  )
    throw new Error('Invalid persisted time override.');
  if ((row.time_override_state === null) !== (row.time_override_started_at === null))
    throw new Error('Incomplete persisted time override.');
  const timeOverrideStartedAt =
    row.time_override_started_at === null ? null : Date.parse(row.time_override_started_at);
  if (
    row.time_override_started_at !== null &&
    (timeOverrideStartedAt === null ||
      !Number.isFinite(timeOverrideStartedAt) ||
      new Date(timeOverrideStartedAt).toISOString() !== row.time_override_started_at)
  )
    throw new Error('Invalid persisted time override anchor.');
  if (row.sea_override_state !== null && !isSeaState(row.sea_override_state))
    throw new Error('Invalid persisted sea override.');
  if ((row.sea_block_started_at === null) !== (row.sea_next_state === null))
    throw new Error('Incomplete persisted sea schedule.');

  let started =
    row.sea_block_started_at === null
      ? Math.floor(nowMs / fishingConfig.seaBlockMs) * fishingConfig.seaBlockMs
      : canonicalTime(row.sea_block_started_at);
  if (nowMs < started) throw new Error('Server clock precedes persisted sea block.');
  let current: SeaState = row.sea_state;
  if (row.sea_next_state !== null && !isSeaState(row.sea_next_state))
    throw new Error('Invalid persisted next sea state.');
  let next: SeaState | null = row.sea_next_state;
  const random = options.random ?? Math.random;
  const gameTime = effectiveGameTime(
    nowMs,
    row.time_override_state as TimeOfDay | null,
    timeOverrideStartedAt,
  );
  if (next === null) next = rollNextSeaState(current, random);
  while (nowMs >= started + fishingConfig.seaBlockMs) {
    current = next;
    started += fishingConfig.seaBlockMs;
    next = rollNextSeaState(current, random);
  }
  if (
    row.sea_block_started_at === null ||
    row.sea_state !== current ||
    row.sea_next_state !== next
  ) {
    database
      .prepare(
        'UPDATE fishing_world_state SET sea_state = ?, sea_block_started_at = ?, sea_next_state = ? WHERE id = 1',
      )
      .run(current, new Date(started).toISOString(), next);
  }
  return {
    serverTime: new Date(nowMs).toISOString(),
    conditions: {
      timeOfDay: gameTime.scheduledPhase,
      seaState: row.sea_override_state ?? current,
    },
    sea: {
      zoneId: fishingConfig.pierId,
      blockStartedAt: new Date(started).toISOString(),
      blockEndsAt: new Date(started + fishingConfig.seaBlockMs).toISOString(),
      scheduledCurrentState: current,
      nextState: next,
    },
    gameTime,
    overrideState: row.sea_override_state,
    timeOverrideState: row.time_override_state as TimeOfDay | null,
  };
}

export function seaSnapshot(
  database: DatabaseSync,
  options: { now?: () => number; random?: () => number } = {},
): SeaSnapshot {
  database.exec('BEGIN IMMEDIATE');
  try {
    const snapshot = seaSnapshotWithin(database, options);
    database.exec('COMMIT');
    return snapshot;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function clockSnapshot(database: DatabaseSync, nowMs = Date.now()) {
  const row = database
    .prepare(
      'SELECT time_override_state, time_override_started_at FROM fishing_world_state WHERE id = 1',
    )
    .get() as
    { time_override_state: TimeOfDay | null; time_override_started_at: string | null } | undefined;
  const gameTime = effectiveGameTime(
    nowMs,
    row?.time_override_state ?? null,
    row?.time_override_started_at ? Date.parse(row.time_override_started_at) : null,
  );
  return {
    serverTime: new Date(nowMs).toISOString(),
    gameTime,
    timeOfDay: gameTime.scheduledPhase,
  };
}

export function updateSeaOverrideWithin(database: DatabaseSync, value: SeaState | null): void {
  database.prepare('UPDATE fishing_world_state SET sea_override_state = ? WHERE id = 1').run(value);
}

export function updateTimeOverrideWithin(
  database: DatabaseSync,
  value: TimeOfDay | null,
  nowMs = Date.now(),
): void {
  database
    .prepare(
      'UPDATE fishing_world_state SET time_override_state = ?, time_override_started_at = ? WHERE id = 1',
    )
    .run(value, value === null ? null : new Date(nowMs).toISOString());
}
