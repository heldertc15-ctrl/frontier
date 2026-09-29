import { useCallback, useEffect, useRef, useState } from 'react';
import type { Character } from '../../server/character';
import type { InventoryState } from '../../server/inventory';
import type { FishingState } from '../../server/fishing';
import { formatFishWeightKg } from '../../server/fishWeightFormat';
import type { PublicWorldSnapshot } from '../../server/seaState';
import type { ItemDefinition } from '../../server/inventory';
import { fishingIds } from '../../server/fishingConfig';
import { TrophyBadge } from './TrophyBadge';
import { FishingAttempt } from './FishingAttempt';
import {
  anchorFishingAttempt,
  attemptElapsed,
  isOlderFishingState,
  reelPromptRemainingMs,
  type FishingAttemptClock,
} from '../fishingAttemptClock';
import {
  playReelPromptSound,
  prepareReelPromptSound,
  stopReelPromptSound,
} from '../audio/reelPrompt';
import { playFishCatchSound, prepareFishCatchSound, stopFishCatchSound } from '../audio/fishCatch';
import {
  defaultFishingSoundPreferences,
  type FishingSoundPreferences,
} from '../audio/fishingSoundPreferences';

interface FishingPreview {
  rodItemId: string;
  baitItemId: string;
  serverTime: string;
  conditions: FishingState['conditions'];
  sea: FishingState['sea'];
  gameTime: FishingState['gameTime'];
  seaEffect: 'improved' | 'neutral' | 'reduced';
  possibleSpecies: Array<ItemDefinition & { discovered: boolean; catchSharePercent?: number }>;
}

const rods = new Set<string>(fishingIds.rod);
const baits = new Set<string>(fishingIds.bait);
const speciesArt: Record<string, string> = {
  Sardine: '/assets/items/sardine.webp',
  Mackerel: '/assets/items/mackerel.webp',
  'Bluefin Tuna': '/assets/items/bluefin-tuna.webp',
  'Red Mullet': '/assets/items/red-mullet.webp',
  Seabass: '/assets/items/seabass.webp',
  'Conger Eel': '/assets/items/conger-eel.webp',
  Barracuda: '/assets/items/barracuda.webp',
  Swordfish: '/assets/items/swordfish.webp',
};

function formatCatchShare(percent: number): string {
  return percent > 0 && percent < 0.01 ? '<0.01%' : `${percent.toFixed(2)}%`;
}

function LatestCatch({ fishing }: { fishing: FishingState }) {
  const catchResult = fishing.latestCatch;
  return (
    <section
      className={`fishing-reward${catchResult ? ' has-catch' : ''}${catchResult?.trophy ? ' is-trophy' : ''}`}
      aria-labelledby="latest-catch-heading"
    >
      <h5 id="latest-catch-heading">Latest catch</h5>
      <div className="fishing-reward-display" key={`${fishing.sessionId}-${fishing.catches}`}>
        {catchResult ? (
          <>
            {catchResult.trophy && <TrophyBadge label="Trophy catch" />}
            <div className="fishing-catch-art" aria-hidden="true">
              {speciesArt[catchResult.species] && (
                <img src={speciesArt[catchResult.species]} alt="" />
              )}
              {!speciesArt[catchResult.species] && <span>🐟</span>}
            </div>
            <strong className="fishing-catch-species">{catchResult.species}</strong>
            <span className="fishing-catch-weight">
              {formatFishWeightKg(catchResult.weightKg)} <span>kg</span>
            </span>
            <p className="fishing-catch-note">
              {catchResult.trophy
                ? 'An exceptional size for this species.'
                : 'Added to your inventory'}
            </p>
          </>
        ) : (
          <>
            <span className="fishing-empty-ripple" aria-hidden="true">
              ≈
            </span>
            <p>Waiting for the first catch.</p>
          </>
        )}
      </div>
    </section>
  );
}

