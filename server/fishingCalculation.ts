import {
  fishingConfig,
  type BaitId,
  fishingIds,
  type FishSpecies,
  type RodId,
  type SeaState,
  type TimeOfDay,
} from './fishingConfig.js';

export function fishConditionScore(
  species: FishSpecies,
  rodId: RodId,
  baitId: BaitId,
  conditions: { timeOfDay: TimeOfDay; seaState: SeaState },
): number {
  const values = fishingConfig.fishConditions[species];
  const factors = [
    values.time[fishingIds.time.indexOf(conditions.timeOfDay)],
    values.sea[fishingIds.sea.indexOf(conditions.seaState)],
    values.bait[fishingIds.bait.indexOf(baitId)],
    values.rod[fishingIds.rod.indexOf(rodId)],
  ];
  if (factors.some((value) => !value)) return 0;
  return factors.reduce((product, value) => product * value, 1) / 10_000;
}

export function fishingSpeciesWeights(
  rodId: RodId,
  baitId: BaitId,
  conditions: { timeOfDay: TimeOfDay; seaState: SeaState },
): Partial<Record<FishSpecies, number>> {
  return Object.fromEntries(
    (Object.keys(fishingConfig.fishConditions) as FishSpecies[]).flatMap((species) => {
      const score = fishConditionScore(species, rodId, baitId, conditions);
      return score > 0 ? [[species, fishingConfig.speciesBaseWeights[species] * score]] : [];
    }),
  );
}

export function speciesSharePercent(
  weights: Partial<Record<FishSpecies, number>>,
  species: FishSpecies,
): number {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  return total > 0 ? ((weights[species] ?? 0) / total) * 100 : 0;
}

export function fishingAttemptDurationMs(
  rodId: RodId,
  conditions: { timeOfDay: TimeOfDay; seaState: SeaState },
): number {
  const timing = fishingConfig.attemptTiming;
  const factors = [
    fishingConfig.attemptIntervalMs,
    timing.rodDurationMultipliers[rodId],
    timing.timeOfDayDurationMultipliers[conditions.timeOfDay],
    timing.seaStateDurationMultipliers[conditions.seaState],
  ];
  if (factors.some((factor) => !Number.isFinite(factor) || factor <= 0))
    throw new Error('Fishing attempt timing values must be positive and finite.');
  const duration = Math.round(
    fishingConfig.attemptIntervalMs *
      timing.rodDurationMultipliers[rodId] *
      timing.timeOfDayDurationMultipliers[conditions.timeOfDay] *
      timing.seaStateDurationMultipliers[conditions.seaState],
  );
  if (!Number.isSafeInteger(duration) || duration <= 0)
    throw new Error('Fishing attempt duration must be a positive safe integer.');
  return duration;
}

export function calculateFishing(
  rodId: RodId,
  baitId: BaitId,
  conditions: { timeOfDay: TimeOfDay; seaState: SeaState },
) {
  const rodBaseChance = fishingConfig.rods[rodId];
  const modifiers = {
    timeOfDay: fishingConfig.conditions.timeOfDay[conditions.timeOfDay],
    seaState: fishingConfig.conditions.seaState[conditions.seaState],
  };
  return {
    rodBaseChance,
    modifiers,
    probability: rodBaseChance * modifiers.timeOfDay * modifiers.seaState,
    speciesWeights: fishingSpeciesWeights(rodId, baitId, conditions),
  };
}
