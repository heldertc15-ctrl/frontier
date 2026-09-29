// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccount, createSession } from './auth.js';
import { createCharacter, getCharacter } from './character.js';
import { createRequestHandler } from './app.js';
import { openDatabase, seedDatabase } from './database.js';
import {
  activateFishingEvent,
  adminFishingData,
  adminInventoryMutation,
  fishingState,
  forceFishingEvent,
  resetFishingAfterRestart,
  resolveAttempt,
  startFishing,
  stopFishing,
  tickFishing,
  touchFishing,
} from './fishing.js';
import { type FishingEventClock } from './fishingRandomEvents.js';
import { getInventory } from './inventory.js';
import { navigateLocation } from './locations.js';

const directories: string[] = [];
const databases: ReturnType<typeof openDatabase>[] = [];
const epoch = Date.parse('2026-09-26T12:00:00.000Z');
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(epoch);
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  for (const database of databases.splice(0)) {
    try {
      database.close();
    } catch {
      /* Already reopened. */
    }
  }
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
  delete process.env.FRONTIER_ADMIN_USERNAMES;
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function setup() {
  const directory = mkdtempSync(path.join(tmpdir(), 'frontier-fishing-events-'));
  directories.push(directory);
  const databasePath = path.join(directory, 'game.sqlite');
  const database = openDatabase(databasePath);
  databases.push(database);
  seedDatabase(database);
  const account = createAccount(database, 'event_fisher', 'test-password');
  const person = createCharacter(database, account.id, 'Event Fisher');
  database.prepare('DELETE FROM character_items WHERE character_id = ?').run(person.id);
  for (const [definitionId, quantity] of [
    ['basic_fishing_rod', 1],
    ['worm_bait', 100],
  ] as const)
    expect(
      adminInventoryMutation(database, account.id, 'operator', {
        action: 'add',
        definitionId,
        quantity,
        requestKey: randomUUID(),
      }),
    ).toEqual({ inventoryChanged: true });
  const items = getInventory(database, account.id)!.items;
  const rod = items.find((item) => item.id === 'basic_fishing_rod')!;
  const bait = items.find((item) => item.id === 'worm_bait')!;
  navigateLocation(database, account.id, 'harbor');
  navigateLocation(database, account.id, 'fishing-pier');
  const start = () => {
    expect(startFishing(database, account.id, rod.instanceId, bait.instanceId)).toHaveProperty(
      'state',
    );
    return fishingState(database, account.id)!.sessionId!;
  };
  const state = () => fishingState(database, account.id)!;
  const readClock = () =>
    JSON.parse(
      String(
        database
          .prepare('SELECT clock_json FROM fishing_random_event_clocks WHERE character_id = ?')
          .get(person.id)!.clock_json,
      ),
    ) as FishingEventClock;
  const setClock = (patch: Partial<FishingEventClock>) =>
    database
      .prepare('UPDATE fishing_random_event_clocks SET clock_json = ? WHERE character_id = ?')
      .run(JSON.stringify({ ...readClock(), ...patch }), person.id);
  const force = (type: string, requestKey: string = randomUUID()) =>
    forceFishingEvent(database, account.id, {
      type,
      requestKey,
      sessionId: state().sessionId,
      expectedAttemptCount: state().attempts,
    });
  const traces = () =>
    database
      .prepare('SELECT trace_json FROM fishing_attempts ORDER BY sequence')
      .all()
      .map((entry) => JSON.parse(String(entry.trace_json)));
  return {
    database,
    databasePath,
    account,
    person,
    rod,
    bait,
    start,
    state,
    readClock,
    setClock,
    force,
    traces,
  };
}

