import type { FishingState } from '../server/fishing';

export interface FishingAttemptClock {
  key: string;
  durationMs: number;
  elapsedMs: number;
  receivedMono: number;
  frozenMono: number | null;
}

export function isOlderFishingState(current: FishingState | null, next: FishingState): boolean {
  if (!current) return false;
  if (Date.parse(next.serverTime) < Date.parse(current.serverTime)) return true;
  return (
    current.sessionId === next.sessionId &&
    current.sessionId !== null &&
    (next.attempts < current.attempts ||
      (next.eventRevision ?? 0) < (current.eventRevision ?? 0) ||
      (current.status === 'stopped' && next.status === 'active'))
  );
}

export function attemptElapsed(clock: FishingAttemptClock, nowMono: number): number {
  return Math.min(
    clock.durationMs,
    Math.max(0, clock.elapsedMs + Math.max(0, (clock.frozenMono ?? nowMono) - clock.receivedMono)),
  );
}

export function reelPromptRemainingMs(
  event: NonNullable<FishingState['randomEvent']>,
  serverTime: string,
  clock: FishingAttemptClock,
  nowMono: number,
): number {
  const expiresAt = Date.parse(event.expiresAt);
  const receivedAt = Date.parse(serverTime);
  if (!Number.isFinite(expiresAt + receivedAt) || event.windowMs <= 0) return 0;
  const elapsed = Math.max(0, nowMono - clock.receivedMono);
  return Math.max(0, Math.min(event.windowMs, expiresAt - receivedAt - elapsed));
}

export function anchorFishingAttempt(
  fishing: FishingState,
  receivedMono: number,
  previous: FishingAttemptClock | null,
): FishingAttemptClock | null {
  const attempt = fishing.activeAttempt;
  if (fishing.status !== 'active' || !attempt) return null;
  const started = Date.parse(attempt.startedAt);
  const deadline = Date.parse(attempt.deadlineAt);
  const serverTime = Date.parse(fishing.serverTime);
  if (
    !Number.isFinite(started + deadline + serverTime + attempt.durationMs) ||
    attempt.durationMs <= 0 ||
    deadline - started !== attempt.durationMs
  )
    return null;
  const key = `${fishing.sessionId}:${fishing.attempts}:${attempt.startedAt}`;
  const elapsedMs = Math.min(
    attempt.durationMs,
    Math.max(
      0,
      serverTime - started,
      previous?.key === key ? attemptElapsed(previous, receivedMono) : 0,
    ),
  );
  return { key, durationMs: attempt.durationMs, elapsedMs, receivedMono, frozenMono: null };
}
