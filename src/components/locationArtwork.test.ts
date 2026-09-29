import { describe, expect, it } from 'vitest';
import { fishingPierArtwork, fishingStoreArtwork, locationArtwork } from './locationArtwork';

describe('Fishing Pier scene variants', () => {
  it('maps all four phases and three effective sea states to distinct supplied images', () => {
    const images = new Set<string>();
    for (const phase of ['Dawn', 'Day', 'Dusk', 'Night'] as const) {
      for (const sea of ['Calm', 'Moderate', 'Dangerous'] as const) {
        const scene = fishingPierArtwork(phase, sea);
        expect(scene.src).toContain('fishingpier-');
        expect(scene.alt).toContain(phase);
        expect(scene.caption).toContain(sea);
        expect(scene).toMatchObject({ width: 2560, height: 1440, hotspots: [] });
        images.add(scene.src);
      }
    }
    expect(images.size).toBe(12);
  });
});

describe('Fishing Store scene variants', () => {
  it('maps every phase to its supplied interior without map hotspots', () => {
    const images = new Set<string>();
    for (const phase of ['Dawn', 'Day', 'Dusk', 'Night'] as const) {
      const scene = fishingStoreArtwork(phase);
      expect(decodeURIComponent(scene.src)).toContain(`fishing store ${phase.toLowerCase()}.webp`);
      expect(scene.alt).toContain(phase);
      expect(scene.caption).toContain(phase);
      expect(scene).toMatchObject({ width: 2560, height: 1440, hotspots: [] });
      images.add(scene.src);
    }
    expect(images.size).toBe(4);
  });

  it('uses the supplied Day interior before shared world conditions arrive', () => {
    expect(locationArtwork['fishing-store']).toEqual(fishingStoreArtwork('Day'));
  });
});
