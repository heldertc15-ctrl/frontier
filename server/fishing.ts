import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { fishingConfig, type BaitId, type FishSpecies, type RodId } from './fishingConfig.js';
import {
  calculateFishing,
  fishingAttemptDurationMs,
  speciesSharePercent,
} from './fishingCalculation.js';
import {
  advanceFishingEventClock,
  createFishingEventCycle,
  type FishingEventClock,
  type FishingEventType,
} from './fishingRandomEvents.js';
import { formatFishWeightKg } from './fishWeightFormat.js';
import {
  isSeaState,
  seaSnapshot,
  seaSnapshotWithin,
  updateSeaOverrideWithin,
  updateTimeOverrideWithin,
  type SeaSnapshot,
} from './seaState.js';
import {
  ADMIN_INVENTORY_CAPACITY,
  inventoryCapacityForCharacter,
  itemDefinition,
  itemDefinitions,
} from './inventory.js';
export { adminAllowed } from './adminAccess.js';
import {
  insertFishSpecimen,
  insertUnknownFishSpecimens,
  isFish,
  isTrophy,
  removeFishSpecimens,
  sampleFishWeight,
  sampleTrophyWeight,
} from './fishSpecimens.js';

type Failure = { error: string; message: string };
type ItemRow = { id: string; definition_id: string; quantity: number; location: string };
type SessionRow = {
  id: string;
  character_id: string;
  status: string;
  rod_item_id: string;
  bait_item_id: string;
  started_at: string;
  last_seen_at: string;
  next_attempt_at: string;
  attempt_started_at: string | null;
  attempt_duration_ms: number;
  event_revision: number;
  stopped_at: string | null;
  stop_reason: string | null;
  attempt_count: number;
  catch_count: number;
  latest_species: string | null;
  latest_weight_kg: number | null;
  latest_result: string | null;
};

const id = () => randomBytes(16).toString('hex');
const nowIso = () => new Date().toISOString();
const validCount = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
function character(database: DatabaseSync, accountId: string) {
  return database
    .prepare('SELECT id, current_location, active_status FROM characters WHERE account_id = ?')
    .get(accountId) as { id: string; current_location: string; active_status: string } | undefined;
}
function session(database: DatabaseSync, characterId: string): SessionRow | undefined {
  return database
    .prepare(
      'SELECT * FROM fishing_sessions WHERE character_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1',
    )
    .get(characterId) as SessionRow | undefined;
}
function activeSession(database: DatabaseSync, characterId: string): SessionRow | undefined {
  return database
    .prepare("SELECT * FROM fishing_sessions WHERE character_id = ? AND status = 'active'")
    .get(characterId) as SessionRow | undefined;
}
function carried(database: DatabaseSync, characterId: string, itemId: string): ItemRow | undefined {
  return database
    .prepare(
      "SELECT id, definition_id, quantity, location FROM character_items WHERE id = ? AND character_id = ? AND location = 'inventory'",
    )
    .get(itemId, characterId) as ItemRow | undefined;
}

export interface FishingRandomEvent {
  id: string;
  type: FishingEventType;
  message: string;
  buttonLabel: string;
  sessionId: string;
  attempts: number;
  expiresAt: string;
  windowMs: number;
}
type RandomEventRow = {
  id: string;
  session_id: string;
  attempt_count: number;
  type: FishingEventType;
  source: 'natural' | 'forced';
  status: 'pending' | 'used' | 'cleared';
  created_at: string;
};
function reelPromptExpiresAt(event: RandomEventRow, row: SessionRow): number {
  return Math.min(
    Date.parse(event.created_at) + fishingConfig.randomEvents.reelPromptWindowMs,
    Date.parse(row.next_attempt_at),
  );
}
function publicEvent(event: RandomEventRow, row: SessionRow): FishingRandomEvent {
  const definition = fishingConfig.randomEvents.types[event.type];
  return {
    id: event.id,
    type: event.type,
    message: definition.message,
    buttonLabel: definition.buttonLabel,
    sessionId: event.session_id,
    attempts: event.attempt_count,
    expiresAt: new Date(reelPromptExpiresAt(event, row)).toISOString(),
    windowMs: fishingConfig.randomEvents.reelPromptWindowMs,
  };
}
function pendingEvent(database: DatabaseSync, row: SessionRow): FishingRandomEvent | null {
  const event = database
    .prepare(
      "SELECT * FROM fishing_random_events WHERE session_id = ? AND attempt_count = ? AND type = 'reel_pull' AND status = 'pending' LIMIT 1",
    )
    .get(row.id, row.attempt_count) as RandomEventRow | undefined;
  return event && Date.now() < reelPromptExpiresAt(event, row) ? publicEvent(event, row) : null;
}
function expireReelPromptsWithin(database: DatabaseSync, row: SessionRow, timestamp: string): void {
  const cutoff = new Date(
    Date.parse(timestamp) - fishingConfig.randomEvents.reelPromptWindowMs,
  ).toISOString();
  const expired = database
    .prepare(
      "UPDATE fishing_random_events SET status = 'cleared' WHERE session_id = ? AND attempt_count = ? AND type = 'reel_pull' AND status = 'pending' AND created_at <= ?",
    )
    .run(row.id, row.attempt_count, cutoff);
  if (expired.changes)
    database
      .prepare('UPDATE fishing_sessions SET event_revision = event_revision + 1 WHERE id = ?')
      .run(row.id);
}
function hasAttemptEvent(database: DatabaseSync, row: SessionRow): boolean {
  return Boolean(
    database
      .prepare(
        'SELECT 1 FROM fishing_random_events WHERE session_id = ? AND attempt_count = ? LIMIT 1',
      )
      .get(row.id, row.attempt_count),
  );
}
function clearAttemptEventsWithin(database: DatabaseSync, row: SessionRow): void {
  database
    .prepare(
      "UPDATE fishing_random_events SET status = 'cleared' WHERE session_id = ? AND attempt_count = ? AND status != 'cleared'",
    )
    .run(row.id, row.attempt_count);
}
function validEventAttempt(database: DatabaseSync, row: SessionRow, now = Date.now()): boolean {
  if (
    row.status !== 'active' ||
    now >= Date.parse(row.next_attempt_at) ||
    now - Date.parse(row.last_seen_at) > fishingConfig.livenessMs
  )
    return false;
  const person = database
    .prepare('SELECT current_location, active_status FROM characters WHERE id = ?')
    .get(row.character_id) as { current_location: string; active_status: string } | undefined;
  const rod = carried(database, row.character_id, row.rod_item_id);
  const bait = carried(database, row.character_id, row.bait_item_id);
  return Boolean(
    person?.current_location === fishingConfig.pierId &&
    person.active_status === 'FISHING' &&
    rod &&
    Object.hasOwn(fishingConfig.rods, rod.definition_id) &&
    bait &&
    Object.hasOwn(fishingConfig.baits, bait.definition_id) &&
    bait.quantity > 0,
  );
}
function eventClockWithin(database: DatabaseSync, characterId: string, timestamp: string) {
  const saved = database
    .prepare(
      'SELECT clock_json, last_accounted_at FROM fishing_random_event_clocks WHERE character_id = ?',
    )
    .get(characterId) as { clock_json: string; last_accounted_at: string } | undefined;
  if (saved)
    return {
      clock: JSON.parse(saved.clock_json) as FishingEventClock,
      lastAccountedAt: saved.last_accounted_at,
    };
  const clock = createFishingEventCycle();
  database
    .prepare(
      'INSERT INTO fishing_random_event_clocks (character_id, clock_json, last_accounted_at) VALUES (?, ?, ?)',
    )
    .run(characterId, JSON.stringify(clock), timestamp);
  return { clock, lastAccountedAt: timestamp };
}
function saveEventClockWithin(
  database: DatabaseSync,
  characterId: string,
  clock: FishingEventClock,
  timestamp: string,
) {
  database
    .prepare(
      'UPDATE fishing_random_event_clocks SET clock_json = ?, last_accounted_at = ? WHERE character_id = ?',
    )
    .run(JSON.stringify(clock), timestamp, characterId);
}
function showEventWithin(
  database: DatabaseSync,
  row: SessionRow,
  type: FishingEventType,
  source: 'natural' | 'forced',
  requestKey: string | null = null,
) {
  const eventId = id();
  database
    .prepare(
      "INSERT INTO fishing_random_events (id, session_id, attempt_count, type, source, status, request_key, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
    )
    .run(eventId, row.id, row.attempt_count, type, source, requestKey, nowIso());
  database
    .prepare('UPDATE fishing_sessions SET event_revision = event_revision + 1 WHERE id = ?')
    .run(row.id);
}
// Only live browser heartbeats/actions confirm elapsed active time. Autonomous ticks
// never earn unconfirmed time after a disconnect, and stale reconnects earn no time.
function accountEventTimeWithin(database: DatabaseSync, row: SessionRow, timestamp: string) {
  const saved = eventClockWithin(database, row.character_id, timestamp);
  const accountedAt = new Date(
    Math.max(Date.parse(timestamp), Date.parse(saved.lastAccountedAt)),
  ).toISOString();
  const elapsed =
    Date.now() - Date.parse(row.last_seen_at) <= fishingConfig.livenessMs
      ? Math.max(0, Date.parse(accountedAt) - Date.parse(saved.lastAccountedAt))
      : 0;
  const clock = advanceFishingEventClock(saved.clock, Math.min(elapsed, fishingConfig.livenessMs));
  saveEventClockWithin(database, row.character_id, clock, accountedAt);
  return { clock, accountedAt };
}
function heartbeatEventsWithin(database: DatabaseSync, row: SessionRow, timestamp: string) {
  const { clock, accountedAt } = accountEventTimeWithin(database, row, timestamp);
  expireReelPromptsWithin(database, row, timestamp);
  if (
    clock.pendingCycles.length &&
    validEventAttempt(database, row) &&
    !hasAttemptEvent(database, row)
  ) {
    // An opportunity is consumed only when the response can actually offer its prompt.
    showEventWithin(database, row, 'reel_pull', 'natural');
    const dueCycle = clock.pendingCycles.shift();
    if (dueCycle === clock.cycleNumber) clock.triggeredCount++;
  }
  saveEventClockWithin(database, row.character_id, clock, accountedAt);
}

