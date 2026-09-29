// Zero means absolute ineligibility; positive values are relative suitability.
export const fishConditions = {
  sardine: { time: [8, 10, 7, 3], sea: [10, 6, 2], bait: [7, 3, 2, 10, 3], rod: [10, 7, 4, 2] },
  mackerel: { time: [9, 10, 9, 4], sea: [8, 10, 4], bait: [5, 8, 3, 8, 10], rod: [10, 9, 7, 3] },
  red_mullet: { time: [7, 10, 7, 3], sea: [10, 7, 2], bait: [10, 5, 7, 10, 4], rod: [10, 8, 7, 2] },
  seabass: { time: [10, 5, 10, 8], sea: [6, 10, 0], bait: [8, 7, 10, 9, 8], rod: [5, 10, 10, 0] },
  bluefin_tuna: {
    time: [8, 10, 7, 0],
    sea: [8, 10, 0],
    bait: [0, 8, 0, 0, 10],
    rod: [0, 0, 0, 10],
  },
  conger_eel: { time: [4, 0, 8, 10], sea: [8, 10, 6], bait: [0, 10, 6, 0, 10], rod: [0, 5, 10, 8] },
  barracuda: { time: [10, 6, 10, 0], sea: [10, 8, 0], bait: [0, 7, 0, 0, 10], rod: [0, 7, 10, 7] },
  swordfish: { time: [0, 0, 6, 10], sea: [0, 8, 10], bait: [0, 10, 0, 0, 8], rod: [0, 0, 0, 10] },
} as const;

export const fishingIds = {
  time: ['Dawn', 'Day', 'Dusk', 'Night'],
  sea: ['Calm', 'Moderate', 'Dangerous'],
  bait: ['worm_bait', 'squid_bait', 'crab_bait', 'shrimp_bait', 'fish_chunks_bait'],
  rod: [
    'basic_fishing_rod',
    'reinforced_fishing_rod',
    'surfcasting_fishing_rod',
    'heavy_game_fishing_rod',
  ],
} as const;

export const fishingConfig = {
  pierId: 'fishing-pier',
  attemptIntervalMs: 30_000,
  attemptTiming: {
    rodDurationMultipliers: {
      basic_fishing_rod: 1,
      reinforced_fishing_rod: 1,
      surfcasting_fishing_rod: 1,
      heavy_game_fishing_rod: 1,
    },
    timeOfDayDurationMultipliers: { Dawn: 1, Day: 1, Dusk: 1, Night: 1 },
    seaStateDurationMultipliers: { Calm: 1, Moderate: 1, Dangerous: 1 },
  },
  livenessMs: 45_000,
  randomEvents: {
    cycleDurationMs: 3_600_000,
    windowsMs: [
      [120_000, 600_000],
      [840_000, 1_320_000],
      [1_560_000, 2_040_000],
      [2_280_000, 2_760_000],
      [3_000_000, 3_480_000],
    ],
    reelPromptWindowMs: 5_000,
    types: {
      reel_pull: { message: 'Your rod jerks hard!', buttonLabel: 'REEL!' },
    },
  },
  seaBlockMs: 1_800_000,
  seaTransitions: {
    Calm: { Calm: 0.6, Moderate: 0.4, Dangerous: 0 },
    Moderate: { Calm: 0.25, Moderate: 0.55, Dangerous: 0.2 },
    Dangerous: { Calm: 0, Moderate: 0.65, Dangerous: 0.35 },
  },
  rods: {
    basic_fishing_rod: 0.2,
    reinforced_fishing_rod: 0.4,
    surfcasting_fishing_rod: 0.4,
    heavy_game_fishing_rod: 0.4,
  },
  baits: {
    worm_bait: true,
    squid_bait: true,
    crab_bait: true,
    shrimp_bait: true,
    fish_chunks_bait: true,
  },
  // Existing species retain their relative base rarity; new values are provisional.
  speciesBaseWeights: {
    sardine: 70,
    mackerel: 25,
    red_mullet: 15,
    seabass: 10,
    bluefin_tuna: 5,
    conger_eel: 5,
    barracuda: 4,
    swordfish: 2,
  },
  fishConditions,
  conditions: {
    timeOfDay: { Dawn: 1.05, Day: 1, Dusk: 1.05, Night: 0.95 },
    seaState: { Calm: 1.05, Moderate: 1, Dangerous: 0.85 },
  },
  weightsKg: {
    sardine: { min: 0.05, max: 0.15, raritySlope: 4 },
    mackerel: { min: 0.2, max: 0.8, raritySlope: 4 },
    red_mullet: { min: 0.2, max: 1.5, raritySlope: 4 },
    seabass: { min: 0.5, max: 12, raritySlope: 4 },
    bluefin_tuna: { min: 30, max: 250, raritySlope: 4 },
    conger_eel: { min: 1, max: 50, raritySlope: 4 },
    barracuda: { min: 1, max: 25, raritySlope: 4 },
    swordfish: { min: 50, max: 300, raritySlope: 4 },
  },
} as const;

export type TimeOfDay = keyof typeof fishingConfig.conditions.timeOfDay;
export type SeaState = keyof typeof fishingConfig.conditions.seaState;
export type FishSpecies = keyof typeof fishingConfig.weightsKg;
export type RodId = keyof typeof fishingConfig.rods;
export type BaitId = keyof typeof fishingConfig.baits;
