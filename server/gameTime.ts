import type { TimeOfDay } from './fishingConfig.js';

// The shared clock is anchored to Unix UTC. Six 4-hour Frontier days fit every real UTC day.
export const FRONTIER_HOUR_MS = 600_000;
export const FRONTIER_DAY_MS = 24 * FRONTIER_HOUR_MS;
const FRONTIER_MINUTE_MS = FRONTIER_HOUR_MS / 60;
const phaseStarts = [
  { minute: 0, phase: 'Night' },
  { minute: 5 * 60, phase: 'Dawn' },
  { minute: 8 * 60, phase: 'Day' },
  { minute: 17 * 60, phase: 'Dusk' },
  { minute: 20 * 60, phase: 'Night' },
] as const;

export interface GameTime {
  day: number;
  hour: number;
  minute: number;
  scheduledPhase: TimeOfDay;
  nextPhase: TimeOfDay;
  nextPhaseAt: string;
}

export function effectiveGameTime(
  nowMs: number,
  override: TimeOfDay | null,
  startedAtMs: number | null,
): GameTime {
  if (!override) return gameTimeAt(nowMs);
  if (startedAtMs === null || !Number.isFinite(startedAtMs))
    throw new Error('Invalid time override anchor.');
  const hour = { Dawn: 5, Day: 8, Dusk: 17, Night: 20 }[override];
  const offset = hour * FRONTIER_HOUR_MS - (startedAtMs % FRONTIER_DAY_MS);
  const shifted = gameTimeAt(nowMs + offset);
  return {
    ...shifted,
    nextPhaseAt: new Date(Date.parse(shifted.nextPhaseAt) - offset).toISOString(),
  };
}

export function gameTimeAt(nowMs: number): GameTime {
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error('Invalid server clock.');
  const dayIndex = Math.floor(nowMs / FRONTIER_DAY_MS);
  const dayStart = dayIndex * FRONTIER_DAY_MS;
  const minuteOfDay = Math.floor((nowMs - dayStart) / FRONTIER_MINUTE_MS);
  const current = [...phaseStarts].reverse().find((entry) => minuteOfDay >= entry.minute)!;
  const following = phaseStarts.find((entry) => entry.minute > minuteOfDay);
  const nextPhaseAt = following
    ? dayStart + following.minute * FRONTIER_MINUTE_MS
    : dayStart + FRONTIER_DAY_MS + 5 * 60 * FRONTIER_MINUTE_MS;
  return {
    day: dayIndex + 1,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    scheduledPhase: current.phase,
    nextPhase: following?.phase ?? 'Dawn',
    nextPhaseAt: new Date(nextPhaseAt).toISOString(),
  };
}