export function activateFishingEvent(
  database: DatabaseSync,
  accountId: string,
  eventId: unknown,
): { state: FishingState } | Failure {
  if (typeof eventId !== 'string' || !/^[a-f0-9]{32}$/.test(eventId))
    return { error: 'VALIDATION_ERROR', message: 'Choose a current fishing event.' };
  const person = character(database, accountId);
  if (!person) return { error: 'NOT_FOUND', message: 'Character not found.' };
  database.exec('BEGIN IMMEDIATE');
  try {
    const event = database
      .prepare(
        'SELECT e.* FROM fishing_random_events e JOIN fishing_sessions s ON s.id = e.session_id WHERE e.id = ? AND s.character_id = ?',
      )
      .get(eventId, person.id) as RandomEventRow | undefined;
    if (!event) {
      database.exec('COMMIT');
      return { error: 'EVENT_UNAVAILABLE', message: 'That fishing event is unavailable.' };
    }
    if (event.type !== 'reel_pull') {
      if (event.status === 'pending')
        database
          .prepare("UPDATE fishing_random_events SET status = 'cleared' WHERE id = ?")
          .run(event.id);
      database.exec('COMMIT');
      return { error: 'EVENT_UNAVAILABLE', message: 'That fishing event is no longer available.' };
    }
    if (
      event.status === 'pending' &&
      Date.now() >= Date.parse(event.created_at) + fishingConfig.randomEvents.reelPromptWindowMs
    ) {
      database
        .prepare("UPDATE fishing_random_events SET status = 'cleared' WHERE id = ?")
        .run(event.id);
      database
        .prepare('UPDATE fishing_sessions SET event_revision = event_revision + 1 WHERE id = ?')
        .run(event.session_id);
      database.exec('COMMIT');
      return { error: 'EVENT_UNAVAILABLE', message: 'The Reel Pull moment has passed.' };
    }
    const row = activeSession(database, person.id);
    if (
      event.status === 'pending' &&
      (!row ||
        row.id !== event.session_id ||
        row.attempt_count !== event.attempt_count ||
        !validEventAttempt(database, row))
    ) {
      database.exec('COMMIT');
      return { error: 'EVENT_UNAVAILABLE', message: 'That fishing event is no longer available.' };
    }
    if (
      event.status === 'pending' &&
      row &&
      row.id === event.session_id &&
      row.attempt_count === event.attempt_count &&
      validEventAttempt(database, row)
    ) {
      const startedMs = row.attempt_started_at
        ? Date.parse(row.attempt_started_at)
        : Date.parse(row.next_attempt_at) - row.attempt_duration_ms;
      const resolvedAt = Math.max(Date.now(), startedMs + 1);
      database
        .prepare(
          'UPDATE fishing_sessions SET next_attempt_at = ?, attempt_duration_ms = ? WHERE id = ?',
        )
        .run(new Date(resolvedAt).toISOString(), Math.max(1, resolvedAt - startedMs), row.id);
      database
        .prepare("UPDATE fishing_random_events SET status = 'used', used_at = ? WHERE id = ?")
        .run(nowIso(), event.id);
      database
        .prepare('UPDATE fishing_sessions SET event_revision = event_revision + 1 WHERE id = ?')
        .run(row.id);
      resolveAttempt(database, row.id, {
        expectedAttemptCount: row.attempt_count,
        withinTransaction: true,
      });
    }
    database.exec('COMMIT');
    return { state: fishingState(database, accountId)! };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function forceFishingEvent(
  database: DatabaseSync,
  accountId: string,
  input: Record<string, unknown>,
): { state: FishingState } | Failure {
  if (
    typeof input.type !== 'string' ||
    !Object.hasOwn(fishingConfig.randomEvents.types, input.type) ||
    typeof input.sessionId !== 'string' ||
    typeof input.expectedAttemptCount !== 'number' ||
    !Number.isSafeInteger(input.expectedAttemptCount) ||
    input.expectedAttemptCount < 0 ||
    typeof input.requestKey !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(input.requestKey)
  )
    return {
      error: 'VALIDATION_ERROR',
      message: 'Choose an event and provide the current attempt and a request key.',
    };
  const person = character(database, accountId);
  if (!person) return { error: 'NOT_FOUND', message: 'Character not found.' };
  database.exec('BEGIN IMMEDIATE');
  try {
    const row = activeSession(database, person.id);
    const previous = database
      .prepare(
        'SELECT e.id FROM fishing_random_events e JOIN fishing_sessions s ON s.id = e.session_id WHERE s.character_id = ? AND e.session_id = ? AND e.request_key = ?',
      )
      .get(person.id, input.sessionId, input.requestKey);
    let failure: Failure | null = null;
    if (!previous) {
      if (
        !row ||
        row.id !== input.sessionId ||
        row.attempt_count !== input.expectedAttemptCount ||
        !validEventAttempt(database, row)
      )
        failure = {
          error: 'EVENT_UNAVAILABLE',
          message: 'A valid active fishing attempt is required.',
        };
      else if (hasAttemptEvent(database, row))
        failure = {
          error: 'EVENT_UNAVAILABLE',
          message: 'This attempt already received an event. Try the next cast.',
        };
      else
        showEventWithin(database, row, input.type as FishingEventType, 'forced', input.requestKey);
    }
    database.exec('COMMIT');
    return failure ?? { state: fishingState(database, accountId)! };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function stopWithin(database: DatabaseSync, row: SessionRow, reason: string): void {
  const timestamp = nowIso();
  database
    .prepare(
      "UPDATE fishing_sessions SET status = 'stopped', stopped_at = ?, stop_reason = ?, latest_result = ?, event_revision = event_revision + 1 WHERE id = ? AND status = 'active'",
    )
    .run(timestamp, reason, reason, row.id);
  clearAttemptEventsWithin(database, row);
  database
    .prepare("UPDATE characters SET active_status = 'idle', updated_at = ? WHERE id = ?")
    .run(timestamp, row.character_id);
  const event = {
    timestamp,
    event: 'stop',
    sessionId: row.id,
    characterId: row.character_id,
    reason,
    xpMutation: 'not implemented/no mutation',
  };
  database
    .prepare(
      'INSERT INTO fishing_events (id, session_id, timestamp, event, detail_json) VALUES (?, ?, ?, ?, ?)',
    )
    .run(id(), row.id, timestamp, 'stop', JSON.stringify(event));
  console.info('fishing_stop', JSON.stringify(event));
}
export function stopFishingForDeparture(database: DatabaseSync, characterId: string): void {
  const row = session(database, characterId);
  if (!row) return;
  if (row.status === 'active') {
    accountEventTimeWithin(database, row, nowIso());
    stopWithin(database, row, 'Fishing stopped: left Fishing Pier.');
  }
  if (
    database
      .prepare("SELECT 1 FROM fishing_events WHERE session_id = ? AND event = 'depart'")
      .get(row.id)
  )
    return;
  const timestamp = nowIso();
  database
    .prepare(
      'INSERT INTO fishing_events (id, session_id, timestamp, event, detail_json) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      id(),
      row.id,
      timestamp,
      'depart',
      JSON.stringify({ timestamp, event: 'depart', sessionId: row.id, characterId }),
    );
}
export function stopFishing(
  database: DatabaseSync,
  accountId: string,
): { state: FishingState } | Failure {
  const person = character(database, accountId);
  if (!person) return { error: 'NOT_FOUND', message: 'Character not found.' };
  database.exec('BEGIN IMMEDIATE');
  try {
    const row = activeSession(database, person.id);
    if (row) {
      accountEventTimeWithin(database, row, nowIso());
      stopWithin(database, row, 'Fishing stopped.');
    }
    database.exec('COMMIT');
    return { state: fishingState(database, accountId)! };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
export interface FishingState {
  serverTime: string;
  sea: SeaSnapshot['sea'];
  gameTime: SeaSnapshot['gameTime'];
  status: 'idle' | 'active' | 'stopped';
  sessionId: string | null;
  rodItemId: string | null;
  baitItemId: string | null;
  rodName: string | null;
  baitName: string | null;
  baitRemaining: number;
  conditions: SeaSnapshot['conditions'];
  catches: number;
  attempts: number;
  activeAttempt: { startedAt: string; deadlineAt: string; durationMs: number } | null;
  randomEvent: FishingRandomEvent | null;
  eventRevision: number;
  latestCatch: { species: string; weightKg: number; trophy: boolean } | null;
  catchSummary: Array<{
    species: string;
    count: number;
    trophyCount: number;
  }>;
  latestResult: string | null;
  stopReason: string | null;
}

function sessionCatchSummary(database: DatabaseSync, row: SessionRow) {
  const attempts = database
    .prepare('SELECT trace_json FROM fishing_attempts WHERE session_id = ? ORDER BY sequence')
    .all(row.id) as unknown as Array<{ trace_json: string }>;
  const species = new Map<string, { species: string; count: number; trophyCount: number }>();
  for (const attempt of attempts) {
    let trace: {
      species?: unknown;
      weightKg?: unknown;
      inventoryResult?: { action?: string };
    };
    try {
      trace = JSON.parse(attempt.trace_json);
    } catch {
      continue;
    }
    if (!trace || typeof trace !== 'object') continue;
    if (
      typeof trace.species !== 'string' ||
      !isFish(trace.species) ||
      typeof trace.weightKg !== 'number' ||
      !Number.isFinite(trace.weightKg) ||
      trace.weightKg <= 0 ||
      !['merge', 'new stack'].includes(trace.inventoryResult?.action ?? '')
    )
      continue;
    const existing = species.get(trace.species) ?? {
      species: itemDefinition(trace.species)?.name ?? trace.species,
      count: 0,
      trophyCount: 0,
    };
    existing.count++;
    if (isTrophy(trace.species, trace.weightKg)) existing.trophyCount++;
    species.set(trace.species, existing);
  }
  return [...species.values()].sort(
    (a, b) => b.count - a.count || a.species.localeCompare(b.species),
  );
}
export function fishingState(database: DatabaseSync, accountId: string): FishingState | null {
  const person = character(database, accountId);
  if (!person) return null;
  const latest = session(database, person.id);
  const row =
    latest &&
    database
      .prepare("SELECT 1 FROM fishing_events WHERE session_id = ? AND event = 'depart'")
      .get(latest.id)
      ? undefined
      : latest;
  const snapshot = seaSnapshot(database);
  const rod = row ? carried(database, person.id, row.rod_item_id) : undefined;
  const bait = row ? carried(database, person.id, row.bait_item_id) : undefined;
  const latestResult =
    row?.latest_result &&
    /^Caught .+ \(\d+(?:\.\d+)? kg\)\.$/.test(row.latest_result) &&
    row.latest_species &&
    row.latest_weight_kg !== null
      ? `Caught ${itemDefinition(row.latest_species)?.name ?? row.latest_species} (${formatFishWeightKg(row.latest_weight_kg)} kg).`
      : (row?.latest_result ?? null);
  return {
    serverTime: snapshot.serverTime,
    sea: snapshot.sea,
    gameTime: snapshot.gameTime,
    status: row ? (row.status as 'active' | 'stopped') : 'idle',
    sessionId: row?.id ?? null,
    rodItemId: row?.rod_item_id ?? null,
    baitItemId: row?.bait_item_id ?? null,
    rodName: row
      ? (itemDefinition(rod?.definition_id ?? '')?.name ??
        itemDefinition(
          (
            database
              .prepare('SELECT definition_id FROM character_items WHERE id = ?')
              .get(row.rod_item_id) as { definition_id: string } | undefined
          )?.definition_id ?? '',
        )?.name ??
        'Rod unavailable')
      : null,
    baitName: row ? (itemDefinition(bait?.definition_id ?? '')?.name ?? 'Bait unavailable') : null,
    baitRemaining: bait?.quantity ?? 0,
    conditions: snapshot.conditions,
    catches: row?.catch_count ?? 0,
    attempts: row?.attempt_count ?? 0,
    randomEvent: row?.status === 'active' ? pendingEvent(database, row) : null,
    eventRevision: row?.event_revision ?? 0,
    activeAttempt:
      row?.status === 'active'
        ? {
            startedAt:
              row.attempt_started_at ??
              new Date(Date.parse(row.next_attempt_at) - row.attempt_duration_ms).toISOString(),
            deadlineAt: row.next_attempt_at,
            durationMs: row.attempt_duration_ms,
          }
        : null,
    latestCatch:
      row?.latest_species && row.latest_weight_kg !== null
        ? {
            species: itemDefinition(row.latest_species)?.name ?? row.latest_species,
            weightKg: row.latest_weight_kg,
            trophy:
              isFish(row.latest_species) && isTrophy(row.latest_species, row.latest_weight_kg),
          }
        : null,
    catchSummary: row?.catch_count ? sessionCatchSummary(database, row) : [],
    latestResult,
    stopReason: row?.stop_reason ?? null,
  };
}
export function fishingPreview(
  database: DatabaseSync,
  accountId: string,
  rodItemId: unknown,
  baitItemId: unknown,
) {
  if (typeof rodItemId !== 'string' || typeof baitItemId !== 'string' || rodItemId === baitItemId)
    return { error: 'VALIDATION_ERROR', message: 'Choose a carried rod and bait.' };
  database.exec('BEGIN IMMEDIATE');
  try {
    const person = character(database, accountId);
    const rod = person && carried(database, person.id, rodItemId);
    const bait = person && carried(database, person.id, baitItemId);
    if (
      !person ||
      person.current_location !== fishingConfig.pierId ||
      !rod ||
      !Object.hasOwn(fishingConfig.rods, rod.definition_id) ||
      !bait ||
      !Object.hasOwn(fishingConfig.baits, bait.definition_id) ||
      bait.quantity < 1
    ) {
      database.exec('COMMIT');
      return {
        error: 'FISHING_NOT_READY',
        message: 'Be at Fishing Pier with a carried rod and bait.',
      };
    }
    const snapshot = seaSnapshotWithin(database);
    const calculation = calculateFishing(
      rod.definition_id as RodId,
      bait.definition_id as BaitId,
      snapshot.conditions,
    );
    const result = {
      rodItemId,
      baitItemId,
      rod: itemDefinition(rod.definition_id)!,
      bait: itemDefinition(bait.definition_id)!,
      serverTime: snapshot.serverTime,
      conditions: snapshot.conditions,
      sea: snapshot.sea,
      gameTime: snapshot.gameTime,
      seaEffect:
        calculation.modifiers.seaState > 1
          ? 'improved'
          : calculation.modifiers.seaState < 1
            ? 'reduced'
            : 'neutral',
      possibleSpecies: (Object.keys(calculation.speciesWeights) as FishSpecies[]).map((species) => {
        const discovered = Boolean(
          database
            .prepare(
              'SELECT 1 FROM character_discovered_fish WHERE character_id = ? AND species_id = ?',
            )
            .get(person.id, species),
        );
        return {
          ...itemDefinition(species)!,
          discovered,
          ...(discovered
            ? { catchSharePercent: speciesSharePercent(calculation.speciesWeights, species) }
            : {}),
        };
      }),
    };
    database.exec('COMMIT');
    return { preview: result };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
export function startFishing(
  database: DatabaseSync,
  accountId: string,
  rodItemId: unknown,
  baitItemId: unknown,
): { state: FishingState } | Failure {
  if (typeof rodItemId !== 'string' || typeof baitItemId !== 'string' || rodItemId === baitItemId)
    return { error: 'VALIDATION_ERROR', message: 'Choose a carried rod and bait.' };
  const person = character(database, accountId);
  if (!person) return { error: 'NOT_FOUND', message: 'Character not found.' };
  database.exec('BEGIN IMMEDIATE');
  try {
    const existing = activeSession(database, person.id);
    if (existing) {
      database.exec('COMMIT');
      return existing.rod_item_id === rodItemId && existing.bait_item_id === baitItemId
        ? { state: fishingState(database, accountId)! }
        : { error: 'ALREADY_FISHING', message: 'Stop your current fishing session first.' };
    }
    const rod = carried(database, person.id, rodItemId);
    const bait = carried(database, person.id, baitItemId);
    if (
      person.current_location !== fishingConfig.pierId ||
      person.active_status !== 'idle' ||
      !rod ||
      !(rod.definition_id in fishingConfig.rods) ||
      !bait ||
      !(bait.definition_id in fishingConfig.baits) ||
      bait.quantity < 1
    ) {
      database.exec('COMMIT');
      return {
        error: 'FISHING_NOT_READY',
        message: 'Be at Fishing Pier with a carried rod and bait.',
      };
    }
    const snapshot = seaSnapshotWithin(database);
    const timestamp = snapshot.serverTime;
    const durationMs = fishingAttemptDurationMs(rod.definition_id as RodId, snapshot.conditions);
    database
      .prepare(
        `INSERT INTO fishing_sessions (id, character_id, status, rod_item_id, bait_item_id, started_at, last_seen_at, next_attempt_at, attempt_started_at, attempt_duration_ms)
      VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id(),
        person.id,
        rodItemId,
        baitItemId,
        timestamp,
        timestamp,
        new Date(Date.parse(timestamp) + durationMs).toISOString(),
        timestamp,
        durationMs,
      );
    database
      .prepare("UPDATE characters SET active_status = 'FISHING', updated_at = ? WHERE id = ?")
      .run(timestamp, person.id);
    // A new session resumes the saved active-time cycle, excluding the stopped interval.
    eventClockWithin(database, person.id, timestamp);
    database
      .prepare(
        'UPDATE fishing_random_event_clocks SET last_accounted_at = ? WHERE character_id = ?',
      )
      .run(timestamp, person.id);
    database.exec('COMMIT');
    return { state: fishingState(database, accountId)! };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function pickSpecies(
  table: Partial<Record<FishSpecies, number>>,
  roll: number,
): FishSpecies {
  const eligible = (Object.entries(table) as Array<[FishSpecies, number]>).filter(
    ([, weight]) => Number.isFinite(weight) && weight > 0,
  );
  if (!eligible.length) throw new Error('Fishing requires a positive eligible species weight.');
  const total = eligible.reduce((sum, [, weight]) => sum + weight, 0);
  let cumulative = 0;
  for (const [species, weight] of eligible) {
    cumulative += weight;
    if (roll * total < cumulative) return species;
  }
  return eligible.at(-1)![0];
}
export function resolveAttempt(
  database: DatabaseSync,
  sessionId: string,
  options: {
    forced?: boolean;
    scheduled?: boolean;
    forceSuccess?: boolean;
    forceTrophy?: boolean;
    actor?: string;
    requestKey?: string;
    expectedAttemptCount?: number;
    random?: () => number;
    withinTransaction?: boolean;
  } = {},
): void {
  if (!options.withinTransaction) database.exec('BEGIN IMMEDIATE');
  try {
    const row = database.prepare('SELECT * FROM fishing_sessions WHERE id = ?').get(sessionId) as
      SessionRow | undefined;
    if (!row || row.status !== 'active') {
      if (!options.withinTransaction) database.exec('COMMIT');
      return;
    }
    if (options.scheduled && Date.now() < Date.parse(row.next_attempt_at)) {
      if (!options.withinTransaction) database.exec('COMMIT');
      return;
    }
    if (
      options.expectedAttemptCount !== undefined &&
      row.attempt_count !== options.expectedAttemptCount
    ) {
      if (!options.withinTransaction) database.exec('COMMIT');
      return;
    }
    if (
      options.requestKey &&
      database
        .prepare('SELECT 1 FROM fishing_attempts WHERE request_key = ?')
        .get(options.requestKey)
    ) {
      if (!options.withinTransaction) database.exec('COMMIT');
      return;
    }
    const person = database
      .prepare('SELECT current_location, active_status FROM characters WHERE id = ?')
      .get(row.character_id) as { current_location: string; active_status: string };
    const rod = carried(database, row.character_id, row.rod_item_id);
    const bait = carried(database, row.character_id, row.bait_item_id);
    const snapshot = seaSnapshotWithin(database);
    const conditions = snapshot.conditions;
    const locationValid = person.current_location === fishingConfig.pierId;
    const activityValid = person.active_status === 'FISHING';
    const equipmentValid = Boolean(
      rod &&
      rod.definition_id in fishingConfig.rods &&
      bait &&
      bait.definition_id in fishingConfig.baits &&
      bait.quantity > 0,
    );
    const sessionLive = Date.now() - Date.parse(row.last_seen_at) <= fishingConfig.livenessMs;
    const trace: Record<string, unknown> = {
      timestamp: snapshot.serverTime,
      attemptId: `${row.id}:${row.attempt_count + 1}`,
      attemptStartedAt: row.attempt_started_at,
      attemptDeadlineAt: row.next_attempt_at,
      attemptDurationMs: row.attempt_duration_ms,
      sessionId: row.id,
      characterId: row.character_id,
      forced: Boolean(options.forced),
      forceSuccess: Boolean(options.forceSuccess),
      forceTrophy: Boolean(options.forceTrophy),
      actor: options.actor ?? null,
      location: person.current_location,
      locationValid,
      activityValid,
      equipmentValid,
      sessionLive,
      rodItemId: row.rod_item_id,
      rodDefinitionId: rod?.definition_id ?? null,
      baitItemId: row.bait_item_id,
      baitDefinitionId: bait?.definition_id ?? null,
      baitBefore: bait?.quantity ?? 0,
      baitAfter: bait?.quantity ?? 0,
      conditions: {
        timeOfDay: conditions.timeOfDay,
        seaState: conditions.seaState,
      },
      sea: { ...snapshot.sea, overrideState: snapshot.overrideState },
      gameTime: snapshot.gameTime,
      rodBaseChance: null,
      modifiers: null,
      finalProbability: null,
      successRoll: null,
      success: null,
      speciesWeights: null,
      speciesRoll: null,
      species: null,
      weightKg: null,
      inventoryResult: 'not evaluated',
      xpMutation: 'not implemented/no mutation',
      stopReason: null,
    };
    let result = 'No catch.';
    let catchSpecies: FishSpecies | null = null;
    let catchWeight: number | null = null;
    if (!sessionLive || !locationValid || !activityValid || !equipmentValid) {
      result = !sessionLive
        ? 'Fishing stopped: session inactive.'
        : !locationValid
          ? 'Fishing stopped: left Fishing Pier.'
          : !activityValid
            ? 'Fishing stopped: activity changed.'
            : 'Fishing stopped: selected rod or bait unavailable.';
      trace.stopReason = result;
      stopWithin(database, row, result);
    } else {
      const timestamp = nowIso();
      if (bait!.quantity === 1)
        database.prepare('DELETE FROM character_items WHERE id = ?').run(bait!.id);
      else
        database
          .prepare(
            'UPDATE character_items SET quantity = quantity - 1, updated_at = ? WHERE id = ?',
          )
          .run(timestamp, bait!.id);
      trace.baitAfter = bait!.quantity - 1;
      const calculation = calculateFishing(
        rod!.definition_id as RodId,
        bait!.definition_id as BaitId,
        conditions,
      );
      const speciesWeights = calculation.speciesWeights;
      Object.assign(trace, {
        normalSpeciesWeights: calculation.speciesWeights,
        speciesWeights,
      });
      const { rodBaseChance: base, modifiers, probability } = calculation;
      const random = options.random ?? Math.random;
      const successRoll = random();
      const success =
        Boolean(options.forceSuccess || options.forceTrophy) || successRoll < probability;
      Object.assign(trace, {
        rodBaseChance: base,
        modifiers,
        finalProbability: probability,
        successRoll,
        success,
      });
      if (success) {
        const weights = speciesWeights;
        const speciesRoll = random();
        const species = pickSpecies(weights, speciesRoll);
        const weightKg = options.forceTrophy
          ? sampleTrophyWeight(species, random())
          : sampleFishWeight(species, random());
        Object.assign(trace, { speciesWeights: weights, speciesRoll, species, weightKg });
        const existing = database
          .prepare(
            "SELECT id, quantity FROM character_items WHERE character_id = ? AND definition_id = ? AND location = 'inventory' AND quantity < 10 ORDER BY created_at, id LIMIT 1",
          )
          .get(row.character_id, species) as { id: string; quantity: number } | undefined;
        const slots = (
          database
            .prepare(
              "SELECT count(*) AS count FROM character_items WHERE character_id = ? AND location = 'inventory'",
            )
            .get(row.character_id) as { count: number }
        ).count;
        if (existing) {
          database
            .prepare(
              'UPDATE character_items SET quantity = quantity + 1, updated_at = ? WHERE id = ?',
            )
            .run(timestamp, existing.id);
          insertFishSpecimen(database, existing.id, weightKg, 'catch', timestamp);
          trace.inventoryResult = {
            action: 'merge',
            before: existing.quantity,
            after: existing.quantity + 1,
            slots,
          };
        } else if (slots < inventoryCapacityForCharacter(database, row.character_id)) {
          const stackId = id();
          database
            .prepare(
              "INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, 1, 'inventory', 0, ?, ?)",
            )
            .run(stackId, row.character_id, species, timestamp, timestamp);
          insertFishSpecimen(database, stackId, weightKg, 'catch', timestamp);
          trace.inventoryResult = { action: 'new stack', before: 0, after: 1, slots: slots + 1 };
        } else {
          result = 'Fishing stopped: inventory full.';
          trace.inventoryResult = { action: 'rejected', slots };
          trace.stopReason = result;
          stopWithin(database, row, result);
        }
        if (!trace.stopReason) {
          catchSpecies = species;
          catchWeight = weightKg;
          const discovery = database
            .prepare(
              'INSERT OR IGNORE INTO character_discovered_fish (character_id, species_id, discovered_at) VALUES (?, ?, ?)',
            )
            .run(row.character_id, species, timestamp);
          trace.firstDiscovery = discovery.changes > 0;
          result = `Caught ${itemDefinition(species)!.name} (${formatFishWeightKg(weightKg)} kg).`;
        }
      } else trace.inventoryResult = { action: 'no catch' };
      if (!trace.stopReason && bait!.quantity === 1) {
        trace.stopReason = 'Fishing stopped: bait depleted.';
        stopWithin(database, row, String(trace.stopReason));
      }
    }
    // Schedule only after a committed attempt can continue, using the resolution conditions.
    // No elapsed intervals are replayed; forced attempts also begin one fresh cycle from now.
    const nextDurationMs = trace.stopReason
      ? row.attempt_duration_ms
      : fishingAttemptDurationMs(rod!.definition_id as RodId, conditions);
    const nextStartedAt = trace.stopReason ? row.attempt_started_at : snapshot.serverTime;
    const nextDeadlineAt = trace.stopReason
      ? row.next_attempt_at
      : new Date(Date.parse(snapshot.serverTime) + nextDurationMs).toISOString();
    database
      .prepare(
        `UPDATE fishing_sessions SET attempt_count = attempt_count + 1, catch_count = catch_count + ?,
      latest_species = COALESCE(?, latest_species), latest_weight_kg = COALESCE(?, latest_weight_kg),
      latest_result = ?, next_attempt_at = ?, attempt_started_at = ?, attempt_duration_ms = ?,
      event_revision = event_revision + 1 WHERE id = ?`,
      )
      .run(
        catchSpecies ? 1 : 0,
        catchSpecies,
        catchWeight,
        result,
        nextDeadlineAt,
        nextStartedAt,
        nextDurationMs,
        row.id,
      );
    clearAttemptEventsWithin(database, row);
    database
      .prepare(
        'INSERT INTO fishing_attempts (id, session_id, sequence, request_key, trace_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        id(),
        row.id,
        row.attempt_count + 1,
        options.requestKey ?? null,
        JSON.stringify(trace),
        String(trace.timestamp),
      );
    console.info('fishing_attempt', JSON.stringify(trace));
    if (!options.withinTransaction) database.exec('COMMIT');
  } catch (error) {
    if (!options.withinTransaction) database.exec('ROLLBACK');
    throw error;
  }
}
export function touchFishing(database: DatabaseSync, accountId: string): FishingState | null {
  const person = character(database, accountId);
  if (!person) return null;
  database.exec('BEGIN IMMEDIATE');
  try {
    const row = activeSession(database, person.id);
    if (row) {
      if (Date.now() - Date.parse(row.last_seen_at) > fishingConfig.livenessMs)
        stopWithin(database, row, 'Fishing stopped: session inactive.');
      else {
        const timestamp = nowIso();
        heartbeatEventsWithin(database, row, timestamp);
        database
          .prepare('UPDATE fishing_sessions SET last_seen_at = ? WHERE id = ?')
          .run(timestamp, row.id);
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return fishingState(database, accountId);
}
export function tickFishing(database: DatabaseSync): void {
  const active = database
    .prepare("SELECT * FROM fishing_sessions WHERE status = 'active'")
    .all() as unknown as SessionRow[];
  for (const row of active) {
    if (Date.now() - Date.parse(row.last_seen_at) > fishingConfig.livenessMs) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const fresh = activeSession(database, row.character_id);
        if (fresh && Date.now() - Date.parse(fresh.last_seen_at) > fishingConfig.livenessMs)
          stopWithin(database, fresh, 'Fishing stopped: session inactive.');
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    } else if (Date.now() >= Date.parse(row.next_attempt_at))
      resolveAttempt(database, row.id, { scheduled: true });
  }
}
export function resetFishingAfterRestart(database: DatabaseSync): void {
  database.exec('BEGIN IMMEDIATE');
  try {
    const active = database
      .prepare("SELECT * FROM fishing_sessions WHERE status = 'active'")
      .all() as unknown as SessionRow[];
    for (const row of active) stopWithin(database, row, 'Fishing stopped: server restarted.');
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
export function adminFishingData(database: DatabaseSync, accountId: string) {
  const person = character(database, accountId)!;
  const worldSnapshot = seaSnapshot(database);
  const row = session(database, person.id);
  const savedClock = database
    .prepare('SELECT clock_json FROM fishing_random_event_clocks WHERE character_id = ?')
    .get(person.id) as { clock_json: string } | undefined;
  const clock = savedClock ? (JSON.parse(savedClock.clock_json) as FishingEventClock) : null;
  const traces = database
    .prepare(
      'SELECT a.trace_json FROM fishing_attempts a JOIN fishing_sessions s ON s.id = a.session_id WHERE s.character_id = ? ORDER BY a.created_at DESC, a.rowid DESC LIMIT 100',
    )
    .all(person.id) as unknown as Array<{ trace_json: string }>;
  const events = database
    .prepare(
      'SELECT e.detail_json FROM fishing_events e JOIN fishing_sessions s ON s.id = e.session_id WHERE s.character_id = ? ORDER BY e.timestamp DESC, e.rowid DESC LIMIT 100',
    )
    .all(person.id) as unknown as Array<{ detail_json: string }>;
  const audit = database
    .prepare(
      'SELECT timestamp, action, detail_json FROM admin_inventory_audit WHERE character_id = ? ORDER BY timestamp DESC LIMIT 50',
    )
    .all(person.id) as unknown as Array<{ timestamp: string; action: string; detail_json: string }>;
  return {
    randomEvents: {
      cycleDurationMs: fishingConfig.randomEvents.cycleDurationMs,
      elapsedMs: clock?.elapsedMs ?? 0,
      nextEventInMs: clock?.pendingCycles.length
        ? 0
        : clock && clock.nextIndex < clock.scheduleMs.length
          ? Math.max(0, clock.scheduleMs[clock.nextIndex] - clock.elapsedMs)
          : null,
      triggeredCount: clock?.triggeredCount ?? 0,
      scheduleMs: clock?.scheduleMs ?? [],
      currentEvent: row?.status === 'active' ? pendingEvent(database, row) : null,
      canForce: Boolean(row && validEventAttempt(database, row) && !hasAttemptEvent(database, row)),
    },
    seaOverrideState: worldSnapshot.overrideState,
    timeOverrideState: worldSnapshot.timeOverrideState,
    discoveredFish: (
      database
        .prepare(
          'SELECT species_id FROM character_discovered_fish WHERE character_id = ? ORDER BY discovered_at, species_id',
        )
        .all(person.id) as unknown as Array<{ species_id: string }>
    ).map((row) => row.species_id),
    config: fishingConfig,
    definitions: itemDefinitions(),
    traces: traces.map((entry) => JSON.parse(entry.trace_json)),
    events: events.map((entry) => JSON.parse(entry.detail_json)),
    audit: audit.map((entry) => ({
      timestamp: entry.timestamp,
      action: entry.action,
      detail: JSON.parse(entry.detail_json),
    })),
  };
}
export function overrideConditions(
  database: DatabaseSync,
  values: Record<string, unknown>,
):
  | Failure
  | {
      conditions: FishingState['conditions'];
      sea: FishingState['sea'];
      gameTime: FishingState['gameTime'];
      serverTime: string;
      previousOverride: string | null;
      overrideState: string | null;
      previousTimeOverride: string | null;
      timeOverrideState: string | null;
    } {
  if (
    !Object.keys(values).length ||
    Object.keys(values).some((key) => !['timeOfDay', 'seaState'].includes(key))
  )
    return { error: 'VALIDATION_ERROR', message: 'Choose a valid condition override.' };
  for (const key of Object.keys(values) as Array<keyof typeof values>) {
    if (key === 'seaState') {
      if (values[key] !== null && !isSeaState(values[key]))
        return { error: 'VALIDATION_ERROR', message: 'Invalid seaState condition.' };
      continue;
    }
    if (key === 'timeOfDay') {
      if (
        values[key] !== null &&
        (typeof values[key] !== 'string' ||
          !Object.hasOwn(fishingConfig.conditions.timeOfDay, values[key]))
      )
        return { error: 'VALIDATION_ERROR', message: 'Invalid timeOfDay condition.' };
      continue;
    }
  }
  database.exec('BEGIN IMMEDIATE');
  try {
    const before = seaSnapshotWithin(database);
    if (Object.hasOwn(values, 'seaState'))
      updateSeaOverrideWithin(database, values.seaState as SeaSnapshot['overrideState']);
    if (Object.hasOwn(values, 'timeOfDay'))
      updateTimeOverrideWithin(database, values.timeOfDay as SeaSnapshot['timeOverrideState']);
    const after = seaSnapshotWithin(database);
    database.exec('COMMIT');
    return {
      conditions: after.conditions,
      sea: after.sea,
      gameTime: after.gameTime,
      serverTime: after.serverTime,
      previousOverride: before.overrideState,
      overrideState: after.overrideState,
      previousTimeOverride: before.timeOverrideState,
      timeOverrideState: after.timeOverrideState,
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
export function resetFishDiscoveries(database: DatabaseSync, accountId: string, actor: string) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const person = character(database, accountId);
    if (!person) {
      database.exec('COMMIT');
      return { error: 'NOT_FOUND', message: 'Character not found.' };
    }
    const removed = database
      .prepare('DELETE FROM character_discovered_fish WHERE character_id = ?')
      .run(person.id).changes;
    database.exec('COMMIT');
    console.info(
      'fishing_discovery_reset',
      JSON.stringify({ actor, characterId: person.id, timestamp: nowIso(), removed }),
    );
    return { removed };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
export function forceFishing(
  database: DatabaseSync,
  accountId: string,
  actor: string,
  requestKey: unknown,
  forceSuccess: unknown,
  expectedAttemptCount: unknown,
  forceTrophy: unknown = false,
): { state: FishingState } | Failure {
  if (
    typeof requestKey !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey) ||
    typeof forceSuccess !== 'boolean' ||
    typeof forceTrophy !== 'boolean' ||
    typeof expectedAttemptCount !== 'number' ||
    !Number.isSafeInteger(expectedAttemptCount) ||
    expectedAttemptCount < 0
  )
    return {
      error: 'VALIDATION_ERROR',
      message: 'Provide a request key, expected attempt count, and valid force choices.',
    };
  const person = character(database, accountId)!;
  const latest = session(database, person.id);
  if (
    latest &&
    database
      .prepare('SELECT 1 FROM fishing_attempts WHERE request_key = ?')
      .get(`${latest.id}:${requestKey}`)
  )
    return { state: fishingState(database, accountId)! };
  const row = activeSession(database, person.id);
  if (!row) return { error: 'NOT_FISHING', message: 'Start fishing before forcing an attempt.' };
  if (row.attempt_count !== expectedAttemptCount)
    return { state: fishingState(database, accountId)! };
  resolveAttempt(database, row.id, {
    forced: true,
    forceSuccess,
    forceTrophy,
    actor,
    requestKey: `${row.id}:${requestKey}`,
    expectedAttemptCount,
  });
  return { state: fishingState(database, accountId)! };
}
export function adminInventoryMutation(
  database: DatabaseSync,
  accountId: string,
  actor: string,
  input: Record<string, unknown>,
): { inventoryChanged: true } | Failure {
  const person = character(database, accountId)!;
  const action = input.action;
  const targetId = input.itemId;
  const quantity = input.quantity;
  const requestKey =
    typeof input.requestKey === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(input.requestKey)
      ? input.requestKey
      : null;
  const timestamp = nowIso();
  database.exec('BEGIN IMMEDIATE');
  try {
    if (requestKey) {
      const previous = database
        .prepare(
          'SELECT detail_json FROM admin_inventory_audit WHERE actor_account_id = ? AND request_key = ?',
        )
        .get(accountId, requestKey) as { detail_json: string } | undefined;
      if (previous) {
        database.exec('COMMIT');
        const detail = JSON.parse(previous.detail_json) as { outcome: string; message?: string };
        return detail.outcome === 'success'
          ? { inventoryChanged: true }
          : {
              error: detail.outcome,
              message: detail.message ?? 'The previous request was rejected.',
            };
      }
    }
    const beforeSlots = (
      database
        .prepare(
          "SELECT count(*) AS count FROM character_items WHERE character_id = ? AND location = 'inventory'",
        )
        .get(person.id) as { count: number }
    ).count;
    const beforeLockerSlots = (
      database
        .prepare(
          "SELECT count(*) AS count FROM character_items WHERE character_id = ? AND location = 'locker'",
        )
        .get(person.id) as { count: number }
    ).count;
    const row =
      typeof targetId === 'string'
        ? (database
            .prepare(
              "SELECT id, definition_id, quantity, location FROM character_items WHERE id = ? AND character_id = ? AND location IN ('inventory', 'locker')",
            )
            .get(targetId, person.id) as ItemRow | undefined)
        : undefined;
    const definition =
      typeof input.definitionId === 'string' ? itemDefinition(input.definitionId) : null;
    const definitionQuantity = () =>
      definition
        ? (
            database
              .prepare(
                "SELECT COALESCE(sum(quantity), 0) AS quantity FROM character_items WHERE character_id = ? AND definition_id = ? AND location = 'inventory'",
              )
              .get(person.id, definition.id) as { quantity: number }
          ).quantity
        : null;
    const beforeDefinitionQuantity = definitionQuantity();
    let failure: Failure | null = null;
    const removed: Array<{ id: string; definitionId: string; quantity: number }> = [];
    if (!requestKey)
      failure = {
        error: 'VALIDATION_ERROR',
        message: 'Provide a request key for this inventory action.',
      };
    else if (action === 'add') {
      if (!definition || !validCount(quantity))
        failure = {
          error: 'VALIDATION_ERROR',
          message: 'Choose a defined item and positive whole quantity.',
        };
      else if (
        !definition.stackable &&
        beforeSlots + (quantity as number) > ADMIN_INVENTORY_CAPACITY
      )
        failure = { error: 'INVENTORY_FULL', message: 'Your carried inventory is full.' };
      else {
        let remaining = quantity as number;
        if (definition.stackable) {
          const matches = database
            .prepare(
              "SELECT id, quantity FROM character_items WHERE character_id = ? AND definition_id = ? AND location = 'inventory' ORDER BY created_at",
            )
            .all(person.id, definition.id) as unknown as Array<{ id: string; quantity: number }>;
          for (const match of matches) {
            const amount = Math.min(remaining, definition.maxStack - match.quantity);
            if (amount > 0) {
              database
                .prepare(
                  'UPDATE character_items SET quantity = quantity + ?, updated_at = ? WHERE id = ?',
                )
                .run(amount, timestamp, match.id);
              if (isFish(definition.id)) insertUnknownFishSpecimens(database, match.id, amount);
              remaining -= amount;
            }
          }
        }
        const needed = definition.stackable
          ? Math.ceil(remaining / definition.maxStack)
          : remaining;
        if (beforeSlots + needed > ADMIN_INVENTORY_CAPACITY)
          failure = { error: 'INVENTORY_FULL', message: 'Your carried inventory is full.' };
        else
          while (remaining > 0) {
            const amount = definition.stackable ? Math.min(remaining, definition.maxStack) : 1;
            const stackId = id();
            database
              .prepare(
                "INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, ?, 'inventory', 0, ?, ?)",
              )
              .run(stackId, person.id, definition.id, amount, timestamp, timestamp);
            if (isFish(definition.id)) insertUnknownFishSpecimens(database, stackId, amount);
            remaining -= amount;
          }
      }
    } else if (action === 'remove' || action === 'delete') {
      if (
        !row ||
        (action === 'remove' && row.location !== 'inventory') ||
        (action === 'remove' && (!validCount(quantity) || (quantity as number) > row.quantity))
      )
        failure = {
          error: 'ITEM_NOT_AVAILABLE',
          message:
            action === 'delete'
              ? 'Choose an owned carried or stored stack.'
              : 'Choose an owned carried stack and valid quantity.',
        };
      else {
        removed.push({
          id: row.id,
          definitionId: row.definition_id,
          quantity: action === 'delete' ? row.quantity : (quantity as number),
        });
        if (action === 'delete' || row.quantity === quantity)
          database.prepare('DELETE FROM character_items WHERE id = ?').run(row.id);
        else {
          if (isFish(row.definition_id)) removeFishSpecimens(database, row.id, quantity as number);
          database
            .prepare(
              'UPDATE character_items SET quantity = quantity - ?, updated_at = ? WHERE id = ?',
            )
            .run(quantity as number, timestamp, row.id);
        }
      }
    } else if (action === 'clear' || action === 'clear_locker') {
      const location = action === 'clear_locker' ? 'locker' : 'inventory';
      const items = database
        .prepare(
          'SELECT id, definition_id, quantity FROM character_items WHERE character_id = ? AND location = ?',
        )
        .all(person.id, location) as unknown as Array<{
        id: string;
        definition_id: string;
        quantity: number;
      }>;
      removed.push(
        ...items.map((item) => ({
          id: item.id,
          definitionId: item.definition_id,
          quantity: item.quantity,
        })),
      );
      database
        .prepare('DELETE FROM character_items WHERE character_id = ? AND location = ?')
        .run(person.id, location);
    } else failure = { error: 'VALIDATION_ERROR', message: 'Unknown inventory action.' };
    const afterSlots = failure
      ? beforeSlots
      : (
          database
            .prepare(
              "SELECT count(*) AS count FROM character_items WHERE character_id = ? AND location = 'inventory'",
            )
            .get(person.id) as { count: number }
        ).count;
    const afterLockerSlots = failure
      ? beforeLockerSlots
      : (
          database
            .prepare(
              "SELECT count(*) AS count FROM character_items WHERE character_id = ? AND location = 'locker'",
            )
            .get(person.id) as { count: number }
        ).count;
    const detail = {
      requestKey,
      targetId: targetId ?? null,
      targetLocation: row?.location ?? null,
      definitionId: input.definitionId ?? row?.definition_id ?? null,
      requestedQuantity: quantity ?? null,
      beforeQuantity: row?.quantity ?? beforeDefinitionQuantity,
      afterQuantity: failure
        ? (row?.quantity ?? beforeDefinitionQuantity)
        : row
          ? ((
              database
                .prepare('SELECT quantity FROM character_items WHERE id = ? AND character_id = ?')
                .get(row.id, person.id) as { quantity: number } | undefined
            )?.quantity ?? 0)
          : definitionQuantity(),
      beforeSlots,
      afterSlots,
      beforeLockerSlots,
      afterLockerSlots,
      removed,
      capacityOverride: false,
      outcome: failure?.error ?? 'success',
      message: failure?.message ?? null,
    };
    if (failure) database.exec('ROLLBACK');
    database
      .prepare(
        'INSERT INTO admin_inventory_audit (id, timestamp, actor_account_id, character_id, request_key, action, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id(),
        timestamp,
        accountId,
        person.id,
        requestKey,
        String(action),
        JSON.stringify({ ...detail, actor }),
      );
    if (!failure) database.exec('COMMIT');
    console.info(
      'admin_inventory_mutation',
      JSON.stringify({ timestamp, actor, characterId: person.id, action, ...detail }),
    );
    return failure ?? { inventoryChanged: true };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