describe('persisted fishing random event integration', () => {
  it('offers a due event during a countdown, consumes once on delivery, and ignores it without changing the cast', () => {
    const s = setup();
    const sessionId = s.start();
    s.setClock({ scheduleMs: [2_000, 80_000, 160_000, 240_000, 320_000] });
    const before = s.state();
    vi.setSystemTime(epoch + 2_000);
    const offered = touchFishing(s.database, s.account.id)!;
    expect(offered.randomEvent).toMatchObject({ sessionId, attempts: 0 });
    expect(offered.activeAttempt).toEqual(before.activeAttempt);
    expect(offered.baitRemaining).toBe(100);
    expect(s.readClock()).toMatchObject({ elapsedMs: 2_000, triggeredCount: 1, pendingCycles: [] });
    expect(touchFishing(s.database, s.account.id)!.randomEvent).toEqual(offered.randomEvent);
    vi.setSystemTime(epoch + 20_000);
    touchFishing(s.database, s.account.id);
    vi.setSystemTime(epoch + 30_000);
    resolveAttempt(s.database, sessionId, { scheduled: true, random: () => 0.99 });
    expect(s.state()).toMatchObject({ randomEvent: null, attempts: 1, baitRemaining: 99 });
    expect(s.traces()[0].speciesWeights).toEqual(s.traces()[0].normalSpeciesWeights);
    s.database.close();
    const reopened = openDatabase(s.databasePath);
    databases.push(reopened);
    expect(fishingState(reopened, s.account.id)).toMatchObject({ randomEvent: null, attempts: 1 });
  });

  it('holds due opportunities on expired attempts and delivers only after the next valid cast', () => {
    const s = setup();
    const sessionId = s.start();
    s.setClock({ scheduleMs: [2_000, 4_000, 6_000, 8_000, 10_000] });
    s.database
      .prepare('UPDATE fishing_sessions SET next_attempt_at = ? WHERE id = ?')
      .run(new Date(epoch + 1_000).toISOString(), sessionId);
    vi.setSystemTime(epoch + 3_000);
    expect(touchFishing(s.database, s.account.id)!.randomEvent).toBeNull();
    expect(s.readClock()).toMatchObject({ pendingCycles: [1], triggeredCount: 0 });
    resolveAttempt(s.database, sessionId, { scheduled: true, random: () => 0.99 });
    expect(s.state().randomEvent).toBeNull();
    expect(touchFishing(s.database, s.account.id)!.randomEvent).not.toBeNull();
    vi.setSystemTime(epoch + 10_000);
    touchFishing(s.database, s.account.id);
    expect(s.readClock()).toMatchObject({ triggeredCount: 1, pendingCycles: [1, 1, 1, 1] });
    expect(
      s.database.prepare('SELECT count(*) AS count FROM fishing_random_events').get()!.count,
    ).toBe(1);
  });

  it('earns only confirmed live active time, freezes offline and preserves the schedule across sessions/reopen', () => {
    const s = setup();
    s.start();
    const schedule = s.readClock().scheduleMs;
    vi.setSystemTime(epoch + 20_000);
    tickFishing(s.database);
    expect(s.readClock().elapsedMs).toBe(0);
    touchFishing(s.database, s.account.id);
    expect(s.readClock().elapsedMs).toBe(20_000);
    vi.setSystemTime(epoch + 3_600_000);
    expect(touchFishing(s.database, s.account.id)!.status).toBe('stopped');
    expect(s.readClock().elapsedMs).toBe(20_000);
    s.start();
    vi.setSystemTime(epoch + 3_601_000);
    stopFishing(s.database, s.account.id);
    expect(s.readClock()).toMatchObject({ elapsedMs: 21_000, scheduleMs: schedule });
    vi.setSystemTime(epoch + 7_200_000);
    s.start();
    resetFishingAfterRestart(s.database);
    expect(s.readClock()).toMatchObject({ elapsedMs: 21_000, scheduleMs: schedule });
    s.database.close();
    const reopened = openDatabase(s.databasePath);
    databases.push(reopened);
    const saved = JSON.parse(
      String(
        reopened.prepare('SELECT clock_json FROM fishing_random_event_clocks').get()!.clock_json,
      ),
    );
    expect(saved).toMatchObject({ elapsedMs: 21_000, scheduleMs: schedule });
  });

  it('rolls over immediately at sixty active minutes and keeps offering Reel Pull', () => {
    const s = setup();
    s.start();
    s.setClock({
      elapsedMs: 3_598_000,
      nextIndex: 5,
      triggeredCount: 5,
    });
    const schedule = s.readClock().scheduleMs;
    vi.setSystemTime(epoch + 2_000);
    touchFishing(s.database, s.account.id);
    expect(s.readClock()).toMatchObject({
      cycleNumber: 2,
      elapsedMs: 0,
      triggeredCount: 0,
      nextIndex: 0,
    });
    expect(s.readClock().scheduleMs).not.toEqual(schedule);
    s.setClock({ scheduleMs: [1_000, 2_000, 3_000, 4_000, 5_000] });
    vi.setSystemTime(epoch + 3_000);
    expect(touchFishing(s.database, s.account.id)!.randomEvent?.type).toBe('reel_pull');
  });

  it('does not double-count active time after a backwards server clock adjustment', () => {
    const s = setup();
    s.start();
    vi.setSystemTime(epoch + 10_000);
    touchFishing(s.database, s.account.id);
    vi.setSystemTime(epoch + 5_000);
    touchFishing(s.database, s.account.id);
    vi.setSystemTime(epoch + 10_000);
    touchFishing(s.database, s.account.id);
    expect(s.readClock().elapsedMs).toBe(10_000);
  });

  it('forces the shared offer without changing the natural clock/history and rejects repeated offers for one cast', () => {
    const s = setup();
    s.start();
    const clock = s.readClock();
    expect(s.force('reel_pull', 'one-offer-key')).toHaveProperty('state');
    const event = s.state().randomEvent;
    expect(s.force('reel_pull', 'one-offer-key')).toHaveProperty('state');
    expect(s.state().randomEvent).toEqual(event);
    expect(s.force('reel_pull')).toHaveProperty('error', 'EVENT_UNAVAILABLE');
    expect(s.force('surface_activity')).toHaveProperty('error', 'VALIDATION_ERROR');
    expect(s.readClock()).toEqual(clock);
    expect(adminFishingData(s.database, s.account.id).randomEvents.canForce).toBe(false);
    expect(
      forceFishingEvent(s.database, s.account.id, {
        type: 'unknown',
        requestKey: 'invalid-test',
        sessionId: s.state().sessionId,
        expectedAttemptCount: 0,
      }),
    ).toHaveProperty('error', 'VALIDATION_ERROR');
  });

  it('expires a Reel Pull offer after five seconds without shortening or resolving the cast', () => {
    const s = setup();
    s.start();
    const before = s.state().activeAttempt;
    s.force('reel_pull');
    const offer = s.state().randomEvent!;
    const revision = s.state().eventRevision;
    expect(offer).toMatchObject({
      expiresAt: new Date(epoch + 5_000).toISOString(),
      windowMs: 5_000,
    });
    vi.setSystemTime(epoch + 4_999);
    expect(s.state().randomEvent?.id).toBe(offer.id);
    vi.setSystemTime(epoch + 5_000);
    expect(s.state().randomEvent).toBeNull();
    expect(activateFishingEvent(s.database, s.account.id, offer.id)).toHaveProperty(
      'error',
      'EVENT_UNAVAILABLE',
    );
    expect(s.state().activeAttempt).toEqual(before);
    expect(s.state().eventRevision).toBe(revision + 1);
    expect(s.force('reel_pull')).toHaveProperty('error', 'EVENT_UNAVAILABLE');
    expect(
      s.database.prepare('SELECT status FROM fishing_random_events WHERE id = ?').get(offer.id),
    ).toMatchObject({ status: 'cleared' });
  });

  it('caps the Reel Pull window at the current attempt deadline', () => {
    const s = setup();
    s.start();
    vi.setSystemTime(epoch + 28_000);
    touchFishing(s.database, s.account.id);
    s.force('reel_pull');
    expect(s.state().randomEvent?.expiresAt).toBe(new Date(epoch + 30_000).toISOString());
  });

  it('Reel Pull resolves the current attempt immediately and duplicate/cross-connection requests cannot reward twice', () => {
    const s = setup();
    const sessionId = s.start();
    const characterBefore = getCharacter(s.database, s.account.id)!;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.setSystemTime(epoch + 20_000);
    touchFishing(s.database, s.account.id);
    s.force('reel_pull');
    const event = s.state().randomEvent!;
    const revision = s.state().eventRevision;
    expect(activateFishingEvent(s.database, s.account.id, event.id)).toHaveProperty('state');
    const resolved = s.state();
    expect(resolved).toMatchObject({
      attempts: 1,
      catches: 1,
      baitRemaining: 99,
      randomEvent: null,
      eventRevision: revision + 2,
    });
    expect(resolved.activeAttempt).toEqual({
      startedAt: new Date(epoch + 20_000).toISOString(),
      deadlineAt: new Date(epoch + 50_000).toISOString(),
      durationMs: 30_000,
    });
    vi.setSystemTime(epoch + 21_000);
    activateFishingEvent(s.database, s.account.id, event.id);
    expect(s.state().activeAttempt).toEqual(resolved.activeAttempt);
    vi.setSystemTime(epoch + 49_999);
    resolveAttempt(s.database, sessionId, { scheduled: true, random: () => 0 });
    expect(s.state().attempts).toBe(1);
    const second = openDatabase(s.databasePath);
    databases.push(second);
    resolveAttempt(second, sessionId, { scheduled: true, random: () => 0 });
    activateFishingEvent(second, s.account.id, event.id);
    expect(s.state()).toMatchObject({
      attempts: 1,
      catches: 1,
      baitRemaining: 99,
      randomEvent: null,
    });
    expect(s.traces()).toHaveLength(1);
    expect(s.traces()[0]).toMatchObject({
      attemptDeadlineAt: new Date(epoch + 20_000).toISOString(),
      normalSpeciesWeights: expect.any(Object),
      speciesWeights: expect.any(Object),
    });
    expect(s.state().activeAttempt?.durationMs).toBe(30_000);
    expect(getCharacter(s.database, s.account.id)!.characterXp).toEqual(
      characterBefore.characterXp,
    );
  });

  it('Reel Pull resolves at once even when the normal cast has less than five seconds remaining', () => {
    const s = setup();
    s.start();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    vi.setSystemTime(epoch + 20_000);
    touchFishing(s.database, s.account.id);
    vi.setSystemTime(epoch + 27_000);
    s.force('reel_pull');
    activateFishingEvent(s.database, s.account.id, s.state().randomEvent!.id);
    expect(s.state()).toMatchObject({ attempts: 1, catches: 0, baitRemaining: 99 });
    expect(s.state().activeAttempt).toEqual({
      startedAt: new Date(epoch + 27_000).toISOString(),
      deadlineAt: new Date(epoch + 57_000).toISOString(),
      durationMs: 30_000,
    });
    expect(s.traces()).toHaveLength(1);
  });

  it('hides and rejects a saved Surface Activity offer without changing catch weights', () => {
    const s = setup();
    const sessionId = s.start();
    const legacyId = randomUUID().replaceAll('-', '');
    s.database
      .prepare(
        "INSERT INTO fishing_random_events (id, session_id, attempt_count, type, source, status, created_at) VALUES (?, ?, 0, 'surface_activity', 'natural', 'pending', ?)",
      )
      .run(legacyId, sessionId, new Date(epoch).toISOString());
    expect(s.state().randomEvent).toBeNull();
    expect(activateFishingEvent(s.database, s.account.id, legacyId)).toHaveProperty(
      'error',
      'EVENT_UNAVAILABLE',
    );
    expect(
      s.database.prepare('SELECT status FROM fishing_random_events WHERE id = ?').get(legacyId),
    ).toMatchObject({ status: 'cleared' });
    expect(s.force('surface_activity')).toHaveProperty('error', 'VALIDATION_ERROR');
    const rolls = [0, 0.69, 0.4];
    resolveAttempt(s.database, sessionId, { random: () => rolls.shift() ?? 0 });
    expect(s.traces()[0].speciesWeights).toEqual(s.traces()[0].normalSpeciesWeights);
    expect(s.traces()[0]).not.toHaveProperty('surfaceActivity');
  });

  it('ignores an already used historical Surface Activity event at resolution', () => {
    const s = setup();
    const sessionId = s.start();
    s.database
      .prepare(
        "INSERT INTO fishing_random_events (id, session_id, attempt_count, type, source, status, created_at) VALUES (?, ?, 0, 'surface_activity', 'natural', 'used', ?)",
      )
      .run(randomUUID().replaceAll('-', ''), sessionId, new Date(epoch).toISOString());
    expect(s.state().randomEvent).toBeNull();
    const rolls = [0, 0.69, 0.4];
    resolveAttempt(s.database, sessionId, { random: () => rolls.shift() ?? 0 });
    expect(s.traces()[0].speciesWeights).toEqual(s.traces()[0].normalSpeciesWeights);
    expect(s.traces()[0]).not.toHaveProperty('surfaceActivity');
  });

  it('rejects a pending expired event and stale force identity without moving timing or spending supplies', () => {
    const s = setup();
    s.start();
    s.force('reel_pull');
    const event = s.state().randomEvent!;
    vi.setSystemTime(epoch + 30_000);
    expect(activateFishingEvent(s.database, s.account.id, event.id)).toHaveProperty(
      'error',
      'EVENT_UNAVAILABLE',
    );
    expect(s.force('reel_pull')).toHaveProperty('error', 'EVENT_UNAVAILABLE');
    expect(
      forceFishingEvent(s.database, s.account.id, {
        type: 'reel_pull',
        requestKey: randomUUID(),
        sessionId: 'old-session',
        expectedAttemptCount: 0,
      }),
    ).toHaveProperty('error', 'EVENT_UNAVAILABLE');
    expect(s.state()).toMatchObject({ attempts: 0, baitRemaining: 100 });
  });

  it('upgrades legacy sessions without rewriting their active timing or granting elapsed offline event time', () => {
    const s = setup();
    s.start();
    const original = s.state().activeAttempt;
    s.database.exec(
      'DROP TABLE fishing_random_events; DROP TABLE fishing_random_event_clocks; ALTER TABLE fishing_sessions DROP COLUMN event_revision;',
    );
    s.database.close();
    const reopened = openDatabase(s.databasePath);
    databases.push(reopened);
    expect(fishingState(reopened, s.account.id)).toMatchObject({
      activeAttempt: original,
      randomEvent: null,
      eventRevision: 0,
    });
    vi.setSystemTime(epoch + 20_000);
    touchFishing(reopened, s.account.id);
    const clock = JSON.parse(
      String(
        reopened.prepare('SELECT clock_json FROM fishing_random_event_clocks').get()!.clock_json,
      ),
    );
    expect(clock.elapsedMs).toBe(0);
    expect(clock.scheduleMs).toHaveLength(5);
  });

  it('guards HTTP forcing, keeps debugging private, and uses the same player activation endpoint', async () => {
    const s = setup();
    const token = createSession(s.database, s.account.id);
    const server = createServer(createRequestHandler(s.database, 'test'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No address');
    const base = `http://127.0.0.1:${address.port}`;
    const call = (route: string, body?: object, authorized = true) =>
      fetch(base + route, {
        method: body ? 'POST' : 'GET',
        headers: {
          ...(authorized ? { Cookie: `frontier_session=${token}` } : {}),
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    try {
      const sessionId = s.start();
      const intent = {
        type: 'reel_pull',
        sessionId,
        expectedAttemptCount: 0,
        requestKey: randomUUID(),
      };
      expect((await call('/api/fishing/admin/event', intent, false)).status).toBe(401);
      expect((await call('/api/fishing/admin/event', intent)).status).toBe(403);
      process.env.FRONTIER_ADMIN_USERNAMES = 'event_fisher';
      const retired = await call('/api/fishing/admin/event', {
        ...intent,
        type: 'surface_activity',
      });
      expect(retired.status).toBe(400);
      const forced = await call('/api/fishing/admin/event', intent);
      expect(forced.status).toBe(200);
      const prompt = (await forced.json()).fishing.randomEvent;
      const publicResponse = await call('/api/fishing');
      expect(publicResponse.headers.get('cache-control')).toBe('no-store');
      const publicState = (await publicResponse.json()).fishing;
      expect(publicState).not.toHaveProperty('randomEvents');
      expect(publicState).not.toHaveProperty('speciesWeights');
      delete process.env.FRONTIER_ADMIN_USERNAMES;
      const applied = await call('/api/fishing/event', { eventId: prompt.id });
      expect(applied.status).toBe(200);
      expect(await applied.json()).toMatchObject({
        fishing: { randomEvent: null, attempts: 1, baitRemaining: 99 },
        character: { id: s.person.id },
      });
      expect((await call('/api/fishing/event', { eventId: 'a'.repeat(32) })).status).toBe(400);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const production = createServer(createRequestHandler(s.database, 'production'));
    await new Promise<void>((resolve) => production.listen(0, '127.0.0.1', resolve));
    const prodAddress = production.address();
    if (!prodAddress || typeof prodAddress === 'string') throw new Error('No production address');
    try {
      const response = await fetch(`http://127.0.0.1:${prodAddress.port}/api/fishing/admin/event`, {
        method: 'POST',
        headers: { Cookie: `frontier_session=${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(response.status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => production.close(() => resolve()));
    }
  });
});
