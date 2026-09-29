import { describe, expect, it } from 'vitest';
import { fishConditions, fishingIds, fishingConfig } from './fishingConfig.js';
import { calculateFishing, fishConditionScore, speciesSharePercent } from './fishingCalculation.js';

describe('fishing condition matrix', () => {
  it('has every required entry and keeps the three generalists eligible everywhere', () => {
    expect(Object.keys(fishConditions)).toHaveLength(8);
    for (const [species, matrix] of Object.entries(fishConditions)) {
      expect(matrix.time).toHaveLength(fishingIds.time.length);
      expect(matrix.sea).toHaveLength(fishingIds.sea.length);
      expect(matrix.bait).toHaveLength(fishingIds.bait.length);
      expect(matrix.rod).toHaveLength(fishingIds.rod.length);
      for (const value of [...matrix.time, ...matrix.sea, ...matrix.bait, ...matrix.rod])
        expect(Number.isInteger(value) && value >= 0 && value <= 10).toBe(true);
      if (['sardine', 'mackerel', 'red_mullet'].includes(species))
        expect([...matrix.time, ...matrix.sea, ...matrix.bait, ...matrix.rod].every(Boolean)).toBe(
          true,
        );
    }
    expect(fishingIds.bait).toEqual(Object.keys(fishingConfig.baits));
    expect(fishingIds.rod).toEqual(Object.keys(fishingConfig.rods));
    expect(Object.keys(fishConditions)).toEqual(Object.keys(fishingConfig.weightsKg));
  });

  it.each([
    ['swordfish', 'Day', 'Dangerous', 'squid_bait', 'heavy_game_fishing_rod', false],
    ['swordfish', 'Night', 'Dangerous', 'squid_bait', 'heavy_game_fishing_rod', true],
    ['swordfish', 'Night', 'Dangerous', 'squid_bait', 'surfcasting_fishing_rod', false],
    ['bluefin_tuna', 'Night', 'Moderate', 'fish_chunks_bait', 'heavy_game_fishing_rod', false],
    ['bluefin_tuna', 'Day', 'Moderate', 'fish_chunks_bait', 'heavy_game_fishing_rod', true],
    ['conger_eel', 'Day', 'Moderate', 'squid_bait', 'surfcasting_fishing_rod', false],
    ['conger_eel', 'Night', 'Moderate', 'squid_bait', 'surfcasting_fishing_rod', true],
    ['barracuda', 'Night', 'Calm', 'squid_bait', 'surfcasting_fishing_rod', false],
    ['seabass', 'Dusk', 'Dangerous', 'crab_bait', 'surfcasting_fishing_rod', false],
  ] as const)(
    '%s in %s/%s with %s/%s eligibility is %s',
    (species, timeOfDay, seaState, bait, rod, eligible) => {
      const conditions = { timeOfDay, seaState };
      expect(fishConditionScore(species, rod, bait, conditions) > 0).toBe(eligible);
      expect(Object.hasOwn(calculateFishing(rod, bait, conditions).speciesWeights, species)).toBe(
        eligible,
      );
    },
  );

  it('uses all four positive factors as relative weights without changing catch success chance', () => {
    const conditions = { timeOfDay: 'Day', seaState: 'Calm' } as const;
    expect(fishConditionScore('sardine', 'basic_fishing_rod', 'worm_bait', conditions)).toBe(0.7);
    expect(
      calculateFishing('basic_fishing_rod', 'worm_bait', conditions).speciesWeights.sardine,
    ).toBe(49);
    expect(calculateFishing('basic_fishing_rod', 'worm_bait', conditions).probability).toBeCloseTo(
      0.2 * 1.05,
    );
  });

  it('normalizes each eligible score against the complete pool, including hidden species', () => {
    const weights = calculateFishing('basic_fishing_rod', 'squid_bait', {
      timeOfDay: 'Day',
      seaState: 'Calm',
    }).speciesWeights;
    const species = Object.keys(weights) as Array<keyof typeof fishConditions>;
    expect(species).toEqual(['sardine', 'mackerel', 'red_mullet', 'seabass']);
    expect(species.reduce((sum, id) => sum + speciesSharePercent(weights, id), 0)).toBeCloseTo(100);
    expect(speciesSharePercent(weights, 'sardine')).toBeCloseTo(
      (weights.sardine! / Object.values(weights).reduce((sum, weight) => sum + weight, 0)) * 100,
    );
    expect(speciesSharePercent(weights, 'bluefin_tuna')).toBe(0);
  });
});
