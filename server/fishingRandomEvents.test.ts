// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fishingConfig } from './fishingConfig.js';
import { advanceFishingEventClock, createFishingEventCycle } from './fishingRandomEvents.js';

const initialConfig = structuredClone(fishingConfig.randomEvents);

afterEach(() => {
  Object.assign(fishingConfig.randomEvents, structuredClone(initialConfig));
});

describe('active-time fishing event scheduling', () => {
  it('generates exactly one opportunity inside each approved window', () => {
    const rolls = [0, 0.25, 0.5, 0.75, 0.999999];
    const random = vi.fn(() => rolls.shift()!);
    const cycle = createFishingEventCycle(random);

    expect(random).toHaveBeenCalledTimes(5);
    expect(cycle.scheduleMs).toEqual([120_000, 960_000, 1_800_000, 2_640_000, 3_479_999]);
    for (const [index, timestamp] of cycle.scheduleMs.entries()) {
      const [min, max] = fishingConfig.randomEvents.windowsMs[index];
      expect(timestamp).toBeGreaterThanOrEqual(min);
      expect(timestamp).toBeLessThanOrEqual(max);
    }
    expect(cycle).toMatchObject({
      cycleNumber: 1,
      elapsedMs: 0,
      nextIndex: 0,
      triggeredCount: 0,
      pendingCycles: [],
    });
  });

  it('queues an opportunity exactly when due without consuming or rerolling it', () => {
    const original = createFishingEventCycle(() => 0);
    const beforeDue = advanceFishingEventClock(original, 119_999);
    expect(beforeDue.pendingCycles).toEqual([]);
    const due = advanceFishingEventClock(beforeDue, 1);
    expect(due.pendingCycles).toEqual([1]);
    expect(due.triggeredCount).toBe(0);
    expect(due.nextIndex).toBe(1);

    const random = vi.fn(() => 0.9);
    const reread = advanceFishingEventClock(due, 0, random);
    expect(reread).toEqual(due);
    expect(random).not.toHaveBeenCalled();
    expect(original).toEqual(createFishingEventCycle(() => 0));
  });

  it('starts a fresh schedule at exactly 60 active minutes and retains due history', () => {
    const first = createFishingEventCycle(() => 0);
    first.triggeredCount = 2;
    first.nextIndex = 2;
    first.elapsedMs = 1_000_000;

    const before = advanceFishingEventClock(first, 2_599_999);
    expect(before.cycleNumber).toBe(1);
    expect(before.elapsedMs).toBe(3_599_999);
    const random = vi.fn(() => 0.5);
    const next = advanceFishingEventClock(before, 1, random);

    expect(random).toHaveBeenCalledTimes(5);
    expect(next).toMatchObject({
      cycleNumber: 2,
      elapsedMs: 0,
      nextIndex: 0,
      triggeredCount: 0,
      pendingCycles: [1, 1, 1],
    });
    expect(next.scheduleMs).toEqual([360_000, 1_080_000, 1_800_000, 2_520_000, 3_240_000]);
  });

  it('preserves queued opportunities in order while continuing into subsequent cycles', () => {
    const first = createFishingEventCycle(() => 0);
    const random = vi.fn(() => 0);
    const next = advanceFishingEventClock(first, 7_320_000, random);

    expect(next.cycleNumber).toBe(3);
    expect(next.elapsedMs).toBe(120_000);
    expect(next.pendingCycles).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3]);
    expect(next.nextIndex).toBe(1);
    expect(random).toHaveBeenCalledTimes(10);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid elapsed active time (%s) without mutating the saved cycle',
    (elapsed) => {
      const cycle = createFishingEventCycle(() => 0.5);
      const saved = structuredClone(cycle);
      expect(() => advanceFishingEventClock(cycle, elapsed)).toThrow('nonnegative');
      expect(cycle).toEqual(saved);
    },
  );
});
