import { describe, expect, it } from 'vitest';
import { effectiveGameTime, FRONTIER_DAY_MS, FRONTIER_HOUR_MS, gameTimeAt } from './gameTime.js';

describe('shared Frontier clock', () => {
  it('runs six complete days per real UTC day at ten minutes per hour', () => {
    expect(FRONTIER_HOUR_MS).toBe(600_000);
    expect(FRONTIER_DAY_MS).toBe(4 * 60 * 60_000);
    for (let cycle = 0; cycle < 6; cycle++) {
      const start = gameTimeAt(cycle * FRONTIER_DAY_MS);
      expect(start).toMatchObject({ day: cycle + 1, hour: 0, minute: 0, scheduledPhase: 'Night' });
      expect(gameTimeAt(cycle * FRONTIER_DAY_MS + 24 * FRONTIER_HOUR_MS - 1).day).toBe(cycle + 1);
    }
    expect(gameTimeAt(24 * 60 * 60_000)).toMatchObject({ day: 7, hour: 0, minute: 0 });
  });
  it('uses half-open dawn, day, dusk, and night intervals', () => {
    const cases = [
      [0, 'Night', 'Dawn'],
      [5, 'Dawn', 'Day'],
      [8, 'Day', 'Dusk'],
      [17, 'Dusk', 'Night'],
      [20, 'Night', 'Dawn'],
    ] as const;
    for (const [hour, phase, next] of cases) {
      const boundary = hour * FRONTIER_HOUR_MS;
      expect(gameTimeAt(boundary)).toMatchObject({
        hour,
        minute: 0,
        scheduledPhase: phase,
        nextPhase: next,
      });
      if (hour > 0) expect(gameTimeAt(boundary - 1).scheduledPhase).not.toBe(phase);
    }
    expect(gameTimeAt(10 * FRONTIER_MINUTE_MS_TEST)).toMatchObject({ hour: 0, minute: 10 });
  });
  it('starts an override at its phase boundary, then keeps the clock running', () => {
    const anchor = 14 * FRONTIER_HOUR_MS + 23 * 10_000;
    expect(effectiveGameTime(anchor, 'Day', anchor)).toMatchObject({
      hour: 8,
      minute: 0,
      scheduledPhase: 'Day',
    });
    expect(effectiveGameTime(anchor + 10_000, 'Day', anchor)).toMatchObject({
      hour: 8,
      minute: 1,
      scheduledPhase: 'Day',
    });
    expect(effectiveGameTime(anchor + 9 * FRONTIER_HOUR_MS, 'Day', anchor)).toMatchObject({
      hour: 17,
      minute: 0,
      scheduledPhase: 'Dusk',
    });
    expect(effectiveGameTime(anchor + 16 * FRONTIER_HOUR_MS, 'Day', anchor)).toMatchObject({
      hour: 0,
      minute: 0,
      scheduledPhase: 'Night',
    });
    expect(effectiveGameTime(anchor, null, null)).toEqual(gameTimeAt(anchor));
  });
});

const FRONTIER_MINUTE_MS_TEST = 10_000;
