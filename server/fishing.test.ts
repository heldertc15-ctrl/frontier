// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccount, createSession } from './auth.js';
import { createCharacter, getCharacter } from './character.js';
import { createRequestHandler } from './app.js';
import { openDatabase, seedDatabase } from './database.js';
import {
  adminInventoryMutation,
  fishingState,
  fishingPreview,
  forceFishing,
  overrideConditions,
  resetFishingAfterRestart,
  resetFishDiscoveries,
  resolveAttempt,
  startFishing,
  stopFishing,
  tickFishing,
  touchFishing,
} from './fishing.js';
import { fishingConfig } from './fishingConfig.js';
import { formatFishWeightKg } from './fishWeightFormat.js';
import {
  calculateFishing,
  fishingAttemptDurationMs,
  speciesSharePercent,
} from './fishingCalculation.js';
import { getInventory, transferItem } from './inventory.js';
import {
  fishWeightPosition,
  isTrophy,
  sampleFishWeight,
  sampleTrophyWeight,
  weightAtPercentile,
} from './fishSpecimens.js';
import { navigateLocation } from './locations.js';

const directories: string[] = [];
const neutralAttemptTiming = structuredClone(fishingConfig.attemptTiming);
function mutate(
  database: ReturnType<typeof openDatabase>,
  accountId: string,
  input: Record<string, unknown>,
) {
  return adminInventoryMutation(database, accountId, 'operator', {
    ...input,
    requestKey: randomUUID(),
  });
}
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
  delete process.env.FRONTIER_ADMIN_USERNAMES;
  vi.restoreAllMocks();
  vi.useRealTimers();
  Object.assign(
    fishingConfig.attemptTiming.rodDurationMultipliers,
    neutralAttemptTiming.rodDurationMultipliers,
  );
  Object.assign(
    fishingConfig.attemptTiming.timeOfDayDurationMultipliers,
    neutralAttemptTiming.timeOfDayDurationMultipliers,
  );
  Object.assign(
    fishingConfig.attemptTiming.seaStateDurationMultipliers,
    neutralAttemptTiming.seaStateDurationMultipliers,
  );
});
function setup() {
  const directory = mkdtempSync(path.join(tmpdir(), 'frontier-fishing-'));
  directories.push(directory);
  const database = openDatabase(path.join(directory, 'game.sqlite'));
  seedDatabase(database);
  const account = createAccount(database, 'fisher', 'test-password');
  const person = createCharacter(database, account.id, 'Test Fisher');
  database.prepare('DELETE FROM character_items WHERE character_id = ?').run(person.id);
  const add = (definitionId: string, quantity = 1) => {
    const result = mutate(database, account.id, { action: 'add', definitionId, quantity });
    expect(result).toEqual({ inventoryChanged: true });
    return getInventory(database, account.id)!
      .items.filter((item) => item.id === definitionId)
      .at(-1)!;
  };
  const pier = () => {
    expect(navigateLocation(database, account.id, 'harbor')).toHaveProperty('state');
    expect(navigateLocation(database, account.id, 'fishing-pier')).toHaveProperty('state');
  };
  const start = (rodId: string, baitId: string) => {
    const result = startFishing(database, account.id, rodId, baitId);
    expect(result).toHaveProperty('state');
    return fishingState(database, account.id)!.sessionId!;
  };
  const traces = () =>
    database
      .prepare('SELECT trace_json FROM fishing_attempts ORDER BY rowid')
      .all()
      .map((entry) => JSON.parse(String(entry.trace_json))) as Array<Record<string, unknown>>;
  return {
    database,
    databasePath: path.join(directory, 'game.sqlite'),
    account,
    person,
    add,
    pier,
    start,
    traces,
  };
}

