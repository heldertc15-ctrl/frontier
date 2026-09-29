import { fishingConfig } from './fishingConfig.js';

export type FishingEventType = keyof typeof fishingConfig.randomEvents.types;
export interface FishingEventClock {
  cycleNumber: number;
  elapsedMs: number;
  scheduleMs: number[];
  nextIndex: number;
  triggeredCount: number;
  // Due opportunities retain their original cycle when they must wait for a valid attempt.
  pendingCycles: number[];
}

export function createFishingEventCycle(random: () => number = Math.random): FishingEventClock {
  return {
    cycleNumber: 1,
    elapsedMs: 0,
    scheduleMs: fishingConfig.randomEvents.windowsMs.map(([min, max]) =>
      Math.floor(min + Math.min(1, Math.max(0, random())) * (max - min)),
    ),
    nextIndex: 0,
    triggeredCount: 0,
    pendingCycles: [],
  };
}

export function advanceFishingEventClock(
  clock: FishingEventClock,
  elapsedMs: number,
  random: () => number = Math.random,
): FishingEventClock {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
    throw new Error('Active fishing elapsed time must be finite and nonnegative.');
  const next: FishingEventClock = structuredClone(clock);
  let remaining = elapsedMs;
  const duration = fishingConfig.randomEvents.cycleDurationMs;
  do {
    const step = Math.min(remaining, duration - next.elapsedMs);
    next.elapsedMs += step;
    remaining -= step;
    while (
      next.nextIndex < next.scheduleMs.length &&
      next.scheduleMs[next.nextIndex] <= next.elapsedMs
    ) {
      next.pendingCycles.push(next.cycleNumber);
      next.nextIndex++;
    }
    if (next.elapsedMs === duration) {
      next.cycleNumber++;
      next.elapsedMs = 0;
      next.scheduleMs = createFishingEventCycle(random).scheduleMs;
      next.nextIndex = 0;
      next.triggeredCount = 0;
    }
  } while (remaining > 0);
  return next;
}
