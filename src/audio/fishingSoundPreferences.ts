export interface FishingSoundPreferences {
  reelEvent: boolean;
  fishCatch: boolean;
}

export const defaultFishingSoundPreferences: FishingSoundPreferences = {
  reelEvent: true,
  fishCatch: true,
};

export function fishingSoundStorageKey(characterId: string): string {
  return `frontier:fishing-sounds:${characterId}`;
}

export function readFishingSoundPreferences(characterId: string): FishingSoundPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(fishingSoundStorageKey(characterId)) ?? 'null');
    if (!saved || typeof saved !== 'object') return { ...defaultFishingSoundPreferences };
    return {
      reelEvent: saved.reelEvent !== false,
      fishCatch: saved.fishCatch !== false,
    };
  } catch {
    return { ...defaultFishingSoundPreferences };
  }
}

export function saveFishingSoundPreferences(
  characterId: string,
  preferences: FishingSoundPreferences,
): void {
  try {
    localStorage.setItem(fishingSoundStorageKey(characterId), JSON.stringify(preferences));
  } catch {
    // Browser storage is optional; the current page still honors the selected setting.
  }
}