describe('A01 server-authoritative fishing', () => {
  it('uses the expanded pool for an awarded Swordfish and excludes it after a day override', () => {
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('heavy_game_fishing_rod');
    const bait = add('squid_bait', 2);
    pier();
    overrideConditions(database, { timeOfDay: 'Night', seaState: 'Dangerous' });
    const night = fishingPreview(database, account.id, rod.instanceId, bait.instanceId);
    if (!('preview' in night) || !night.preview) throw Error('Expected night preview');
    expect(night.preview.possibleSpecies.map((species) => species.id)).toContain('swordfish');
    const sessionId = start(rod.instanceId, bait.instanceId);
    const rolls = [0, 0.999, 0.5];
    resolveAttempt(database, sessionId, { forceSuccess: true, random: () => rolls.shift() ?? 0 });
    expect(traces().at(-1)?.species).toBe('swordfish');
    expect(getInventory(database, account.id)?.items.some((item) => item.id === 'swordfish')).toBe(
      true,
    );
    overrideConditions(database, { timeOfDay: 'Day' });
    const day = fishingPreview(database, account.id, rod.instanceId, bait.instanceId);
    if (!('preview' in day) || !day.preview) throw Error('Expected day preview');
    expect(day.preview.possibleSpecies.map((species) => species.id)).not.toContain('swordfish');
    database.close();
  });
  it('keeps every rod and condition timing neutral without reusing catch-chance modifiers', () => {
    for (const rod of ['basic_fishing_rod', 'reinforced_fishing_rod'] as const)
      for (const timeOfDay of ['Dawn', 'Day', 'Dusk', 'Night'] as const)
        for (const seaState of ['Calm', 'Moderate', 'Dangerous'] as const)
          expect(fishingAttemptDurationMs(rod, { timeOfDay, seaState })).toBe(30_000);
    expect(
      calculateFishing('basic_fishing_rod', 'worm_bait', {
        timeOfDay: 'Night',
        seaState: 'Dangerous',
      }).probability,
    ).toBeCloseTo(0.2 * 0.95 * 0.85);
  });

  it('preserves the scheduled attempt through polling, repeated start, and a second database connection', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00.000Z'));
    const { database, databasePath, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 3);
    pier();
    expect(fishingState(database, account.id)?.activeAttempt).toBeNull();
    const sessionId = start(rod.instanceId, bait.instanceId);
    const activeAttempt = {
      startedAt: '2026-09-26T12:00:00.000Z',
      deadlineAt: '2026-09-26T12:00:30.000Z',
      durationMs: 30_000,
    };
    expect(fishingState(database, account.id)).toMatchObject({ sessionId, activeAttempt });
    vi.setSystemTime(new Date('2026-09-26T12:00:25.000Z'));
    expect(touchFishing(database, account.id)).toMatchObject({
      serverTime: '2026-09-26T12:00:25.000Z',
      activeAttempt,
      attempts: 0,
      baitRemaining: 3,
    });
    expect(startFishing(database, account.id, rod.instanceId, bait.instanceId)).toMatchObject({
      state: { activeAttempt, sessionId, attempts: 0 },
    });
    const secondConnection = openDatabase(databasePath);
    expect(touchFishing(secondConnection, account.id)?.activeAttempt).toEqual(activeAttempt);
    resolveAttempt(secondConnection, sessionId, { scheduled: true, random: () => 0 });
    expect(fishingState(secondConnection, account.id)).toMatchObject({
      attempts: 0,
      baitRemaining: 3,
      activeAttempt,
    });
    secondConnection.close();
    database.close();
  });

  it('rejects invalid timing configuration without consuming bait or committing a partial attempt', () => {
    const { database, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 3);
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    const before = fishingState(database, account.id)!;
    Object.assign(fishingConfig.attemptTiming.rodDurationMultipliers, { basic_fishing_rod: 0 });
    expect(() => resolveAttempt(database, sessionId, { random: () => 0 })).toThrow('positive');
    expect(fishingState(database, account.id)).toMatchObject({
      attempts: 0,
      baitRemaining: 3,
      catches: 0,
      latestCatch: null,
      activeAttempt: before.activeAttempt,
    });
    expect(getInventory(database, account.id)?.items.some((item) => item.id === 'sardine')).toBe(
      false,
    );
    expect(database.prepare('SELECT count(*) AS count FROM fishing_attempts').get()).toMatchObject({
      count: 0,
    });
    database.close();
  });

  it('fixes configurable rod/condition timing at scheduling while catch chance uses resolution conditions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00.000Z'));
    Object.assign(fishingConfig.attemptTiming.rodDurationMultipliers, { basic_fishing_rod: 0.5 });
    Object.assign(fishingConfig.attemptTiming.timeOfDayDurationMultipliers, { Day: 2, Night: 2 });
    Object.assign(fishingConfig.attemptTiming.seaStateDurationMultipliers, {
      Calm: 0.5,
      Dangerous: 2,
    });
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 3);
    pier();
    overrideConditions(database, { timeOfDay: 'Day', seaState: 'Calm' });
    const sessionId = start(rod.instanceId, bait.instanceId);
    const first = fishingState(database, account.id)!.activeAttempt;
    expect(first).toEqual({
      startedAt: '2026-09-26T12:00:00.000Z',
      deadlineAt: '2026-09-26T12:00:15.000Z',
      durationMs: 15_000,
    });
    vi.setSystemTime(new Date('2026-09-26T12:00:10.000Z'));
    overrideConditions(database, { timeOfDay: 'Night', seaState: 'Dangerous' });
    expect(touchFishing(database, account.id)?.activeAttempt).toEqual(first);
    vi.setSystemTime(new Date('2026-09-26T12:00:15.000Z'));
    resolveAttempt(database, sessionId, { scheduled: true, random: () => 0.99 });
    expect(traces()[0]).toMatchObject({
      attemptStartedAt: first!.startedAt,
      attemptDeadlineAt: first!.deadlineAt,
      attemptDurationMs: 15_000,
      conditions: { timeOfDay: 'Night', seaState: 'Dangerous' },
      success: false,
    });
    expect(traces()[0].finalProbability).toBeCloseTo(0.2 * 0.95 * 0.85);
    expect(fishingState(database, account.id)).toMatchObject({
      attempts: 1,
      baitRemaining: 2,
      latestResult: 'No catch.',
      activeAttempt: {
        startedAt: '2026-09-26T12:00:15.000Z',
        deadlineAt: '2026-09-26T12:01:15.000Z',
        durationMs: 60_000,
      },
    });
    database.close();
  });

  it('starts one fresh authoritative cycle after forced and unsuccessful attempts while retaining the latest catch', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00.000Z'));
    const { database, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 4);
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    vi.setSystemTime(new Date('2026-09-26T12:00:10.000Z'));
    forceFishing(database, account.id, 'operator', 'timing-force-1', true, 0);
    const forced = fishingState(database, account.id)!;
    expect(forced).toMatchObject({
      attempts: 1,
      catches: 1,
      baitRemaining: 3,
      activeAttempt: {
        startedAt: '2026-09-26T12:00:10.000Z',
        deadlineAt: '2026-09-26T12:00:40.000Z',
        durationMs: 30_000,
      },
    });
    vi.setSystemTime(new Date('2026-09-26T12:00:30.000Z'));
    touchFishing(database, account.id);
    forceFishing(database, account.id, 'operator', 'timing-force-1', true, 0);
    expect(fishingState(database, account.id)?.activeAttempt).toEqual(forced.activeAttempt);
    vi.setSystemTime(new Date('2026-09-26T12:00:40.000Z'));
    resolveAttempt(database, sessionId, { scheduled: true, random: () => 0.99 });
    const failed = fishingState(database, account.id)!;
    expect(failed).toMatchObject({
      attempts: 2,
      catches: 1,
      baitRemaining: 2,
      latestResult: 'No catch.',
      latestCatch: forced.latestCatch,
      activeAttempt: {
        startedAt: '2026-09-26T12:00:40.000Z',
        deadlineAt: '2026-09-26T12:01:10.000Z',
        durationMs: 30_000,
      },
    });
    forceFishing(database, account.id, 'operator', 'timing-stale-count', true, 1);
    resolveAttempt(database, sessionId, { scheduled: true, random: () => 0 });
    expect(fishingState(database, account.id)?.activeAttempt).toEqual(failed.activeAttempt);
    expect(fishingState(database, account.id)?.attempts).toBe(2);
    database.close();
  });

  it('clears public timing after manual stop, final bait, expired reconnect, and server restart without replaying attempts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00.000Z'));
    const { database, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 2);
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    stopFishing(database, account.id);
    resolveAttempt(database, sessionId, { random: () => 0 });
    expect(fishingState(database, account.id)).toMatchObject({
      status: 'stopped',
      activeAttempt: null,
      attempts: 0,
      baitRemaining: 2,
    });
    start(rod.instanceId, bait.instanceId);
    vi.setSystemTime(new Date('2026-09-26T12:02:00.000Z'));
    expect(touchFishing(database, account.id)).toMatchObject({
      status: 'stopped',
      activeAttempt: null,
      attempts: 0,
      baitRemaining: 2,
      stopReason: 'Fishing stopped: session inactive.',
    });
    start(rod.instanceId, bait.instanceId);
    resetFishingAfterRestart(database);
    tickFishing(database);
    expect(fishingState(database, account.id)).toMatchObject({
      status: 'stopped',
      activeAttempt: null,
      attempts: 0,
      baitRemaining: 2,
    });
    const finalSession = start(rod.instanceId, bait.instanceId);
    resolveAttempt(database, finalSession, { random: () => 0.99 });
    resolveAttempt(database, finalSession, { random: () => 0.99 });
    expect(fishingState(database, account.id)).toMatchObject({
      status: 'stopped',
      activeAttempt: null,
      attempts: 2,
      baitRemaining: 0,
      stopReason: 'Fishing stopped: bait depleted.',
    });
    database.close();
  });

  it('backfills legacy timing from the saved deadline without changing results or rescheduling it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00.000Z'));
    const { database, databasePath, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 3);
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    resolveAttempt(database, sessionId, { random: () => 0 });
    database
      .prepare(
        'UPDATE fishing_sessions SET attempt_started_at = ?, next_attempt_at = ?, attempt_duration_ms = 60000 WHERE id = ?',
      )
      .run('2026-09-26T12:00:00.000Z', '2026-09-26T12:01:00.000Z', sessionId);
    const before = fishingState(database, account.id)!;
    database.exec('ALTER TABLE fishing_sessions DROP COLUMN attempt_started_at');
    database.exec('ALTER TABLE fishing_sessions DROP COLUMN attempt_duration_ms');
    database.close();
    vi.setSystemTime(new Date('2026-09-26T12:00:20.000Z'));
    const reopened = openDatabase(databasePath);
    expect(touchFishing(reopened, account.id)).toMatchObject({
      sessionId,
      activeAttempt: before.activeAttempt,
      attempts: 1,
      baitRemaining: 2,
      latestCatch: before.latestCatch,
    });
    reopened.close();
  });

  it.each([
    [0.0913, '0.091'],
    [9.999, '9.999'],
    [9.9999, '10.00'],
    [10, '10.00'],
    [42.123, '42.12'],
    [242.456, '242.46'],
  ])('formats %s kg for its displayed magnitude', (weight, expected) => {
    expect(formatFishWeightKg(weight)).toBe(expected);
  });
  it('uses a 20% Basic Rod chance with retained condition multipliers', () => {
    expect(fishingConfig.rods.basic_fishing_rod).toBe(0.2);
    expect(
      calculateFishing('basic_fishing_rod', 'worm_bait', { timeOfDay: 'Dawn', seaState: 'Calm' })
        .probability,
    ).toBeCloseTo(0.2 * 1.05 * 1.05);
    expect(
      calculateFishing('reinforced_fishing_rod', 'worm_bait', {
        timeOfDay: 'Night',
        seaState: 'Dangerous',
      }).probability,
    ).toBeCloseTo(0.4 * 0.95 * 0.85);
  });

  it('caps bait at 120 and stops after the selected last bait without switching stacks', () => {
    const { database, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    add('worm_bait', 121);
    const stacks = getInventory(database, account.id)!.items.filter(
      (item) => item.id === 'worm_bait',
    );
    expect(stacks.map((item) => item.quantity).sort((a, b) => a - b)).toEqual([1, 120]);
    const selectedBait = stacks.find((item) => item.quantity === 1)!;
    const reserveBait = stacks.find((item) => item.quantity === 120)!;
    pier();
    const sessionId = start(rod.instanceId, selectedBait.instanceId);
    resolveAttempt(database, sessionId, { forceSuccess: true, random: () => 0 });
    expect(fishingState(database, account.id)).toMatchObject({
      status: 'stopped',
      attempts: 1,
      catches: 1,
      baitRemaining: 0,
      stopReason: 'Fishing stopped: bait depleted.',
    });
    expect(
      getInventory(database, account.id)!.items.find(
        (item) => item.instanceId === reserveBait.instanceId,
      )?.quantity,
    ).toBe(120);
    resolveAttempt(database, sessionId, { forceSuccess: true, random: () => 0 });
    expect(fishingState(database, account.id)?.attempts).toBe(1);
    database.close();
  });

  it('summarizes awarded fish by species from the completed session after a manual stop and reload', () => {
    const { database, databasePath, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 4);
    pier();
    overrideConditions(database, { timeOfDay: 'Day', seaState: 'Calm' });
    const sessionId = start(rod.instanceId, bait.instanceId);
    for (const rolls of [
      [0, 0, 0],
      [0, 0.7, 0],
      [0, 0.9, 0.5],
    ]) {
      const values = [...rolls];
      resolveAttempt(database, sessionId, {
        forceSuccess: true,
        forceTrophy: rolls[1] === 0.9,
        random: () => values.shift() ?? 0,
      });
    }
    expect(fishingState(database, account.id)).toMatchObject({
      status: 'active',
      catches: 3,
      catchSummary: [
        { species: 'Mackerel', count: 1, trophyCount: 0 },
        { species: 'Red Mullet', count: 1, trophyCount: 1 },
        { species: 'Sardine', count: 1, trophyCount: 0 },
      ],
    });
    const result = stopFishing(database, account.id);
    expect(result).toHaveProperty('state');
    expect(fishingState(database, account.id)).toMatchObject({
      status: 'stopped',
      catches: 3,
      catchSummary: [
        { species: 'Mackerel', count: 1, trophyCount: 0 },
        { species: 'Red Mullet', count: 1, trophyCount: 1 },
        { species: 'Sardine', count: 1, trophyCount: 0 },
      ],
    });
    database.close();
    const reopened = openDatabase(databasePath);
    expect(fishingState(reopened, account.id)?.catchSummary).toHaveLength(3);
    reopened.close();
  });

  it('fills a partial fish stack before creating another and preserves individual specimens through transfers', () => {
    const { database, databasePath, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 12);
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    for (let index = 0; index < 11; index++) {
      const rolls = [0, 0, index / 11];
      resolveAttempt(database, sessionId, { random: () => rolls.shift() ?? 0 });
    }
    const stacks = getInventory(database, account.id)!.items.filter(
      (item) => item.id === 'sardine',
    );
    expect(stacks.map((item) => item.quantity).sort((a, b) => a - b)).toEqual([1, 10]);
    const fullStack = stacks.find((item) => item.quantity === 10)!;
    const identities = stacks.flatMap((item) => item.specimens!.map((specimen) => specimen.id));
    const weights = new Map(
      stacks.flatMap((item) =>
        item.specimens!.map((specimen) => [specimen.id, specimen.weightKg] as const),
      ),
    );
    expect(new Set(identities).size).toBe(11);
    expect(fullStack.specimens!.map((specimen) => specimen.weightKg)).toHaveLength(10);
    expect(transferItem(database, account.id, fullStack.instanceId, 'locker', 4)).toHaveProperty(
      'state',
    );
    const changed = getInventory(database, account.id)!;
    expect(changed.items.find((item) => item.instanceId === fullStack.instanceId)?.quantity).toBe(
      6,
    );
    expect(changed.locker.find((item) => item.id === 'sardine')?.quantity).toBe(4);
    expect(
      new Set(
        [...changed.items, ...changed.locker]
          .filter((item) => item.id === 'sardine')
          .flatMap((item) => item.specimens!.map((specimen) => specimen.id)),
      ),
    ).toEqual(new Set(identities));
    database.close();
    const reopened = openDatabase(databasePath);
    const persisted = getInventory(reopened, account.id)!;
    expect(
      new Set(
        [...persisted.items, ...persisted.locker]
          .filter((item) => item.id === 'sardine')
          .flatMap((item) => item.specimens!.map((specimen) => specimen.id)),
      ),
    ).toEqual(new Set(identities));
    for (const specimen of [...persisted.items, ...persisted.locker]
      .filter((item) => item.id === 'sardine')
      .flatMap((item) => item.specimens!))
      expect(specimen.weightKg).toBe(weights.get(specimen.id));
    const lockerStack = persisted.locker.find((item) => item.id === 'sardine')!;
    expect(
      transferItem(reopened, account.id, lockerStack.instanceId, 'inventory', 4),
    ).toHaveProperty('state');
    const merged = getInventory(reopened, account.id)!;
    expect(merged.locker.filter((item) => item.id === 'sardine')).toHaveLength(0);
    expect(
      merged.items
        .filter((item) => item.id === 'sardine')
        .reduce((sum, item) => sum + item.quantity, 0),
    ).toBe(11);
    const removalTarget = merged.items.find((item) => item.id === 'sardine' && item.quantity >= 2)!;
    expect(
      mutate(reopened, account.id, {
        action: 'remove',
        itemId: removalTarget.instanceId,
        quantity: 2,
      }),
    ).toEqual({ inventoryChanged: true });
    const afterRemoval = getInventory(reopened, account.id)!.items.filter(
      (item) => item.id === 'sardine',
    );
    expect(afterRemoval.reduce((sum, item) => sum + item.quantity, 0)).toBe(9);
    expect(afterRemoval.reduce((sum, item) => sum + item.specimens!.length, 0)).toBe(9);
    reopened.close();
  });

  it('stops on a full inventory only when no partial stack or newly freed bait slot can hold the catch', () => {
    const { database, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 2);
    add('sardine', 10);
    for (let index = 0; index < 7; index++) add('basic_toolkit');
    expect(getInventory(database, account.id)?.usedSlots).toBe(10);
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    resolveAttempt(database, sessionId, { forceSuccess: true, random: () => 0 });
    expect(fishingState(database, account.id)).toMatchObject({
      status: 'stopped',
      stopReason: 'Fishing stopped: inventory full.',
      activeAttempt: null,
      baitRemaining: 1,
      catches: 0,
    });
    expect(
      getInventory(database, account.id)!.items.find((item) => item.id === 'sardine')?.quantity,
    ).toBe(10);
    database.close();

    const second = setup();
    const secondRod = second.add('basic_fishing_rod');
    const lastBait = second.add('worm_bait', 1);
    for (let index = 0; index < 8; index++) second.add('basic_toolkit');
    second.pier();
    const secondSession = second.start(secondRod.instanceId, lastBait.instanceId);
    resolveAttempt(second.database, secondSession, { forceSuccess: true, random: () => 0 });
    expect(second.traces()[0].inventoryResult).toMatchObject({ action: 'new stack', slots: 10 });
    expect(
      second.database.prepare('SELECT count(*) AS count FROM fish_specimens').get(),
    ).toMatchObject({ count: 1 });
    second.database.close();
  });

  it('samples ordinary sizes more often and classifies the distribution top five percent as Trophy', () => {
    const low = weightAtPercentile('bluefin_tuna', 0.95);
    expect(low).toBeLessThan(239);
    expect(fishWeightPosition('bluefin_tuna', 30)).toBe(0);
    expect(fishWeightPosition('bluefin_tuna', 250)).toBe(1);
    expect(fishWeightPosition('bluefin_tuna', 200)).toBeCloseTo(170 / 220);
    let ordinaryInterval = 0;
    let extremeInterval = 0;
    let trophies = 0;
    for (let index = 0; index < 100_000; index++) {
      const weight = sampleFishWeight('bluefin_tuna', (index + 0.5) / 100_000);
      if (weight >= 199.5 && weight < 200.5) ordinaryInterval++;
      if (weight >= 249 && weight < 250) extremeInterval++;
      if (isTrophy('bluefin_tuna', weight)) trophies++;
    }
    expect(ordinaryInterval).toBeGreaterThan(extremeInterval * 2);
    expect(trophies / 100_000).toBeCloseTo(0.05, 2);
    for (const species of ['sardine', 'mackerel'] as const) {
      let speciesTrophies = 0;
      for (let index = 0; index < 100_000; index++)
        if (isTrophy(species, sampleFishWeight(species, (index + 0.5) / 100_000)))
          speciesTrophies++;
      expect(speciesTrophies / 100_000).toBeCloseTo(0.05, 2);
    }
    for (const species of ['sardine', 'mackerel', 'bluefin_tuna'] as const)
      for (const roll of [0, 0.5, 0.999999])
        expect(isTrophy(species, sampleTrophyWeight(species, roll))).toBe(true);
  });

  it('forces a Trophy through the authorized attempt path without bypassing bait or idempotency', () => {
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 2);
    pier();
    start(rod.instanceId, bait.instanceId);
    expect(
      forceFishing(database, account.id, 'operator', 'force-trophy-1', false, 0, true),
    ).toHaveProperty('state');
    const trace = traces()[0];
    expect(trace).toMatchObject({
      forced: true,
      forceSuccess: false,
      forceTrophy: true,
      success: true,
      baitBefore: 2,
      baitAfter: 1,
    });
    const species = trace.species as keyof typeof fishingConfig.weightsKg;
    expect(isTrophy(species, trace.weightKg as number)).toBe(true);
    const specimen = getInventory(database, account.id)!.items.find((item) => item.id === species)!
      .specimens![0];
    expect(specimen.trophy).toBe(true);
    expect(specimen.weightKg).toBe(trace.weightKg);
    expect(fishingState(database, account.id)?.latestCatch).toMatchObject({
      weightKg: specimen.weightKg,
      trophy: true,
    });
    const latestCatch = fishingState(database, account.id)!.latestCatch!;
    expect(fishingState(database, account.id)?.latestResult).toBe(
      `Caught ${latestCatch.species} (${formatFishWeightKg(latestCatch.weightKg)} kg).`,
    );
    database
      .prepare('UPDATE fishing_sessions SET latest_result = ? WHERE id = ?')
      .run(
        `Caught ${latestCatch.species} (${latestCatch.weightKg.toFixed(2)} kg).`,
        fishingState(database, account.id)!.sessionId!,
      );
    expect(fishingState(database, account.id)?.latestResult).toBe(
      `Caught ${latestCatch.species} (${formatFishWeightKg(latestCatch.weightKg)} kg).`,
    );
    expect(
      forceFishing(database, account.id, 'operator', 'force-trophy-1', false, 0, true),
    ).toHaveProperty('state');
    expect(traces()).toHaveLength(1);
    expect(fishingState(database, account.id)?.baitRemaining).toBe(1);
    expect(
      forceFishing(database, account.id, 'operator', 'invalid-trophy', false, 1, 'yes'),
    ).toMatchObject({ error: 'VALIDATION_ERROR' });
    database.close();
  });

  it.each([
    ['sardine', 0],
    ['mackerel', 0.7],
    ['red_mullet', 0.9],
  ] as const)(
    'returns the authoritative latest %s Trophy distinction through stop and persistence recovery',
    (species, speciesRoll) => {
      const { database, databasePath, account, add, pier, start } = setup();
      const rod = add('basic_fishing_rod');
      const bait = add('worm_bait', 4);
      pier();
      overrideConditions(database, { timeOfDay: 'Day', seaState: 'Calm' });
      const sessionId = start(rod.instanceId, bait.instanceId);
      const ordinaryRolls = [0, speciesRoll, 0.5];
      resolveAttempt(database, sessionId, { random: () => ordinaryRolls.shift() ?? 0 });
      expect(fishingState(database, account.id)?.latestCatch).toMatchObject({
        weightKg: sampleFishWeight(species, 0.5),
        trophy: false,
      });
      const trophyRolls = [0, speciesRoll, 0.975];
      resolveAttempt(database, sessionId, { random: () => trophyRolls.shift() ?? 0 });
      const latestCatch = fishingState(database, account.id)!.latestCatch!;
      const specimen = getInventory(database, account.id)!
        .items.find((item) => item.id === species)!
        .specimens!.find((entry) => entry.trophy)!;
      expect(latestCatch).toEqual({
        species: getInventory(database, account.id)!.items.find((item) => item.id === species)!
          .name,
        weightKg: specimen.weightKg,
        trophy: specimen.trophy,
      });
      expect(latestCatch.trophy).toBe(true);
      resolveAttempt(database, sessionId, { random: () => 1 });
      expect(fishingState(database, account.id)?.latestCatch).toEqual(latestCatch);
      expect(stopFishing(database, account.id)).toHaveProperty('state');
      expect(fishingState(database, account.id)?.latestCatch).toEqual(latestCatch);
      database.close();

      const reopened = openDatabase(databasePath);
      resetFishingAfterRestart(reopened);
      expect(fishingState(reopened, account.id)).toMatchObject({
        status: 'stopped',
        latestCatch,
      });
      reopened.close();
    },
  );

  it('keeps legacy unknown species readable without awarding a Trophy distinction', () => {
    const { database, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait');
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    database
      .prepare('UPDATE fishing_sessions SET latest_species = ?, latest_weight_kg = ? WHERE id = ?')
      .run('legacy_unknown_fish', 99, sessionId);
    expect(fishingState(database, account.id)?.latestCatch).toEqual({
      species: 'legacy_unknown_fish',
      weightKg: 99,
      trophy: false,
    });
    database
      .prepare('UPDATE fishing_sessions SET latest_weight_kg = NULL WHERE id = ?')
      .run(sessionId);
    expect(fishingState(database, account.id)?.latestCatch).toBeNull();
    database.close();
  });

  it('migrates legacy fish without loss, retaining trace weights and explicitly unknown remainder', () => {
    const { database, databasePath, account, person, add } = setup();
    const fish = add('sardine');
    for (let index = 0; index < 9; index++) add('basic_toolkit');
    database.prepare('UPDATE character_items SET quantity = 25 WHERE id = ?').run(fish.instanceId);
    database.prepare('DELETE FROM fish_specimens WHERE stack_id = ?').run(fish.instanceId);
    const timestamp = new Date().toISOString();
    const sessionId = randomUUID();
    database
      .prepare(
        `INSERT INTO fishing_sessions (id, character_id, status, rod_item_id, bait_item_id, started_at, last_seen_at, next_attempt_at)
      VALUES (?, ?, 'stopped', 'old-rod', 'old-bait', ?, ?, ?)`,
      )
      .run(sessionId, person.id, timestamp, timestamp, timestamp);
    database
      .prepare(
        'INSERT INTO fishing_attempts (id, session_id, sequence, trace_json, created_at) VALUES (?, ?, 1, ?, ?)',
      )
      .run(
        randomUUID(),
        sessionId,
        JSON.stringify({
          species: 'sardine',
          weightKg: 0.121,
          inventoryResult: { action: 'new stack' },
        }),
        timestamp,
      );
    database.prepare("DELETE FROM app_metadata WHERE key = 'fish_specimen_migration'").run();
    database.close();
    const migrated = openDatabase(databasePath);
    const state = getInventory(migrated, account.id)!;
    expect(state.usedSlots).toBe(10);
    expect(
      state.items.filter((item) => item.id === 'sardine').map((item) => item.quantity),
    ).toEqual([10]);
    expect(
      state.locker
        .filter((item) => item.id === 'sardine')
        .map((item) => item.quantity)
        .sort((a, b) => a - b),
    ).toEqual([5, 10]);
    const specimens = [...state.items, ...state.locker]
      .filter((item) => item.id === 'sardine')
      .flatMap((item) => item.specimens!);
    expect(specimens).toHaveLength(25);
    expect(specimens.filter((entry) => entry.weightKg === 0.121)).toHaveLength(1);
    expect(specimens.filter((entry) => entry.weightKg === null)).toHaveLength(24);
    const report = migrated
      .prepare("SELECT value FROM app_metadata WHERE key = 'fish_specimen_migration'")
      .get() as { value: string };
    expect(JSON.parse(report.value)).toEqual({
      recoveredWeights: 1,
      unknownWeights: 24,
      movedToLocker: 15,
    });
    migrated.close();
    const reopened = openDatabase(databasePath);
    expect(reopened.prepare('SELECT count(*) AS count FROM fish_specimens').get()).toMatchObject({
      count: 25,
    });
    reopened.close();
  });
  it('records only awarded fish discoveries and resets only the operator character', () => {
    const { database, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 3);
    pier();
    const before = fishingPreview(database, account.id, rod.instanceId, bait.instanceId);
    if (!('preview' in before) || !before.preview) throw Error('Expected preview');
    expect(before.preview.possibleSpecies.map((species) => species.discovered)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(
      before.preview.possibleSpecies.every((species) => !('catchSharePercent' in species)),
    ).toBe(true);
    const sessionId = start(rod.instanceId, bait.instanceId);
    resolveAttempt(database, sessionId, { forceSuccess: true, random: () => 0 });
    const after = fishingPreview(database, account.id, rod.instanceId, bait.instanceId);
    if (!('preview' in after) || !after.preview) throw Error('Expected preview');
    expect(after.preview.possibleSpecies.map((species) => species.discovered)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    const weights = calculateFishing(
      'basic_fishing_rod',
      'worm_bait',
      after.preview.conditions,
    ).speciesWeights;
    expect(after.preview.possibleSpecies[0].catchSharePercent).toBeCloseTo(
      speciesSharePercent(weights, 'sardine'),
    );
    expect(
      after.preview.possibleSpecies.slice(1).every((species) => !('catchSharePercent' in species)),
    ).toBe(true);
    expect(after.preview.possibleSpecies[0].catchSharePercent).toBeLessThan(
      (weights.sardine! / (weights.sardine! + weights.mackerel!)) * 100,
    );
    const other = createAccount(database, 'other-fisher', 'test-password');
    const otherCharacter = createCharacter(database, other.id, 'Other Fisher');
    database
      .prepare(
        'INSERT INTO character_discovered_fish (character_id, species_id, discovered_at) VALUES (?, ?, ?)',
      )
      .run(otherCharacter.id, 'mackerel', new Date().toISOString());
    expect(resetFishDiscoveries(database, account.id, 'operator')).toEqual({ removed: 1 });
    expect(resetFishDiscoveries(database, account.id, 'operator')).toEqual({ removed: 0 });
    const reset = fishingPreview(database, account.id, rod.instanceId, bait.instanceId);
    if (!('preview' in reset) || !reset.preview) throw Error('Expected preview');
    expect(reset.preview.possibleSpecies.map((species) => species.discovered)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(
      database
        .prepare('SELECT species_id FROM character_discovered_fish WHERE character_id = ?')
        .get(otherCharacter.id),
    ).toMatchObject({ species_id: 'mackerel' });
    expect(
      getInventory(database, account.id)?.items.find((item) => item.id === 'sardine')?.quantity,
    ).toBe(1);
    database.close();
  });
  it('previews carried selections without starting, consuming, or awarding', () => {
    const { database, account, add, pier } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 3);
    expect(fishingPreview(database, account.id, rod.instanceId, bait.instanceId)).toMatchObject({
      error: 'FISHING_NOT_READY',
    });
    pier();
    const result = fishingPreview(database, account.id, rod.instanceId, bait.instanceId);
    expect(result).toHaveProperty('preview');
    if (!('preview' in result) || !result.preview) throw Error('Expected preview');
    expect(result.preview.possibleSpecies.map((species) => species.id)).toEqual([
      'sardine',
      'mackerel',
      'red_mullet',
      'seabass',
    ]);
    expect(result.preview.sea.zoneId).toBe('fishing-pier');
    expect(
      calculateFishing('basic_fishing_rod', 'worm_bait', result.preview.conditions).speciesWeights,
    ).toEqual(
      calculateFishing('basic_fishing_rod', 'worm_bait', result.preview.conditions).speciesWeights,
    );
    expect(
      getInventory(database, account.id)?.items.find((item) => item.instanceId === bait.instanceId)
        ?.quantity,
    ).toBe(3);
    expect(database.prepare('SELECT count(*) AS n FROM fishing_sessions').get()).toMatchObject({
      n: 0,
    });
    database.close();
  });
  it('forces each sea state and clears back to the persisted schedule', () => {
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 5);
    pier();
    const scheduled = fishingState(database, account.id)!;
    start(rod.instanceId, bait.instanceId);
    for (const seaState of ['Calm', 'Moderate', 'Dangerous'] as const) {
      expect(overrideConditions(database, { seaState })).toMatchObject({
        overrideState: seaState,
        conditions: { seaState },
        sea: scheduled.sea,
      });
      resolveAttempt(database, fishingState(database, account.id)!.sessionId!, {
        random: () => 0.99,
      });
      expect((traces().at(-1)!.conditions as { seaState: string }).seaState).toBe(seaState);
    }
    expect(overrideConditions(database, { seaState: null })).toMatchObject({
      overrideState: null,
      conditions: { seaState: scheduled.sea.scheduledCurrentState },
    });
    expect(overrideConditions(database, { seaState: null })).toMatchObject({ overrideState: null });
    expect(
      overrideConditions(database, { seaBlockStartedAt: '2026-09-24T00:00:00.000Z' }),
    ).toMatchObject({ error: 'VALIDATION_ERROR' });
    database.close();
  });
  it('upgrades early A01 tables in an existing database without losing rows', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'frontier-fishing-upgrade-'));
    directories.push(directory);
    const databasePath = path.join(directory, 'game.sqlite');
    const old = new DatabaseSync(databasePath);
    old.exec(`
      CREATE TABLE fishing_attempts (id TEXT PRIMARY KEY, session_id TEXT, sequence INTEGER, trace_json TEXT, created_at TEXT);
      CREATE TABLE admin_inventory_audit (id TEXT PRIMARY KEY, timestamp TEXT, actor_account_id TEXT, character_id TEXT, action TEXT, detail_json TEXT);
      INSERT INTO admin_inventory_audit VALUES ('audit-1', '2026-09-23', 'operator', 'character', 'add', '{}');
    `);
    old.close();
    const database = openDatabase(databasePath);
    const columns = (table: string) =>
      database
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((column) => column.name);
    expect(columns('fishing_attempts')).toContain('request_key');
    expect(columns('admin_inventory_audit')).toContain('request_key');
    expect(database.prepare('SELECT id FROM admin_inventory_audit').get()).toMatchObject({
      id: 'audit-1',
    });
    database.close();
  });

  it('requires physical Pier presence and fresh carried eligible selections; duplicate start is idempotent', () => {
    const { database, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 3);
    expect(startFishing(database, account.id, rod.instanceId, bait.instanceId)).toMatchObject({
      error: 'FISHING_NOT_READY',
    });
    pier();
    expect(startFishing(database, account.id, 'forged', bait.instanceId)).toMatchObject({
      error: 'FISHING_NOT_READY',
    });
    database
      .prepare("UPDATE character_items SET location = 'locker' WHERE id = ?")
      .run(bait.instanceId);
    expect(startFishing(database, account.id, rod.instanceId, bait.instanceId)).toMatchObject({
      error: 'FISHING_NOT_READY',
    });
    database
      .prepare("UPDATE character_items SET location = 'inventory' WHERE id = ?")
      .run(bait.instanceId);
    expect(startFishing(database, account.id, rod.instanceId, rod.instanceId)).toMatchObject({
      error: 'VALIDATION_ERROR',
    });
    const sessionId = start(rod.instanceId, bait.instanceId);
    expect(startFishing(database, account.id, rod.instanceId, bait.instanceId)).toMatchObject({
      state: { sessionId },
    });
    expect(getCharacter(database, account.id)?.activeStatus).toBe('FISHING');
    expect(
      database
        .prepare("SELECT count(*) AS count FROM fishing_sessions WHERE status = 'active'")
        .get(),
    ).toMatchObject({ count: 1 });
    database.close();
  });

  it('uses configured condition multipliers and records a no-catch with exactly one bait consumed and no XP', () => {
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('reinforced_fishing_rod');
    const bait = add('squid_bait', 3);
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    expect(overrideConditions(database, { timeOfDay: 'Dawn', seaState: 'Calm' })).toHaveProperty(
      'conditions',
    );
    resolveAttempt(database, sessionId, { random: () => 0.99 });
    const trace = traces()[0];
    expect(trace.finalProbability).toBeCloseTo(0.4 * 1.05 * 1.05);
    expect(trace.success).toBe(false);
    expect(trace.baitBefore).toBe(3);
    expect(trace.baitAfter).toBe(2);
    expect(trace.xpMutation).toBe('not implemented/no mutation');
    expect(fishingState(database, account.id)).toMatchObject({
      attempts: 1,
      catches: 0,
      baitRemaining: 2,
      latestResult: 'No catch.',
    });
    expect(getCharacter(database, account.id)?.characterXp).toBe(0);
    expect(fishingConfig.attemptIntervalMs).toBe(30_000);
    database.close();
  });

  it('applies every condition combination to both configured rods', () => {
    const { database, account, add, pier, start, traces } = setup();
    const basic = add('basic_fishing_rod');
    const reinforced = add('reinforced_fishing_rod');
    const bait = add('worm_bait', 100);
    pier();
    for (const rod of [basic, reinforced]) {
      const sessionId = start(rod.instanceId, bait.instanceId);
      for (const [timeOfDay, timeModifier] of Object.entries(fishingConfig.conditions.timeOfDay))
        for (const [seaState, seaModifier] of Object.entries(fishingConfig.conditions.seaState)) {
          expect(overrideConditions(database, { timeOfDay, seaState })).toHaveProperty(
            'conditions',
          );
          resolveAttempt(database, sessionId, { random: () => 0.99 });
          const trace = traces().at(-1)!;
          expect(trace.finalProbability).toBeCloseTo(
            fishingConfig.rods[rod.id as keyof typeof fishingConfig.rods] *
              timeModifier *
              seaModifier,
          );
          expect(trace.conditions).toEqual({ timeOfDay, seaState });
        }
      stopFishing(database, account.id);
    }
    expect(traces()).toHaveLength(24);
    database.close();
  });

  it('generates configured species and ordinary-biased weights, merging one species stack at full capacity', () => {
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('crab_bait', 5);
    add('sardine', 2);
    for (let index = 0; index < 7; index++) add('basic_toolkit');
    expect(getInventory(database, account.id)?.usedSlots).toBe(10);
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    resolveAttempt(database, sessionId, {
      random: (() => {
        const values = [0, 0.2, 0.5];
        return () => values.shift() ?? 0;
      })(),
    });
    expect(
      getInventory(database, account.id)?.items.find((item) => item.id === 'sardine')?.quantity,
    ).toBe(3);
    expect(getInventory(database, account.id)?.usedSlots).toBe(10);
    const trace = traces()[0];
    expect(trace.species).toBe('sardine');
    expect(trace.weightKg).toBeGreaterThanOrEqual(0.05);
    expect(trace.weightKg).toBeLessThanOrEqual(0.15);
    expect((trace.inventoryResult as { action: string }).action).toBe('merge');
    expect(sampleFishWeight('sardine', 0.5)).toBeLessThan(0.1);
    database.close();
  });

  it('uses eligible species weights with only weight as specimen data', () => {
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('basic_fishing_rod');
    const baits = [add('worm_bait', 4), add('squid_bait', 4), add('crab_bait', 4)];
    pier();
    for (const bait of baits) {
      const sessionId = start(rod.instanceId, bait.instanceId);
      const speciesRolls = [0, 0.5, 0.99];
      for (const speciesRoll of speciesRolls) {
        const rolls = [0, speciesRoll, 0.5];
        resolveAttempt(database, sessionId, { random: () => rolls.shift() ?? 0 });
      }
      stopFishing(database, account.id);
    }
    expect(traces()).toHaveLength(9);
    for (const trace of traces()) {
      const species = trace.species as keyof typeof fishingConfig.weightsKg;
      expect(trace.speciesWeights).toEqual(
        calculateFishing(
          trace.rodDefinitionId as keyof typeof fishingConfig.rods,
          trace.baitDefinitionId as keyof typeof fishingConfig.baits,
          trace.conditions as { timeOfDay: 'Dawn'; seaState: 'Calm' },
        ).speciesWeights,
      );
      expect(trace.weightKg).toBeGreaterThanOrEqual(fishingConfig.weightsKg[species].min);
      expect(trace.weightKg).toBeLessThanOrEqual(fishingConfig.weightsKg[species].max);
      expect(trace).not.toHaveProperty('length');
      expect(trace).not.toHaveProperty('quality');
    }
    expect(getInventory(database, account.id)?.items.some((item) => item.id === 'sardine')).toBe(
      true,
    );
    expect(getCharacter(database, account.id)?.characterXp).toBe(0);
    database.close();
  });

  it('records an exact capacity stop after bait consumption, but lets final bait free a slot', () => {
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 2);
    for (let index = 0; index < 8; index++) add('basic_toolkit');
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    resolveAttempt(database, sessionId, { random: () => 0 });
    expect(fishingState(database, account.id)?.stopReason).toBe('Fishing stopped: inventory full.');
    expect(getInventory(database, account.id)?.items.some((item) => item.id === 'sardine')).toBe(
      false,
    );
    expect(
      getInventory(database, account.id)?.items.find((item) => item.id === 'worm_bait')?.quantity,
    ).toBe(1);
    expect(traces()[0].inventoryResult).toMatchObject({ action: 'rejected' });
    stopFishing(database, account.id);
    const next = start(rod.instanceId, bait.instanceId);
    resolveAttempt(database, next, { random: () => 0 });
    expect(
      getInventory(database, account.id)?.items.find((item) => item.id === 'sardine')?.quantity,
    ).toBe(1);
    expect(getInventory(database, account.id)?.usedSlots).toBe(10);
    expect(fishingState(database, account.id)?.stopReason).toBe('Fishing stopped: bait depleted.');
    database.close();
  });

  it('stops on departure and missing supplies without charging another bait', () => {
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 2);
    pier();
    const first = start(rod.instanceId, bait.instanceId);
    expect(navigateLocation(database, account.id, 'harbor')).toHaveProperty('state');
    resolveAttempt(database, first, { random: () => 0 });
    expect(traces()).toHaveLength(0);
    expect(getCharacter(database, account.id)?.activeStatus).toBe('idle');
    expect(fishingState(database, account.id)).toMatchObject({
      status: 'idle',
      sessionId: null,
      catches: 0,
      latestCatch: null,
      stopReason: null,
    });
    expect(navigateLocation(database, account.id, 'fishing-pier')).toHaveProperty('state');
    expect(fishingState(database, account.id)?.status).toBe('idle');
    const second = start(rod.instanceId, bait.instanceId);
    mutate(database, account.id, { action: 'delete', itemId: rod.instanceId });
    resolveAttempt(database, second, { random: () => 0 });
    expect(traces()[0]).toMatchObject({
      equipmentValid: false,
      baitBefore: 2,
      baitAfter: 2,
      successRoll: null,
    });
    expect(fishingState(database, account.id)?.status).toBe('stopped');
    expect(fishingState(database, account.id)?.activeAttempt).toBeNull();
    const newRod = add('basic_fishing_rod');
    const third = start(newRod.instanceId, bait.instanceId);
    expect(navigateLocation(database, account.id, 'new-harbor', true)).toHaveProperty('state');
    resolveAttempt(database, third, { random: () => 0 });
    expect(traces()).toHaveLength(1);
    expect(fishingState(database, account.id)?.status).toBe('idle');
    expect(
      database.prepare('SELECT stop_reason FROM fishing_sessions WHERE id = ?').get(third),
    ).toMatchObject({ stop_reason: 'Fishing stopped: left Fishing Pier.' });
    database.close();
  });

  it('clears a completed result from the Pier panel on departure without losing catches', () => {
    const { database, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 3);
    pier();
    const completed = start(rod.instanceId, bait.instanceId);
    resolveAttempt(database, completed, { random: () => 0 });
    expect(fishingState(database, account.id)?.latestCatch?.species).toBe('Sardine');
    stopFishing(database, account.id);
    expect(fishingState(database, account.id)).toMatchObject({
      status: 'stopped',
      catches: 1,
    });
    expect(navigateLocation(database, account.id, 'harbor')).toHaveProperty('state');
    expect(fishingState(database, account.id)).toMatchObject({
      status: 'idle',
      sessionId: null,
      catches: 0,
      latestCatch: null,
      latestResult: null,
      stopReason: null,
    });
    expect(navigateLocation(database, account.id, 'fishing-pier')).toHaveProperty('state');
    expect(fishingState(database, account.id)?.status).toBe('idle');
    expect(
      database
        .prepare('SELECT catch_count, latest_species FROM fishing_sessions WHERE id = ?')
        .get(completed),
    ).toMatchObject({ catch_count: 1, latest_species: 'sardine' });
    expect(getInventory(database, account.id)?.items.some((item) => item.id === 'sardine')).toBe(
      true,
    );
    start(rod.instanceId, bait.instanceId);
    expect(fishingState(database, account.id)).toMatchObject({
      status: 'active',
      catches: 0,
      latestCatch: null,
    });
    database.close();
  });

  it('deduplicates forced attempts, validates overrides, and stops inactive sessions without catch-up', () => {
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 3);
    pier();
    start(rod.instanceId, bait.instanceId);
    expect(overrideConditions(database, { seaState: 'Storm' })).toMatchObject({
      error: 'VALIDATION_ERROR',
    });
    expect(overrideConditions(database, { weather: 'Sunny' })).toMatchObject({
      error: 'VALIDATION_ERROR',
    });
    const first = forceFishing(database, account.id, 'operator', 'request-001', true, 0);
    expect(first).toHaveProperty('state');
    expect(forceFishing(database, account.id, 'operator', 'request-001', true, 0)).toMatchObject({
      state: {
        sessionId: (first as { state: { sessionId: string } }).state.sessionId,
        attempts: 1,
      },
    });
    expect(traces()).toHaveLength(1);
    const active = fishingState(database, account.id)!;
    database
      .prepare('UPDATE fishing_sessions SET last_seen_at = ?, next_attempt_at = ? WHERE id = ?')
      .run(
        new Date(Date.now() - 120_000).toISOString(),
        new Date(Date.now() - 60_000).toISOString(),
        active.sessionId,
      );
    tickFishing(database);
    expect(traces()).toHaveLength(1);
    expect(fishingState(database, account.id)?.stopReason).toBe(
      'Fishing stopped: session inactive.',
    );
    const second = start(rod.instanceId, bait.instanceId);
    resetFishingAfterRestart(database);
    expect(fishingState(database, account.id)).toMatchObject({
      sessionId: second,
      status: 'stopped',
      stopReason: 'Fishing stopped: server restarted.',
    });
    expect(traces()).toHaveLength(1);
    database.close();
  });

  it('claims a due attempt once when forced and scheduled resolutions race', () => {
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 5);
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    database
      .prepare('UPDATE fishing_sessions SET next_attempt_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 1_000).toISOString(), sessionId);
    forceFishing(database, account.id, 'operator', 'race-key-1', true, 0);
    tickFishing(database);
    expect(traces()).toHaveLength(1);
    database
      .prepare('UPDATE fishing_sessions SET next_attempt_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 1_000).toISOString(), sessionId);
    tickFishing(database);
    forceFishing(database, account.id, 'operator', 'race-key-2', true, 1);
    expect(traces()).toHaveLength(2);
    expect(fishingState(database, account.id)?.baitRemaining).toBe(3);
    database.close();
  });

  it('rejects a forced resolution after liveness expires without charging bait', () => {
    const { database, account, add, pier, start, traces } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 2);
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    database
      .prepare('UPDATE fishing_sessions SET last_seen_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 120_000).toISOString(), sessionId);
    forceFishing(database, account.id, 'operator', 'stale-force', true, 0);
    expect(traces()[0]).toMatchObject({
      sessionLive: false,
      baitBefore: 2,
      baitAfter: 2,
      successRoll: null,
      stopReason: 'Fishing stopped: session inactive.',
    });
    expect(
      getInventory(database, account.id)?.items.find((item) => item.id === 'worm_bait')?.quantity,
    ).toBe(2);
    database.close();
  });

  it('preserves a completed catch across database reopen without replaying the active timer', () => {
    const { database, databasePath, account, add, pier, start } = setup();
    const rod = add('basic_fishing_rod');
    const bait = add('worm_bait', 3);
    pier();
    const sessionId = start(rod.instanceId, bait.instanceId);
    resolveAttempt(database, sessionId, { random: () => 0 });
    database.close();
    const reopened = openDatabase(databasePath);
    seedDatabase(reopened);
    resetFishingAfterRestart(reopened);
    tickFishing(reopened);
    expect(fishingState(reopened, account.id)).toMatchObject({
      status: 'stopped',
      attempts: 1,
      catches: 1,
      stopReason: 'Fishing stopped: server restarted.',
    });
    expect(
      getInventory(reopened, account.id)?.items.find((item) => item.id === 'worm_bait')?.quantity,
    ).toBe(2);
    expect(
      getInventory(reopened, account.id)?.items.find((item) => item.id === 'sardine')?.quantity,
    ).toBe(1);
    expect(reopened.prepare('SELECT count(*) AS count FROM fishing_attempts').get()).toMatchObject({
      count: 1,
    });
    reopened.close();
  });

  it('validates every admin inventory action and persists real carried changes without touching storage', () => {
    const { database, account, add } = setup();
    add('mackerel', 12);
    const fish = getInventory(database, account.id)!.items.find(
      (item) => item.id === 'mackerel' && item.quantity === 10,
    )!;
    const requestKey = randomUUID();
    const repeated = { action: 'add', definitionId: 'sardine', quantity: 2, requestKey };
    expect(adminInventoryMutation(database, account.id, 'operator', repeated)).toEqual({
      inventoryChanged: true,
    });
    expect(adminInventoryMutation(database, account.id, 'operator', repeated)).toEqual({
      inventoryChanged: true,
    });
    expect(
      getInventory(database, account.id)?.items.find((item) => item.id === 'sardine')?.quantity,
    ).toBe(2);
    expect(
      mutate(database, account.id, { action: 'remove', itemId: fish.instanceId, quantity: 3 }),
    ).toEqual({ inventoryChanged: true });
    expect(
      getInventory(database, account.id)?.items.find((item) => item.instanceId === fish.instanceId)
        ?.quantity,
    ).toBe(7);
    expect(
      mutate(database, account.id, { action: 'remove', itemId: fish.instanceId, quantity: 10 }),
    ).toMatchObject({ error: 'ITEM_NOT_AVAILABLE' });
    expect(
      mutate(database, account.id, { action: 'remove', itemId: fish.instanceId, quantity: 0.5 }),
    ).toMatchObject({ error: 'ITEM_NOT_AVAILABLE' });
    expect(
      getInventory(database, account.id)?.items.find((item) => item.instanceId === fish.instanceId)
        ?.quantity,
    ).toBe(7);
    expect(mutate(database, account.id, { action: 'delete', itemId: fish.instanceId })).toEqual({
      inventoryChanged: true,
    });
    expect(
      getInventory(database, account.id)
        ?.items.filter((item) => item.id === 'mackerel')
        .map((item) => item.quantity),
    ).toEqual([2]);
    const bait = add('worm_bait', 2);
    database
      .prepare("UPDATE character_items SET location = 'locker' WHERE id = ?")
      .run(bait.instanceId);
    const storedFish = add('bluefin_tuna', 2);
    database
      .prepare("UPDATE character_items SET location = 'locker' WHERE id = ?")
      .run(storedFish.instanceId);
    expect(mutate(database, account.id, { action: 'clear' })).toEqual({ inventoryChanged: true });
    expect(getInventory(database, account.id)?.items).toHaveLength(0);
    expect(
      getInventory(database, account.id)?.locker.find((item) => item.id === 'worm_bait')?.quantity,
    ).toBe(2);
    expect(
      getInventory(database, account.id)?.locker.find((item) => item.id === 'bluefin_tuna')
        ?.quantity,
    ).toBe(2);
    expect(
      database.prepare('SELECT count(*) AS count FROM admin_inventory_audit').get(),
    ).toMatchObject({ count: 9 });
    const lockerRequest = { action: 'clear_locker', requestKey: randomUUID() };
    expect(adminInventoryMutation(database, account.id, 'operator', lockerRequest)).toEqual({
      inventoryChanged: true,
    });
    expect(adminInventoryMutation(database, account.id, 'operator', lockerRequest)).toEqual({
      inventoryChanged: true,
    });
    expect(getInventory(database, account.id)?.locker).toEqual([]);
    expect(getInventory(database, account.id)?.items).toEqual([]);
    expect(
      database
        .prepare('SELECT count(*) AS count FROM fish_specimens WHERE stack_id = ?')
        .get(storedFish.instanceId),
    ).toMatchObject({ count: 0 });
    expect(
      database.prepare('SELECT count(*) AS count FROM admin_inventory_audit').get(),
    ).toMatchObject({ count: 10 });
    database.close();
  });

  it('deletes one owned locker stack with specimens, idempotency, and audit while rejecting foreign or stale targets', () => {
    const { database, account, add } = setup();
    const storedFish = add('mackerel', 2);
    const carriedBait = add('worm_bait', 3);
    database
      .prepare("UPDATE character_items SET location = 'locker' WHERE id = ?")
      .run(storedFish.instanceId);
    const otherAccount = createAccount(database, 'other-fisher', 'test-password');
    createCharacter(database, otherAccount.id, 'Other Fisher');
    const foreignItem = getInventory(database, otherAccount.id)!.items[0]!;

    expect(
      mutate(database, account.id, { action: 'delete', itemId: foreignItem.instanceId }),
    ).toMatchObject({
      error: 'ITEM_NOT_AVAILABLE',
    });
    expect(
      mutate(database, account.id, {
        action: 'remove',
        itemId: storedFish.instanceId,
        quantity: 1,
      }),
    ).toMatchObject({ error: 'ITEM_NOT_AVAILABLE' });
    const request = { action: 'delete', itemId: storedFish.instanceId, requestKey: randomUUID() };
    expect(adminInventoryMutation(database, account.id, 'operator', request)).toEqual({
      inventoryChanged: true,
    });
    expect(adminInventoryMutation(database, account.id, 'operator', request)).toEqual({
      inventoryChanged: true,
    });
    expect(getInventory(database, account.id)?.locker).toEqual([]);
    expect(getInventory(database, account.id)?.items).toEqual([
      expect.objectContaining({ instanceId: carriedBait.instanceId, quantity: 3 }),
    ]);
    expect(
      database
        .prepare('SELECT count(*) AS count FROM fish_specimens WHERE stack_id = ?')
        .get(storedFish.instanceId),
    ).toMatchObject({ count: 0 });
    expect(
      mutate(database, account.id, { action: 'delete', itemId: storedFish.instanceId }),
    ).toMatchObject({
      error: 'ITEM_NOT_AVAILABLE',
    });
    const audit = database
      .prepare('SELECT detail_json FROM admin_inventory_audit WHERE request_key = ?')
      .get(request.requestKey) as { detail_json: string };
    expect(JSON.parse(audit.detail_json)).toMatchObject({
      targetId: storedFish.instanceId,
      targetLocation: 'locker',
      beforeQuantity: 2,
      afterQuantity: 0,
      afterLockerSlots: 0,
      outcome: 'success',
    });
    database.close();
  });

  it('restricts debug and inventory mutations to allowlisted nonproduction accounts', async () => {
    const { database, account, add, pier } = setup();
    const token = createSession(database, account.id);
    const server = createServer(createRequestHandler(database, 'test'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    const origin = `http://127.0.0.1:${address.port}`;
    const call = (route: string, body?: object, cookie = `frontier_session=${token}`) =>
      fetch(origin + route, {
        method: body ? 'POST' : 'GET',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    expect((await call('/api/fishing/admin')).status).toBe(403);
    expect((await call('/api/fishing/admin/discoveries/reset', {})).status).toBe(403);
    expect((await call('/api/fishing/admin/access')).status).toBe(403);
    const ordinary = await call('/api/fishing');
    expect(ordinary.status).toBe(200);
    const ordinaryPayload = await ordinary.json();
    expect(ordinaryPayload).toHaveProperty('fishing');
    expect(ordinaryPayload).not.toHaveProperty('config');
    expect(ordinaryPayload).not.toHaveProperty('traces');
    expect(ordinaryPayload.fishing.sea).toHaveProperty('nextState');
    expect(ordinaryPayload.fishing).not.toHaveProperty('overrideState');
    expect(ordinaryPayload.fishing.activeAttempt).toBeNull();
    expect(ordinary.headers.get('cache-control')).toBe('no-store');
    expect(
      (await call('/api/fishing/preview?rodItemId=x&baitItemId=y', undefined, '')).status,
    ).toBe(401);
    expect(
      (
        await call('/api/fishing/admin/inventory', {
          action: 'add',
          definitionId: 'worm_bait',
          quantity: 1,
          requestKey: randomUUID(),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call('/api/fishing/admin/inventory', {
          action: 'clear_locker',
          requestKey: randomUUID(),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call('/api/fishing/admin/force', {
          requestKey: randomUUID(),
          forceSuccess: false,
          forceTrophy: true,
          expectedAttemptCount: 0,
        })
      ).status,
    ).toBe(403);
    expect((await call('/api/fishing/admin', undefined, '')).status).toBe(401);
    expect((await call('/api/fishing/admin/discoveries/reset', {}, '')).status).toBe(401);
    expect((await call('/api/fishing/admin/access', undefined, '')).status).toBe(401);
    expect((await call('/api/world/clock', undefined, '')).status).toBe(401);
    expect(
      (await call('/api/fishing/start', { rodItemId: 'forged', baitItemId: 'forged' }, '')).status,
    ).toBe(401);
    const clock = await call('/api/world/clock');
    expect(clock.status).toBe(200);
    expect(await clock.json()).toMatchObject({
      serverTime: expect.any(String),
      timeOfDay: expect.stringMatching(/^(Dawn|Day|Dusk|Night)$/),
      gameTime: { hour: expect.any(Number), minute: expect.any(Number) },
    });
    process.env.FRONTIER_ADMIN_USERNAMES = 'fisher';
    expect(await (await call('/api/fishing/admin/access')).json()).toEqual({ authorized: true });
    expect((await call('/api/fishing/admin')).status).toBe(200);
    const operator = database
      .prepare('SELECT id FROM characters WHERE account_id = ?')
      .get(account.id) as { id: string };
    database
      .prepare(
        'INSERT INTO character_discovered_fish (character_id, species_id, discovered_at) VALUES (?, ?, ?)',
      )
      .run(operator.id, 'sardine', new Date().toISOString());
    expect(await (await call('/api/fishing/admin/discoveries/reset', {})).json()).toMatchObject({
      removed: 1,
      discoveredFish: [],
    });
    expect(
      (
        await call('/api/fishing/admin/inventory', {
          action: 'add',
          definitionId: 'worm_bait',
          quantity: 3,
          requestKey: randomUUID(),
        })
      ).status,
    ).toBe(200);
    expect(
      getInventory(database, account.id)?.items.find((item) => item.id === 'worm_bait')?.quantity,
    ).toBe(3);
    expect(
      (
        await call('/api/fishing/admin/inventory', {
          action: 'add',
          definitionId: 'fake',
          quantity: -1,
          requestKey: randomUUID(),
        })
      ).status,
    ).toBe(400);
    expect(
      database.prepare('SELECT count(*) AS count FROM admin_inventory_audit').get(),
    ).toMatchObject({ count: 2 });
    const rod = add('basic_fishing_rod');
    const bait = getInventory(database, account.id)!.items.find((item) => item.id === 'worm_bait')!;
    pier();
    const preview = await call(
      `/api/fishing/preview?rodItemId=${rod.instanceId}&baitItemId=${bait.instanceId}`,
    );
    expect(preview.status).toBe(200);
    expect(preview.headers.get('cache-control')).toBe('no-store');
    expect(await preview.json()).toMatchObject({
      preview: {
        rodItemId: rod.instanceId,
        baitItemId: bait.instanceId,
        possibleSpecies: [
          { id: 'sardine' },
          { id: 'mackerel' },
          { id: 'red_mullet' },
          { id: 'seabass' },
        ],
      },
    });
    expect(
      (
        await call(
          `/api/fishing/preview?rodItemId=${rod.instanceId}&baitItemId=${bait.instanceId}&seaState=Dangerous`,
        )
      ).status,
    ).toBe(400);
    const started = await call('/api/fishing/start', {
      rodItemId: rod.instanceId,
      baitItemId: bait.instanceId,
    });
    expect(started.status).toBe(200);
    const startedPayload = await started.json();
    expect(startedPayload.fishing.activeAttempt).toEqual({
      startedAt: expect.any(String),
      deadlineAt: expect.any(String),
      durationMs: 30_000,
    });
    expect(
      Date.parse(startedPayload.fishing.activeAttempt.deadlineAt) -
        Date.parse(startedPayload.fishing.activeAttempt.startedAt),
    ).toBe(30_000);
    const forced = await call('/api/fishing/admin/force', {
      requestKey: randomUUID(),
      forceSuccess: false,
      forceTrophy: true,
      expectedAttemptCount: 0,
    });
    expect(forced.status).toBe(200);
    const forcedPayload = await forced.json();
    expect(forcedPayload.fishing).toMatchObject({ attempts: 1, catches: 1, baitRemaining: 2 });
    expect(
      forcedPayload.inventory.items.some((item: { specimens?: Array<{ trophy: boolean }> }) =>
        item.specimens?.some((specimen) => specimen.trophy),
      ),
    ).toBe(true);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const production = createServer(createRequestHandler(database, 'production'));
    await new Promise<void>((resolve) => production.listen(0, '127.0.0.1', resolve));
    const productionAddress = production.address();
    if (!productionAddress || typeof productionAddress === 'string')
      throw new Error('No production address');
    const productionResponse = await fetch(
      `http://127.0.0.1:${productionAddress.port}/api/fishing/admin`,
      {
        headers: { Cookie: `frontier_session=${token}` },
      },
    );
    expect(productionResponse.status).toBe(404);
    expect(
      (
        await fetch(
          `http://127.0.0.1:${productionAddress.port}/api/fishing/admin/discoveries/reset`,
          { method: 'POST', headers: { Cookie: `frontier_session=${token}` }, body: '{}' },
        )
      ).status,
    ).toBe(404);
    const productionAccessResponse = await fetch(
      `http://127.0.0.1:${productionAddress.port}/api/fishing/admin/access`,
      { headers: { Cookie: `frontier_session=${token}` } },
    );
    expect(productionAccessResponse.status).toBe(404);
    await new Promise<void>((resolve) => production.close(() => resolve()));
    database.close();
  });

  it('spawns both rods and all bait through authorized HTTP actions into persisted carried inventory', async () => {
    const { database, databasePath, account } = setup();
    const token = createSession(database, account.id);
    process.env.FRONTIER_ADMIN_USERNAMES = 'fisher';
    const server = createServer(createRequestHandler(database, 'test'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    const origin = `http://127.0.0.1:${address.port}`;
    const headers = { Cookie: `frontier_session=${token}`, 'Content-Type': 'application/json' };
    const supplies = [
      ['basic_fishing_rod', 1],
      ['reinforced_fishing_rod', 1],
      ['worm_bait', 4],
      ['squid_bait', 3],
      ['crab_bait', 2],
    ] as const;
    for (const [definitionId, quantity] of supplies) {
      const response = await fetch(`${origin}/api/fishing/admin/inventory`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'add', definitionId, quantity, requestKey: randomUUID() }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.inventory.items).toContainEqual(
        expect.objectContaining({ id: definitionId, quantity, location: 'inventory' }),
      );
    }
    const normalInventory = await fetch(`${origin}/api/inventory`, { headers });
    expect(normalInventory.status).toBe(200);
    const normalItems = (await normalInventory.json()).inventory.items as Array<{
      id: string;
      quantity: number;
      location: string;
    }>;
    for (const [definitionId, quantity] of supplies) {
      expect(normalItems).toContainEqual(
        expect.objectContaining({ id: definitionId, quantity, location: 'inventory' }),
      );
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    database.close();
    const reopened = openDatabase(databasePath);
    const persisted = getInventory(reopened, account.id)!;
    for (const [definitionId, quantity] of supplies) {
      expect(persisted.items).toContainEqual(
        expect.objectContaining({ id: definitionId, quantity, location: 'inventory' }),
      );
    }
    reopened.close();
  });
});
