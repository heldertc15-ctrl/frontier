import { describe, expect, it } from 'vitest';
import type { FishingState } from '../server/fishing';
import { anchorFishingAttempt, attemptElapsed, isOlderFishingState } from './fishingAttemptClock';

function snapshot(overrides: Partial<FishingState> = {}): FishingState {
  return {
    status: 'active',
    sessionId: 'session',
    attempts: 0,
    serverTime: '2026-09-26T12:00:30.000Z',
    activeAttempt: {
      startedAt: '2026-09-26T12:00:00.000Z',
      deadlineAt: '2026-09-26T12:01:00.000Z',
      durationMs: 60000,
    },
    ...overrides,
  } as FishingState;
}

describe('authoritative fishing presentation clock', () => {
  it('restores in-progress timing from server time, independent of the local wall clock', () => {
    const clock = anchorFishingAttempt(snapshot(), 100, null)!;
    expect(attemptElapsed(clock, 100)).toBe(30000);
    expect(attemptElapsed(clock, 5100)).toBe(35000);
    expect(attemptElapsed(clock, 60100)).toBe(60000);
    expect(attemptElapsed(clock, 999999)).toBe(60000);
  });
  it('does not rewind the same attempt during polling and uses configured durations', () => {
    const first = anchorFishingAttempt(snapshot(), 100, null)!;
    const duplicate = anchorFishingAttempt(snapshot(), 5100, first)!;
    expect(attemptElapsed(duplicate, 5100)).toBe(35000);
    const longer = anchorFishingAttempt(
      snapshot({
        activeAttempt: {
          startedAt: '2026-09-26T12:00:00.000Z',
          deadlineAt: '2026-09-26T12:02:00.000Z',
          durationMs: 120000,
        },
      }),
      100,
      null,
    )!;
    expect(attemptElapsed(longer, 100) / longer.durationMs).toBe(0.25);
  });
  it('freezes on connection loss and resumes only from a confirmed snapshot', () => {
    const first = anchorFishingAttempt(snapshot(), 100, null)!;
    const frozen = { ...first, frozenMono: 1100 };
    expect(attemptElapsed(frozen, 100000)).toBe(31000);
    const restored = anchorFishingAttempt(
      snapshot({ serverTime: '2026-09-26T12:00:50.000Z' }),
      100000,
      frozen,
    )!;
    expect(attemptElapsed(restored, 100000)).toBe(50000);
  });
  it('resets only for a server-confirmed next attempt, including a forced early resolution', () => {
    const first = anchorFishingAttempt(snapshot(), 100, null)!;
    const next = anchorFishingAttempt(
      snapshot({
        attempts: 1,
        activeAttempt: {
          startedAt: '2026-09-26T12:00:30.000Z',
          deadlineAt: '2026-09-26T12:01:30.000Z',
          durationMs: 60000,
        },
      }),
      200,
      first,
    )!;
    expect(attemptElapsed(next, 200)).toBe(0);
    expect(
      anchorFishingAttempt(snapshot({ status: 'stopped', activeAttempt: null }), 300, next),
    ).toBeNull();
  });
  it('rejects stale timestamps, attempt rollback, and resurrection of a stopped session', () => {
    const current = snapshot({ attempts: 2 });
    expect(isOlderFishingState(current, snapshot({ serverTime: '2026-09-26T12:00:29.000Z' }))).toBe(
      true,
    );
    expect(
      isOlderFishingState(
        current,
        snapshot({ attempts: 1, serverTime: '2026-09-26T12:00:31.000Z' }),
      ),
    ).toBe(true);
    expect(isOlderFishingState({ ...current, status: 'stopped' }, snapshot({ attempts: 2 }))).toBe(
      true,
    );
    expect(isOlderFishingState(current, { ...current, status: 'stopped' })).toBe(false);
    expect(isOlderFishingState(current, snapshot({ sessionId: 'new-session' }))).toBe(false);
  });
  it('blocks an older event revision even at the same timestamp', () => {
    const first = snapshot({ eventRevision: 1 });
    const accepted = snapshot({ eventRevision: 2 });
    const before = anchorFishingAttempt(first, 100, null)!;
    const after = anchorFishingAttempt(accepted, 100, before)!;
    expect(after.key).toBe(before.key);
    expect(after.durationMs - attemptElapsed(after, 100)).toBe(30000);
    expect(isOlderFishingState(accepted, first)).toBe(true);
    expect(
      isOlderFishingState(accepted, snapshot({ sessionId: 'next-session', eventRevision: 0 })),
    ).toBe(false);
  });
});
