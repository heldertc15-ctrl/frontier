import { afterEach, expect, it } from 'vitest';
import {
  fishingSoundStorageKey,
  readFishingSoundPreferences,
  saveFishingSoundPreferences,
} from './fishingSoundPreferences';

afterEach(() => localStorage.clear());

it('saves independent fishing sound choices for each character on this browser', () => {
  expect(readFishingSoundPreferences('angler-one')).toEqual({ reelEvent: true, fishCatch: true });
  saveFishingSoundPreferences('angler-one', { reelEvent: false, fishCatch: true });
  saveFishingSoundPreferences('angler-two', { reelEvent: true, fishCatch: false });
  expect(readFishingSoundPreferences('angler-one')).toEqual({ reelEvent: false, fishCatch: true });
  expect(readFishingSoundPreferences('angler-two')).toEqual({ reelEvent: true, fishCatch: false });
});

it('defaults safely when saved preference data is incomplete or malformed', () => {
  localStorage.setItem(fishingSoundStorageKey('angler'), '{"reelEvent":false}');
  expect(readFishingSoundPreferences('angler')).toEqual({ reelEvent: false, fishCatch: true });
  localStorage.setItem(fishingSoundStorageKey('angler'), '{broken');
  expect(readFishingSoundPreferences('angler')).toEqual({ reelEvent: true, fishCatch: true });
});
