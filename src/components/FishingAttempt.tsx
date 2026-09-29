import { useEffect, useRef, useState } from 'react';
import {
  attemptElapsed,
  reelPromptRemainingMs,
  type FishingAttemptClock,
} from '../fishingAttemptClock';
import { FishingAttemptProgress } from './FishingAttemptProgress';
import type { FishingState } from '../../server/fishing';

/** Presentation only: a completed ring asks for a read, never a gameplay mutation. */
export function FishingAttempt({
  clock,
  onReconcile,
  randomEvent,
  serverTime,
  eventPending,
  eventDisabled,
  eventNotice,
  eventError,
  onEvent,
}: {
  clock: FishingAttemptClock | null;
  onReconcile: () => Promise<void>;
  randomEvent?: FishingState['randomEvent'];
  serverTime: string;
  eventPending?: boolean;
  eventDisabled?: boolean;
  eventNotice?: string;
  eventError?: string;
  onEvent?: (eventId: string) => void;
}) {
  const [now, setNow] = useState(() => performance.now());
  const reconcile = useRef(onReconcile);
  useEffect(() => {
    reconcile.current = onReconcile;
  }, [onReconcile]);
  useEffect(() => {
    if (!clock || (clock.frozenMono !== null && !randomEvent)) return;
    // Accurate discrete updates also work with reduced motion; no decorative animation.
    const timer = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(timer);
  }, [clock, randomEvent]);
  const key = clock?.key;
  // One deadline read and one bounded retry cover the server's one-second timer cadence.
  // Repeated responses for the same attempt cannot create a tight polling loop.
  const dueMono = clock ? clock.receivedMono + clock.durationMs - clock.elapsedMs : null;
  const frozen = !clock || clock.frozenMono !== null;
  const deadlineReads = useRef<{ key: string | undefined; count: number; lastRead: number }>({
    key: undefined,
    count: 0,
    lastRead: 0,
  });
  useEffect(() => {
    if (deadlineReads.current.key !== key) deadlineReads.current = { key, count: 0, lastRead: 0 };
    if (frozen || dueMono === null) return;
    let timer: number | undefined;
    const reads = deadlineReads.current;
    function scheduleRead() {
      if (reads.count >= 2) return;
      const at = reads.count === 0 ? dueMono! + 150 : reads.lastRead + 2000;
      timer = window.setTimeout(
        () => {
          reads.count++;
          reads.lastRead = performance.now();
          void reconcile.current();
          scheduleRead();
        },
        Math.max(0, at - performance.now()),
      );
    }
    scheduleRead();
    return () => window.clearTimeout(timer);
  }, [key, frozen, dueMono]);
  const progress = clock
    ? attemptElapsed(clock, Math.max(now, clock.receivedMono)) / clock.durationMs
    : 0;
  const eventRemainingMs =
    clock && randomEvent
      ? reelPromptRemainingMs(randomEvent, serverTime, clock, Math.max(now, clock.receivedMono))
      : 0;
  return (
    <FishingAttemptProgress
      progress={progress}
      phase={frozen ? 'reconnecting' : progress >= 1 ? 'checking' : 'waiting'}
      randomEvent={randomEvent}
      eventRemainingMs={eventRemainingMs}
      eventPending={eventPending}
      eventDisabled={eventDisabled}
      eventNotice={eventNotice}
      eventError={eventError}
      onEvent={onEvent}
    />
  );
}