function SessionCatchSummary({ fishing }: { fishing: FishingState }) {
  return (
    <section className="fishing-session-summary" aria-labelledby="fishing-session-summary-heading">
      <div className="fishing-summary-heading">
        <div>
          <p className="fishing-kicker">
            {fishing.status === 'active' ? 'Current session' : 'Session complete'}
          </p>
          <h5 id="fishing-session-summary-heading">Your catch</h5>
        </div>
        <strong>{fishing.catches} fish</strong>
      </div>
      {fishing.catchSummary.length ? (
        <ul className="fishing-summary-list">
          {fishing.catchSummary.map((catchRow) => (
            <li key={catchRow.species}>
              {speciesArt[catchRow.species] && <img src={speciesArt[catchRow.species]} alt="" />}
              <div>
                <strong>{catchRow.species}</strong>
                {catchRow.trophyCount > 0 && (
                  <TrophyBadge
                    label={`${catchRow.trophyCount} ${catchRow.trophyCount === 1 ? 'Trophy' : 'Trophies'}`}
                  />
                )}
              </div>
              <span className="fishing-summary-count">×{catchRow.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="fishing-summary-empty">
          {fishing.catches
            ? 'Catch details are unavailable for this session.'
            : 'No fish caught this session.'}
        </p>
      )}
    </section>
  );
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }).catch(() => {
    throw new Error('Connection to Frontier was interrupted.');
  });
  const body = await response.json().catch(() => {
    throw new Error('Frontier could not confirm the response. Refresh fishing to reconnect.');
  });
  if (!response.ok) throw new Error(body.error?.message ?? 'Fishing could not be updated.');
  return body as T;
}

export function FishingPanel({
  worldState = null,
  onCharacter,
  onInventoryChange,
  onConditions,
  onOpenPack,
  refreshRevision,
  soundPreferences = defaultFishingSoundPreferences,
}: {
  worldState?: PublicWorldSnapshot | null;
  onCharacter: (character: Character) => void;
  onInventoryChange: () => void;
  onConditions?: (conditions: FishingState['conditions']) => void;
  onOpenPack?: (opener: HTMLButtonElement) => void;
  refreshRevision: number;
  soundPreferences?: FishingSoundPreferences;
}) {
  const [fishing, setFishing] = useState<FishingState | null>(null);
  const confirmedFishing = useRef<FishingState | null>(null);
  const soundPreferencesRef = useRef(soundPreferences);
  useEffect(() => {
    soundPreferencesRef.current = soundPreferences;
  }, [soundPreferences]);
  const heardEventIds = useRef<Set<string>>(new Set());
  const [attemptClock, setAttemptClock] = useState<FishingAttemptClock | null>(null);
  const acceptFishing = useCallback((next: FishingState, receivedMono: number) => {
    if (isOlderFishingState(confirmedFishing.current, next)) return false;
    const previous = confirmedFishing.current;
    if (previous?.randomEvent?.id && previous.randomEvent.id !== next.randomEvent?.id)
      stopReelPromptSound();
    const offer = next.randomEvent;
    if (offer && !heardEventIds.current.has(offer.id)) {
      heardEventIds.current.add(offer.id);
      if (previous?.status === 'active' && soundPreferencesRef.current.reelEvent) {
        playReelPromptSound(
          Date.parse(offer.expiresAt) - Date.parse(next.serverTime),
          offer.windowMs,
        );
      }
    }
    if (
      previous?.sessionId &&
      previous.sessionId === next.sessionId &&
      next.catches > previous.catches &&
      next.latestCatch &&
      soundPreferencesRef.current.fishCatch
    )
      playFishCatchSound();
    confirmedFishing.current = next;
    setFishing(next);
    setAttemptClock((previous) => anchorFishingAttempt(next, receivedMono, previous));
    return true;
  }, []);
  const freezeAttempt = useCallback(() => {
    const now = performance.now();
    setAttemptClock((previous) =>
      previous && previous.frozenMono === null ? { ...previous, frozenMono: now } : previous,
    );
  }, []);
  const [inventory, setInventory] = useState<InventoryState | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [rodId, setRodId] = useState('');
  const [baitId, setBaitId] = useState('');
  const [picker, setPicker] = useState<'rod' | 'bait' | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<'start' | 'stop' | null>(null);
  const [pendingEvent, setPendingEvent] = useState<string | null>(null);
  const [eventFeedback, setEventFeedback] = useState<{
    attemptKey: string;
    notice: string;
    error: string;
  } | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const pending = pendingAction !== null || pendingEvent !== null;
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<FishingPreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [scheduleStale, setScheduleStale] = useState(false);
  const [dockInView, setDockInView] = useState(false);
  const loadGeneration = useRef(0);
  const previewGeneration = useRef(0);
  const expiryMono = useRef(0);
  const slotButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const preparationHeading = useRef<HTMLHeadingElement>(null);
  const pickerGroup = useRef<HTMLDialogElement>(null);
  const stopButton = useRef<HTMLButtonElement>(null);
  const keepFishingButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dock = heading.current?.closest('section');
    if (!dock || typeof IntersectionObserver === 'undefined') return;
    // On phones, wait until there is room for the dock heading and action together.
    const observer = new IntersectionObserver(
      ([entry]) => {
        setDockInView(entry.boundingClientRect.top < (entry.rootBounds?.bottom ?? 0));
      },
      { rootMargin: '0px 0px -320px 0px', threshold: 0 },
    );
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);
  const mutationPending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopReelPromptSound();
      stopFishCatchSound();
    };
  }, []);
  useEffect(() => {
    if (!soundPreferences.reelEvent) stopReelPromptSound();
    if (!soundPreferences.fishCatch) stopFishCatchSound();
  }, [soundPreferences.reelEvent, soundPreferences.fishCatch]);
  useEffect(() => {
    if (fishing?.status !== 'active') return;
    const unlock = () => {
      if (soundPreferencesRef.current.reelEvent) prepareReelPromptSound();
      if (soundPreferencesRef.current.fishCatch) prepareFishCatchSound();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [fishing?.status, soundPreferences.reelEvent, soundPreferences.fishCatch]);
  useEffect(() => {
    const dialog = pickerGroup.current;
    if (!picker || !dialog) return;
    const position = () => {
      const anchor = slotButton.current?.getBoundingClientRect();
      if (!anchor) return;
      dialog.style.setProperty(
        '--picker-left',
        `${Math.max(12, Math.min(anchor.left, window.innerWidth - 324))}px`,
      );
      dialog.style.setProperty(
        '--picker-top',
        `${Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - 360))}px`,
      );
    };
    position();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    (
      dialog.querySelector<HTMLButtonElement>('.fishing-choice') ??
      dialog.querySelector<HTMLButtonElement>('button')
    )?.focus();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [picker]);
  function cancelStop() {
    setConfirmStop(false);
    window.requestAnimationFrame(() => stopButton.current?.focus());
  }
  function closePicker() {
    pickerGroup.current?.close?.();
    slotButton.current?.focus();
    setPicker(null);
  }
  const priorStatus = useRef<string | null>(null);
  const inventorySignature = useRef<string | null>(null);
  const load = useCallback(
    async (afterMutation = false) => {
      if (mutationPending.current && !afterMutation) return;
      const generation = ++loadGeneration.current;
      const startedMono = performance.now();
      try {
        const [fishingReply, inventoryReply] = await Promise.all([
          request<{ fishing: FishingState }>('/api/fishing').then((reply) => ({
            ...reply,
            receivedMono: performance.now(),
          })),
          request<{ inventory: InventoryState }>('/api/inventory'),
        ]);
        if (generation !== loadGeneration.current || !mounted.current) return;
        if (!acceptFishing(fishingReply.fishing, fishingReply.receivedMono)) return;
        if (fishingReply.fishing.status !== 'active') setConfirmStop(false);
        onConditions?.(fishingReply.fishing.conditions);
        expiryMono.current =
          startedMono +
          Math.max(
            0,
            Math.min(
              Date.parse(fishingReply.fishing.sea.blockEndsAt),
              Date.parse(fishingReply.fishing.gameTime.nextPhaseAt),
            ) - Date.parse(fishingReply.fishing.serverTime),
          );
        setScheduleStale(performance.now() >= expiryMono.current);
        setInventory(inventoryReply.inventory);
        const signature = JSON.stringify(
          inventoryReply.inventory.items.map((item) => [item.instanceId, item.quantity]),
        );
        if (inventorySignature.current !== null && inventorySignature.current !== signature)
          onInventoryChange();
        inventorySignature.current = signature;
        if (priorStatus.current !== null && priorStatus.current !== fishingReply.fishing.status) {
          const reply = await request<{ character: Character }>('/api/character');
          if (generation !== loadGeneration.current || !mounted.current) return;
          onCharacter(reply.character);
        }
        priorStatus.current = fishingReply.fishing.status;
        setError('');
      } catch (cause) {
        if (generation !== loadGeneration.current || !mounted.current) return;
        freezeAttempt();
        if (performance.now() >= expiryMono.current) setScheduleStale(true);
        setError(cause instanceof Error ? cause.message : 'Fishing state could not be loaded.');
      } finally {
        if (generation === loadGeneration.current && mounted.current) setLoading(false);
      }
    },
    [onCharacter, onInventoryChange, onConditions, acceptFishing, freezeAttempt],
  );
  useEffect(() => {
    const loadRequests = loadGeneration;
    const previewRequests = previewGeneration;
    const start = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 15_000);
    return () => {
      loadRequests.current++;
      previewRequests.current++;
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [load, refreshRevision]);
  // Read active event prompts promptly without reloading inventory on every event poll.
  // The existing heartbeat/full refresh and bounded deadline reads remain the recovery path.
  useEffect(() => {
    if (fishing?.status !== 'active') return;
    let inFlight = false;
    let disposed = false;
    const timer = window.setInterval(() => {
      if (
        mutationPending.current ||
        inFlight ||
        !attemptClock ||
        attemptClock.frozenMono !== null ||
        attemptElapsed(attemptClock, performance.now()) >= attemptClock.durationMs
      )
        return;
      inFlight = true;
      const generation = loadGeneration.current;
      void request<{ fishing: FishingState }>('/api/fishing')
        .then((reply) => {
          if (disposed || !mounted.current || generation !== loadGeneration.current) return;
          const previous = confirmedFishing.current;
          if (!acceptFishing(reply.fishing, performance.now())) return;
          onConditions?.(reply.fishing.conditions);
          setError('');
          if (
            previous?.attempts !== reply.fishing.attempts ||
            previous?.status !== reply.fishing.status
          )
            void load();
        })
        .catch((cause) => {
          if (disposed || !mounted.current || generation !== loadGeneration.current) return;
          freezeAttempt();
          setError(cause instanceof Error ? cause.message : 'Fishing could not be refreshed.');
        })
        .finally(() => {
          inFlight = false;
        });
    }, 2000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [fishing?.status, attemptClock, acceptFishing, freezeAttempt, onConditions, load]);
  useEffect(() => {
    if (!fishing || scheduleStale) return;
    const delay = Math.max(250, expiryMono.current - performance.now());
    const timer = window.setTimeout(() => void load(), delay);
    return () => window.clearTimeout(timer);
  }, [fishing, load, scheduleStale]);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === 'visible') {
        freezeAttempt();
        void load();
      }
    };
    const offline = () => {
      freezeAttempt();
      setError('Connection to Frontier was interrupted.');
    };
    const online = () => void load();
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, [load, freezeAttempt]);
  const worldRevision = worldState ? JSON.stringify([worldState.conditions, worldState.sea]) : null;
  useEffect(() => {
    if (!worldRevision) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [worldRevision, load]);
  const rod = inventory?.items.find((item) => item.instanceId === rodId && rods.has(item.id));
  const bait = inventory?.items.find(
    (item) => item.instanceId === baitId && baits.has(item.id) && item.quantity > 0,
  );
  useEffect(() => {
    const generation = ++previewGeneration.current;
    if (!preparing || !rod || !bait || !fishing || scheduleStale) {
      window.setTimeout(() => {
        if (generation === previewGeneration.current) setPreview(null);
      }, 0);
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({ rodItemId: rod.instanceId, baitItemId: bait.instanceId });
    void request<{ preview: FishingPreview }>(`/api/fishing/preview?${query}`, {
      signal: controller.signal,
    })
      .then((reply) => {
        if (generation !== previewGeneration.current) return;
        if (
          !reply.preview ||
          reply.preview.rodItemId !== rod.instanceId ||
          reply.preview.baitItemId !== bait.instanceId
        )
          return;
        setPreview(reply.preview);
        onConditions?.(reply.preview.conditions);
        setPreviewError('');
      })
      .catch((cause) => {
        if (generation !== previewGeneration.current) return;
        setPreview(null);
        setPreviewError(cause instanceof Error ? cause.message : 'Preview unavailable.');
      });
    return () => controller.abort();
  }, [preparing, rod, bait, fishing, scheduleStale, onConditions]);
  const validPreview =
    preparing &&
    rod &&
    bait &&
    preview &&
    !scheduleStale &&
    preview.rodItemId === rod.instanceId &&
    preview.baitItemId === bait.instanceId &&
    (!worldState ||
      (preview.conditions.timeOfDay === worldState.conditions.timeOfDay &&
        preview.conditions.seaState === worldState.conditions.seaState &&
        preview.sea.blockEndsAt === worldState.sea.blockEndsAt)) &&
    (!fishing || Date.parse(preview.serverTime) >= Date.parse(fishing.serverTime))
      ? preview
      : null;
  const shownConditions = worldState ?? validPreview ?? fishing;
  const activeRod = inventory?.items.find((item) => item.instanceId === fishing?.rodItemId);
  const activeBait = inventory?.items.find((item) => item.instanceId === fishing?.baitItemId);
  const options =
    inventory?.items.filter((item) =>
      picker === 'rod' ? rods.has(item.id) : baits.has(item.id) && item.quantity > 0,
    ) ?? [];
  async function act(kind: 'start' | 'stop') {
    if (mutationPending.current) return;
    if (kind === 'start') {
      if (soundPreferences.reelEvent) prepareReelPromptSound();
      if (soundPreferences.fishCatch) prepareFishCatchSound();
    } else {
      stopReelPromptSound();
      stopFishCatchSound();
    }
    mutationPending.current = true;
    setPendingAction(kind);
    loadGeneration.current++;
    setError('');
    try {
      const reply = await request<{ fishing: FishingState; character: Character }>(
        `/api/fishing/${kind}`,
        {
          method: 'POST',
          body: kind === 'start' ? JSON.stringify({ rodItemId: rodId, baitItemId: baitId }) : '{}',
        },
      );
      if (!mounted.current) return;
      if (!acceptFishing(reply.fishing, performance.now())) return;
      onConditions?.(reply.fishing.conditions);
      priorStatus.current = reply.fishing.status;
      onCharacter(reply.character);
      if (kind === 'start') {
        setPreparing(false);
        setPicker(null);
      }
      heading.current?.focus();
      await load(true);
    } catch (cause) {
      if (!mounted.current) return;
      await load(true);
      if (!mounted.current) return;
      setError(
        cause instanceof Error
          ? cause.message
          : 'The result could not be confirmed. Refresh fishing state.',
      );
    } finally {
      mutationPending.current = false;
      if (mounted.current) setPendingAction(null);
    }
  }
  async function activateEvent(eventId: string) {
    const current = confirmedFishing.current;
    const event = current?.randomEvent;
    if (
      mutationPending.current ||
      !current ||
      current.status !== 'active' ||
      !event ||
      event.id !== eventId ||
      !attemptClock ||
      attemptClock.frozenMono !== null ||
      reelPromptRemainingMs(event, current.serverTime, attemptClock, performance.now()) <= 0 ||
      attemptElapsed(attemptClock, performance.now()) >= attemptClock.durationMs
    )
      return;
    stopReelPromptSound();
    const attemptKey = `${current.sessionId}:${current.attempts}`;
    mutationPending.current = true;
    loadGeneration.current++;
    setPendingEvent(eventId);
    setEventFeedback(null);
    try {
      const reply = await request<{ fishing: FishingState; character: Character }>(
        '/api/fishing/event',
        { method: 'POST', body: JSON.stringify({ eventId }) },
      );
      if (!mounted.current) return;
      if (acceptFishing(reply.fishing, performance.now())) {
        onConditions?.(reply.fishing.conditions);
        onCharacter(reply.character);
        if (reply.fishing.attempts > current.attempts)
          setEventFeedback({
            attemptKey: `${reply.fishing.sessionId}:${reply.fishing.attempts}`,
            notice: 'Reeled in. Attempt complete.',
            error: '',
          });
      }
      await load(true);
    } catch (cause) {
      if (!mounted.current) return;
      await load(true);
      if (!mounted.current) return;
      setEventFeedback({
        attemptKey,
        notice: '',
        error: cause instanceof Error ? cause.message : 'The event could not be confirmed.',
      });
    } finally {
      mutationPending.current = false;
      if (mounted.current) setPendingEvent(null);
    }
  }
  const active = fishing?.status === 'active';
  const currentEventFeedback =
    eventFeedback?.attemptKey === `${fishing?.sessionId}:${fishing?.attempts}`
      ? eventFeedback
      : null;
  const readiness = error
    ? 'Refresh fishing to confirm your activity before starting.'
    : (rodId && !rod) || (baitId && !bait)
      ? 'Selected supplies are no longer carried. Choose replacements.'
      : !rod && !bait
        ? 'Choose a rod and bait.'
        : !rod
          ? 'Choose a rod.'
          : !bait
            ? 'Choose bait.'
            : 'One bait is used per attempt.';
  const selectedItem = picker === 'rod' ? rod : bait;
  const interrupted = fishing?.stopReason === 'Fishing stopped: server restarted.';
  return (
    <section
      className={`fishing-context fishing-dock${active ? ' is-fishing' : ''}${dockInView ? ' is-in-view' : ''}`}
      aria-labelledby="fishing-heading"
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {!preparing && fishing?.latestCatch?.trophy
          ? `Trophy catch! ${fishing.latestCatch.species}, ${formatFishWeightKg(fishing.latestCatch.weightKg)} kg. ${fishing.catches} ${fishing.catches === 1 ? 'catch' : 'catches'} this session.`
          : ''}
      </p>
      <header className="fishing-dock-header">
        <p className="fishing-kicker">Pier activity</p>
        <h4 id="fishing-heading" ref={heading} tabIndex={-1}>
          {active && <span className="fishing-heading-icon" aria-hidden="true" />}
          {active ? 'Fishing…' : 'Fishing'}
        </h4>
        {active && <p className="fishing-active-subtitle">Your line is in the water. Good luck!</p>}
        {shownConditions && (
          <>
            <dl className="fishing-condition-strip" aria-label="Current conditions">
              {[
                [
                  'Time',
                  shownConditions.conditions.timeOfDay,
                  'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
                ],
                [
                  'Sea',
                  shownConditions.conditions.seaState,
                  'M3 8c3-4 6 4 9 0s6 4 9 0M3 13c3-4 6 4 9 0s6 4 9 0M3 18c3-4 6 4 9 0s6 4 9 0',
                ],
              ].map(([label, value, path]) => (
                <div key={label}>
                  <dt>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <path d={path} />
                    </svg>
                    {label}
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {scheduleStale || error ? (
              <p className="fishing-forecast-stale">Sea forecast awaiting refresh.</p>
            ) : (
              <p className="fishing-forecast-details">
                Sea outlook:{' '}
                {shownConditions.sea.nextState === shownConditions.conditions.seaState
                  ? {
                      Calm: 'Calm waters holding',
                      Moderate: 'Choppy seas holding',
                      Dangerous: 'Rough seas persisting',
                    }[shownConditions.sea.nextState]
                  : {
                      Calm: 'Calm waters ahead',
                      Moderate: 'Moderate seas ahead',
                      Dangerous: 'Dangerous seas approaching',
                    }[shownConditions.sea.nextState]}
              </p>
            )}
          </>
        )}
      </header>
      <div className="fishing-dock-content">
        {loading && <p role="status">Loading fishing state…</p>}
        {error && (
          <div className="feedback form-error" role="alert">
            <p>{error}</p>
            {fishing && <p>Last confirmed activity retained. Refresh to reconnect.</p>}
            <button className="button secondary" onClick={() => void load()}>
              Refresh fishing
            </button>
          </div>
        )}
        {!loading && active && fishing && (
          <div className="fishing-active">
            <FishingAttempt
              clock={attemptClock}
              onReconcile={load}
              randomEvent={fishing.randomEvent}
              serverTime={fishing.serverTime}
              eventPending={pendingEvent !== null}
              eventDisabled={pending || !!error || confirmStop}
              eventNotice={currentEventFeedback?.notice}
              eventError={currentEventFeedback?.error}
              onEvent={(eventId) => void activateEvent(eventId)}
            />
            <dl className="fishing-equipped-row">
              <div>
                {activeRod?.artworkPath && <img src={activeRod.artworkPath} alt="" />}
                <div>
                  <dt>Rod</dt>
                  <dd>{fishing.rodName}</dd>
                </div>
              </div>
              <div>
                {activeBait?.artworkPath && <img src={activeBait.artworkPath} alt="" />}
                <div>
                  <dt>Bait</dt>
                  <dd>
                    {fishing.baitName}
                    <strong className="fishing-quantity">×{fishing.baitRemaining} left</strong>
                  </dd>
                </div>
              </div>
            </dl>
            <LatestCatch fishing={fishing} />
            <SessionCatchSummary fishing={fishing} />
            {fishing.latestResult && (
              <p className="fishing-event" role="status" aria-live="polite">
                {fishing.latestResult}
              </p>
            )}
          </div>
        )}
        {!loading && fishing && !active && (
          <>
            {!preparing ? (
              <div className="fishing-entry">
                {fishing.status === 'stopped' && (
                  <>
                    <div className="fishing-stop-notice" role="status">
                      {interrupted ? (
                        <>
                          <strong>Fishing interrupted</strong>
                          <p>The server restarted.</p>
                        </>
                      ) : (
                        <p>{fishing.stopReason ?? fishing.latestResult}</p>
                      )}
                    </div>
                    {fishing.latestCatch && <LatestCatch fishing={fishing} />}
                    <SessionCatchSummary fishing={fishing} />
                  </>
                )}
                <div className="fishing-entry-showcase">
                  <div className="fishing-entry-art">
                    <img src="/assets/fishing-preview.webp" alt="" />
                  </div>
                  <h5>Settle in at the pier</h5>
                  <p className="muted">Choose a rod and bait from your inventory.</p>
                </div>
              </div>
            ) : (
              <div className="fishing-preparation">
                <h5 ref={preparationHeading} tabIndex={-1}>
                  Preparation
                </h5>
                <div className="fishing-loadout">
                  {(['rod', 'bait'] as const).map((slot) => {
                    const selected = slot === 'rod' ? rod : bait;
                    return (
                      <div className="fishing-slot" key={slot}>
                        <button
                          type="button"
                          className={`button secondary${selected ? ' is-equipped' : ''}`}
                          disabled={pending}
                          aria-haspopup="dialog"
                          aria-expanded={picker === slot}
                          aria-label={`${slot === 'rod' ? 'Rod' : 'Bait'}: ${selected ? `${selected.name}${slot === 'bait' ? ` ×${selected.quantity}` : ''}` : 'Choose carried item'}`}
                          onClick={(event) => {
                            slotButton.current = event.currentTarget;
                            setPicker(slot);
                          }}
                        >
                          <span className="fishing-socket-label">
                            {slot === 'rod' ? 'Rod' : 'Bait'}
                          </span>
                          {selected && (
                            <span className="fishing-selected-mark" aria-label="Selected">
                              ✓
                            </span>
                          )}
                          <span
                            className={`fishing-slot-art${selected ? '' : ' is-empty'}`}
                            aria-hidden="true"
                          >
                            {selected && !selected.artworkPath ? (
                              <span>{slot === 'rod' ? '🎣' : '🪱'}</span>
                            ) : (
                              <img
                                src={
                                  selected?.artworkPath ??
                                  `/assets/items/${slot === 'rod' ? 'basic-fishing-rod' : 'worm-bait'}.webp`
                                }
                                alt=""
                              />
                            )}
                          </span>
                          <span className="fishing-slot-copy">
                            <strong>{selected?.name ?? `Choose ${slot}`}</strong>
                          </span>
                          <span className="fishing-slot-meta">
                            {selected && slot === 'bait'
                              ? `×${selected.quantity} carried`
                              : selected
                                ? 'Change rod'
                                : 'From your inventory'}
                            <span aria-hidden="true">›</span>
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="possible-catches">
                  <h5>Possible Catches</h5>
                  {rod && bait && (
                    <p className="fishing-share-caption">Share when a fish is caught</p>
                  )}
                  {!rod || !bait ? (
                    <p className="small muted">Your tackle reveals what could be caught here.</p>
                  ) : scheduleStale ? (
                    <p className="small muted">Possible catches awaiting refresh.</p>
                  ) : previewError ? (
                    <p className="small form-error">{previewError}</p>
                  ) : !validPreview ? (
                    <p className="small muted">Loading possible catches…</p>
                  ) : (
                    <ul className="fishing-species">
                      {validPreview.possibleSpecies.map((species) => (
                        <li key={species.id}>
                          {species.artworkPath && (
                            <img
                              className={species.discovered ? '' : 'is-undiscovered'}
                              src={species.artworkPath}
                              alt={species.discovered ? '' : 'Undiscovered fish'}
                            />
                          )}
                          {!species.artworkPath && (
                            <span
                              aria-hidden="true"
                              style={{
                                filter: species.discovered ? 'grayscale(1)' : 'brightness(0)',
                              }}
                            >
                              🐟
                            </span>
                          )}
                          <span>{species.discovered ? species.name : '???'}</span>
                          {species.discovered && typeof species.catchSharePercent === 'number' && (
                            <span className="fishing-species-share">
                              {formatCatchShare(species.catchSharePercent)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {!loading && fishing && (
        <footer className="fishing-action-footer">
          {preparing && !active && (
            <p
              id="fishing-readiness"
              role="status"
              style={pending ? { visibility: 'hidden' } : undefined}
            >
              {readiness}
            </p>
          )}
          {active && confirmStop && !pendingAction ? (
            <div
              className="fishing-stop-confirm"
              role="dialog"
              aria-labelledby="fishing-stop-dialog-heading"
              aria-describedby="fishing-stop-dialog-copy"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelStop();
                }
              }}
            >
              <h5 id="fishing-stop-dialog-heading">Stop fishing?</h5>
              <p id="fishing-stop-dialog-copy">
                You have caught {fishing.catches} fish this session. Stop now to see your catch
                summary.
              </p>
              <div className="fishing-stop-confirm-actions">
                <button
                  ref={keepFishingButton}
                  type="button"
                  className="button secondary"
                  onClick={cancelStop}
                >
                  Keep fishing
                </button>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    setConfirmStop(false);
                    void act('stop');
                  }}
                >
                  Stop and view catch
                </button>
              </div>
            </div>
          ) : pendingAction ? (
            <button
              className={`button ${pendingAction === 'start' ? 'primary' : 'secondary'} fishing-main-action`}
              disabled
            >
              {pendingAction === 'start' ? 'Starting…' : 'Stopping…'}
            </button>
          ) : active ? (
            <button
              ref={stopButton}
              className="button secondary fishing-main-action"
              disabled={pending}
              aria-haspopup="dialog"
              onClick={() => {
                setConfirmStop(true);
                window.requestAnimationFrame(() => keepFishingButton.current?.focus());
              }}
            >
              <svg className="fishing-stop-icon" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor" />
              </svg>
              Stop Fishing
            </button>
          ) : preparing ? (
            <button
              className="button primary fishing-main-action"
              aria-describedby={!pending ? 'fishing-readiness' : undefined}
              disabled={!rod || !bait || pending || !!error}
              onClick={() => void act('start')}
            >
              {pending ? 'Starting…' : 'Start Fishing'}
            </button>
          ) : (
            <button
              className="button primary fishing-main-action"
              disabled={pending || !!error}
              onClick={() => {
                setPreparing(true);
                window.requestAnimationFrame(() => preparationHeading.current?.focus());
              }}
            >
              Prepare tackle
            </button>
          )}
        </footer>
      )}
      {picker && (
        <dialog
          ref={pickerGroup}
          className="fishing-picker-dialog"
          aria-labelledby="fishing-picker-title"
          onCancel={(event) => {
            event.preventDefault();
            event.stopPropagation();
            closePicker();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              closePicker();
            }
          }}
        >
          <header>
            <h5 id="fishing-picker-title">Choose {picker}</h5>
            <button type="button" aria-label="Close choices" onClick={closePicker}>
              ×
            </button>
          </header>
          <div className="fishing-picker-options">
            {options.length ? (
              options.map((item) => (
                <button
                  type="button"
                  className="fishing-choice"
                  key={item.instanceId}
                  aria-pressed={selectedItem?.instanceId === item.instanceId}
                  onClick={() => {
                    if (picker === 'rod') setRodId(item.instanceId);
                    else setBaitId(item.instanceId);
                    closePicker();
                  }}
                >
                  {item.artworkPath && <img src={item.artworkPath} alt="" />}
                  <span>
                    {item.name} <span className="fishing-quantity">×{item.quantity}</span>
                  </span>
                  {selectedItem?.instanceId === item.instanceId && (
                    <span aria-label="Selected">✓</span>
                  )}
                </button>
              ))
            ) : (
              <div>
                <p>No {picker} in your inventory.</p>
                {onOpenPack && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      const opener = slotButton.current;
                      closePicker();
                      if (opener) onOpenPack(opener);
                    }}
                  >
                    Open Inventory
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="small muted">Carried equipment only</p>
        </dialog>
      )}
    </section>
  );
}
