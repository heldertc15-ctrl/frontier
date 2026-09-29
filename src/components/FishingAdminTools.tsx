import { useCallback, useEffect, useRef, useState } from 'react';
import type { ItemDefinition, InventoryState } from '../../server/inventory';
import type { FishingState } from '../../server/fishing';
import {
  fishingIds,
  type BaitId,
  type RodId,
  type SeaState,
  type TimeOfDay,
} from '../../server/fishingConfig';
import { calculateFishing } from '../../server/fishingCalculation';
import { isOlderFishingState } from '../fishingAttemptClock';

interface AdminData {
  seaOverrideState: 'Calm' | 'Moderate' | 'Dangerous' | null;
  timeOverrideState: 'Dawn' | 'Day' | 'Dusk' | 'Night' | null;
  discoveredFish: string[];
  definitions: ItemDefinition[];
  inventory: InventoryState;
  fishing: FishingState;
  traces: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
  randomEvents: {
    cycleDurationMs: number;
    elapsedMs: number;
    nextEventInMs: number | null;
    triggeredCount: number;
    scheduleMs: number[];
    currentEvent: FishingState['randomEvent'];
    canForce: boolean;
  };
}
function formatCycleTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
async function request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    signal: AbortSignal.timeout(10_000),
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? 'Admin action failed.');
  return payload as T;
}
export function FishingAdminTools({ onMutation }: { onMutation: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [search, setSearch] = useState('');
  const [definitionId, setDefinitionId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [poolTime, setPoolTime] = useState<TimeOfDay>('Day');
  const [poolSea, setPoolSea] = useState<SeaState>('Calm');
  const [poolBait, setPoolBait] = useState<BaitId>('worm_bait');
  const [poolRod, setPoolRod] = useState<RodId>('basic_fishing_rod');
  const [forceSuccess, setForceSuccess] = useState(false);
  const [forceTrophy, setForceTrophy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearLocker, setConfirmClearLocker] = useState(false);
  const [confirmDeleteStack, setConfirmDeleteStack] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const pendingRef = useRef(false);
  const loadPending = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const load = useCallback(async (afterMutation = false) => {
    if ((pendingRef.current || loadPending.current) && !afterMutation) return;
    const current = ++generation.current;
    loadPending.current = true;
    setLoading(true);
    try {
      const next = await request<AdminData>('/api/fishing/admin');
      if (!mounted.current || current !== generation.current) return;
      setData((previous) =>
        previous && isOlderFishingState(previous.fishing, next.fishing) ? previous : next,
      );
      setLoadError('');
    } catch (cause) {
      if (!mounted.current || current !== generation.current) return;
      setLoadError(cause instanceof Error ? cause.message : 'Could not load fishing test tools.');
    } finally {
      if (mounted.current && current === generation.current) {
        setLoading(false);
        loadPending.current = false;
      }
    }
  }, []);
  useEffect(() => {
    const requests = generation;
    mounted.current = true;
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 2000);
    return () => {
      mounted.current = false;
      requests.current++;
      loadPending.current = false;
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [load]);
  if (!data)
    return (
      <section className="panel fishing-admin" aria-labelledby="fishing-admin-heading">
        <h2 id="fishing-admin-heading">Fishing Debug Console</h2>
        {loading ? (
          <p role="status">Loading authorized tools…</p>
        ) : (
          <>
            <p className="form-error" role="alert">
              {loadError || error}
            </p>
            <button className="button secondary" onClick={() => void load()}>
              Retry
            </button>
          </>
        )}
      </section>
    );
  async function action(path: string, payload: Record<string, unknown>, label: string) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    generation.current++;
    setPending(true);
    setError('');
    setNotice('');
    try {
      await request(
        path,
        path.endsWith('/inventory') ? { ...payload, requestKey: crypto.randomUUID() } : payload,
      );
      if (!mounted.current) return;
      await load(true);
      if (!mounted.current) return;
      if (payload.action === 'delete') setItemId('');
      onMutation();
      setNotice(`${label} completed.`);
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : 'Action failed.');
      await load(true);
    } finally {
      pendingRef.current = false;
      if (mounted.current) setPending(false);
    }
  }
  const matches = data.definitions.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.id.includes(search.toLowerCase()),
  );
  const selectedStack = [...data.inventory.items, ...data.inventory.locker].find(
    (item) => item.instanceId === itemId,
  );
  const events = data.randomEvents;
  const pool = calculateFishing(poolRod, poolBait, {
    timeOfDay: poolTime,
    seaState: poolSea,
  }).speciesWeights;
  const poolTotal = Object.values(pool).reduce((sum, value) => sum + value, 0);
  const forceEventDisabled =
    pending ||
    !!loadError ||
    data.fishing.status !== 'active' ||
    !data.fishing.activeAttempt ||
    !!data.fishing.randomEvent ||
    !events?.canForce;
  return (
    <section className="panel fishing-admin" aria-labelledby="fishing-admin-heading">
      <h2 id="fishing-admin-heading">Fishing Debug Console</h2>
      <p className="muted small">
        Inventory and forced attempts target this character. Time and sea overrides affect the
        shared Fishing Pier zone.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loadError && (
        <p className="form-error" role="alert">
          {loadError} Last confirmed debug state retained; event controls await refresh.
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <button className="button secondary" disabled={pending} onClick={() => void load()}>
        Refresh debug state
      </button>
      <section aria-labelledby="fishing-pool-heading">
        <h3 id="fishing-pool-heading">Catch pool test</h3>
        <p className="small muted">
          Inspect any combination. These selectors do not change the live world or loadout.
        </p>
        <div className="fishing-admin-row">
          <label>
            Time of day{' '}
            <select
              className="input"
              value={poolTime}
              onChange={(event) => setPoolTime(event.target.value as TimeOfDay)}
            >
              {fishingIds.time.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sea state{' '}
            <select
              className="input"
              value={poolSea}
              onChange={(event) => setPoolSea(event.target.value as SeaState)}
            >
              {fishingIds.sea.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bait{' '}
            <select
              className="input"
              value={poolBait}
              onChange={(event) => setPoolBait(event.target.value as BaitId)}
            >
              {fishingIds.bait.map((id) => (
                <option key={id} value={id}>
                  {data.definitions.find((item) => item.id === id)?.name ?? id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rod{' '}
            <select
              className="input"
              value={poolRod}
              onChange={(event) => setPoolRod(event.target.value as RodId)}
            >
              {fishingIds.rod.map((id) => (
                <option key={id} value={id}>
                  {data.definitions.find((item) => item.id === id)?.name ?? id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ul>
          {Object.entries(pool).map(([id, weight]) => (
            <li key={id}>
              {data.definitions.find((item) => item.id === id)?.name ?? id}:{' '}
              {((weight / poolTotal) * 100).toFixed(1)}%
            </li>
          ))}
        </ul>
      </section>
      <section className="fishing-admin-events" aria-labelledby="fishing-admin-events-heading">
        <h3 id="fishing-admin-events-heading">Fishing random events</h3>
        <p className="small muted">
          Live state refreshes every 2 seconds. Forced events leave the natural schedule unchanged.
        </p>
        <div className="fishing-admin-row">
          <button
            type="button"
            className="button secondary"
            disabled={forceEventDisabled}
            aria-describedby="fishing-admin-event-readiness"
            onClick={() =>
              void action(
                '/api/fishing/admin/event',
                {
                  type: 'reel_pull',
                  sessionId: data.fishing.sessionId,
                  expectedAttemptCount: data.fishing.attempts,
                  requestKey: crypto.randomUUID(),
                },
                'Force Reel Pull',
              )
            }
          >
            Force Reel Pull
          </button>
        </div>
        <p className="small muted" id="fishing-admin-event-readiness">
          {data.fishing.status !== 'active' || !data.fishing.activeAttempt
            ? 'Start fishing to force an event during an active attempt.'
            : data.fishing.randomEvent
              ? 'An event is already active. Use it or let this attempt resolve.'
              : !events?.canForce
                ? 'This attempt has already received an event. Waiting for the next cast.'
                : 'Force an event, then use its action in the fishing progress area.'}
        </p>
        {events && (
          <>
            <dl className="fishing-admin-event-stats">
              <div>
                <dt>Active fishing cycle</dt>
                <dd>
                  {formatCycleTime(events.elapsedMs)} / {formatCycleTime(events.cycleDurationMs)}
                </dd>
              </div>
              <div>
                <dt>Next event in</dt>
                <dd>
                  {events.nextEventInMs === null
                    ? 'Next cycle'
                    : events.nextEventInMs <= 0
                      ? 'Due — waiting for a valid attempt'
                      : formatCycleTime(events.nextEventInMs)}
                </dd>
              </div>
              <div>
                <dt>Events triggered this cycle</dt>
                <dd>
                  {events.triggeredCount} / {events.scheduleMs.length}
                </dd>
              </div>
              <div>
                <dt>Current event</dt>
                <dd>{events.currentEvent?.message ?? 'None'}</dd>
              </div>
            </dl>
            <p className="small">Generated schedule (active minutes)</p>
            <ol className="fishing-admin-event-schedule" aria-label="Generated event schedule">
              {events.scheduleMs.map((time, index) => (
                <li key={`${index}-${time}`}>
                  {formatCycleTime(time)}
                  {index < events.triggeredCount ? ' · consumed' : ''}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
      <div className="fishing-admin-row">
        <label>
          <input
            type="checkbox"
            checked={forceSuccess}
            disabled={pending}
            onChange={(event) => setForceSuccess(event.target.checked)}
          />{' '}
          Force next attempt to succeed
        </label>
        <label>
          <input
            type="checkbox"
            checked={forceTrophy}
            disabled={pending}
            onChange={(event) => setForceTrophy(event.target.checked)}
          />{' '}
          Force next catch to be Trophy (also forces success)
        </label>
        <button
          className="button secondary"
          disabled={pending || data.fishing.status !== 'active'}
          onClick={() =>
            void action(
              '/api/fishing/admin/force',
              {
                requestKey: crypto.randomUUID(),
                forceSuccess: forceSuccess || forceTrophy,
                forceTrophy,
                expectedAttemptCount: data.fishing.attempts,
              },
              'Forced attempt',
            )
          }
        >
          Force next fishing attempt
        </button>
      </div>
      <div className="fishing-admin-row">
        <label>
          Set clock to phase start
          <select
            className="input"
            value={data.timeOverrideState ?? ''}
            disabled={pending}
            onChange={(event) =>
              void action(
                '/api/fishing/admin/conditions',
                { timeOfDay: event.target.value || null },
                'Time override',
              )
            }
          >
            <option value="">Follow Frontier clock</option>
            {(['Dawn', 'Day', 'Dusk', 'Night'] as const).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="fishing-admin-row">
        <p>
          Frontier clock: {String(data.fishing.gameTime.hour).padStart(2, '0')}:
          {String(data.fishing.gameTime.minute).padStart(2, '0')} · Phase{' '}
          {data.fishing.conditions.timeOfDay} · Next phase {data.fishing.gameTime.nextPhaseAt}
        </p>
        <p>
          Effective sea: {data.fishing.conditions.seaState} · Scheduled current:{' '}
          {data.fishing.sea.scheduledCurrentState} · Next: {data.fishing.sea.nextState}
        </p>
        <p>
          Block: {data.fishing.sea.blockStartedAt} to {data.fishing.sea.blockEndsAt} · Override:{' '}
          {data.seaOverrideState ?? 'none'}
        </p>
        {(['Calm', 'Moderate', 'Dangerous'] as const).map((state) => (
          <button
            key={state}
            className="button secondary"
            disabled={pending}
            aria-pressed={data.seaOverrideState === state}
            onClick={() =>
              void action('/api/fishing/admin/conditions', { seaState: state }, `Force ${state}`)
            }
          >
            Force {state}
          </button>
        ))}
        <button
          className="button secondary"
          disabled={pending}
          onClick={() =>
            void action('/api/fishing/admin/conditions', { seaState: null }, 'Clear sea override')
          }
        >
          Clear override / return to schedule
        </button>
      </div>
      <h3>Fish discoveries</h3>
      <p>{data.discoveredFish?.length ?? 0} discovered for this character.</p>
      {!confirmReset ? (
        <button
          className="button secondary"
          disabled={pending}
          onClick={() => setConfirmReset(true)}
        >
          Reset my fish discoveries
        </button>
      ) : (
        <div className="fishing-admin-row">
          <p>
            This hides all fish in Possible Catches again for your character. Inventory and catches
            remain.
          </p>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => {
              setConfirmReset(false);
              void action('/api/fishing/admin/discoveries/reset', {}, 'Fish discovery reset');
            }}
          >
            Confirm reset
          </button>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => setConfirmReset(false)}
          >
            Cancel
          </button>
        </div>
      )}
      <h3>Inventory testing tool</h3>
      <label>
        Search item catalog
        <input
          className="input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label>
        Defined item
        <select
          className="input"
          value={definitionId}
          onChange={(event) => setDefinitionId(event.target.value)}
        >
          <option value="">Choose item</option>
          {matches.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Inventory or locker stack
        <select
          className="input"
          value={itemId}
          onChange={(event) => {
            setItemId(event.target.value);
            setConfirmDeleteStack(false);
          }}
        >
          <option value="">Choose stack</option>
          <optgroup label="Carried inventory">
            {data.inventory.items.map((item) => (
              <option value={item.instanceId} key={item.instanceId}>
                {item.name} ×{item.quantity}
              </option>
            ))}
          </optgroup>
          <optgroup label="City locker">
            {data.inventory.locker.map((item) => (
              <option value={item.instanceId} key={item.instanceId}>
                {item.name} ×{item.quantity}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label>
        Quantity
        <input
          className="input"
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </label>
      <div className="fishing-admin-row">
        <button
          className="button secondary"
          disabled={pending || !definitionId}
          onClick={() =>
            void action(
              '/api/fishing/admin/inventory',
              { action: 'add', definitionId, quantity: Number(quantity) },
              'Add',
            )
          }
        >
          Add
        </button>
        <button
          className="button secondary"
          disabled={pending || selectedStack?.location !== 'inventory'}
          onClick={() =>
            void action(
              '/api/fishing/admin/inventory',
              { action: 'remove', itemId, quantity: Number(quantity) },
              'Remove',
            )
          }
        >
          Remove
        </button>
        <button
          className="button secondary"
          disabled={pending || !selectedStack}
          onClick={() => setConfirmDeleteStack(true)}
        >
          Delete Stack
        </button>
        <button
          className="button secondary"
          disabled={pending}
          onClick={() =>
            void action(
              '/api/fishing/admin/inventory',
              { action: 'clear' },
              'Clear carried inventory',
            )
          }
        >
          Clear Inventory
        </button>
        <button
          className="button secondary"
          disabled={pending || data.inventory.locker.length === 0}
          onClick={() => setConfirmClearLocker(true)}
        >
          Clear Locker
        </button>
      </div>
      {confirmDeleteStack && selectedStack && (
        <div className="fishing-admin-row" role="group" aria-label="Confirm delete stack">
          <p>
            Delete {selectedStack.name} ×{selectedStack.quantity} from{' '}
            {selectedStack.location === 'locker' ? 'the city locker' : 'carried inventory'}?
          </p>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => {
              setConfirmDeleteStack(false);
              void action(
                '/api/fishing/admin/inventory',
                { action: 'delete', itemId: selectedStack.instanceId },
                'Delete stack',
              );
            }}
          >
            Confirm delete stack
          </button>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => setConfirmDeleteStack(false)}
          >
            Cancel
          </button>
        </div>
      )}
      {confirmClearLocker && (
        <div className="fishing-admin-row" role="group" aria-label="Confirm clear locker">
          <p>
            Delete all {data.inventory.locker.length} stored stacks from this character’s New Harbor
            locker? Carried items stay.
          </p>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => {
              setConfirmClearLocker(false);
              void action(
                '/api/fishing/admin/inventory',
                { action: 'clear_locker' },
                'Clear locker',
              );
            }}
          >
            Confirm clear locker
          </button>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => setConfirmClearLocker(false)}
          >
            Cancel
          </button>
        </div>
      )}
      <h3>Attempt traces</h3>
      {data.traces.length ? (
        <div className="fishing-debug-traces">
          {data.traces.map((trace, index) => (
            <details key={`${trace.attemptId}-${index}`}>
              <summary>
                {String(trace.timestamp)} ·{' '}
                {String(
                  trace.inventoryResult && typeof trace.inventoryResult === 'object'
                    ? (trace.inventoryResult as { action: string }).action
                    : trace.inventoryResult,
                )}
              </summary>
              <pre>{JSON.stringify(trace, null, 2)}</pre>
            </details>
          ))}
        </div>
      ) : (
        <p>No attempts recorded.</p>
      )}
      <h3>Session events</h3>
      {data.events.length ? (
        <div className="fishing-debug-traces">
          {data.events.map((entry, index) => (
            <details key={index}>
              <summary>
                {String(entry.timestamp)} · {String(entry.reason)}
              </summary>
              <pre>{JSON.stringify(entry, null, 2)}</pre>
            </details>
          ))}
        </div>
      ) : (
        <p>No stops recorded.</p>
      )}
      <h3>Inventory audit</h3>
      {data.audit.length ? (
        <div className="fishing-debug-traces">
          {data.audit.map((entry, index) => (
            <details key={index}>
              <summary>
                {String(entry.timestamp)} · {String(entry.action)}
              </summary>
              <pre>{JSON.stringify(entry.detail, null, 2)}</pre>
            </details>
          ))}
        </div>
      ) : (
        <p>No admin inventory mutations recorded.</p>
      )}
    </section>
  );
}
