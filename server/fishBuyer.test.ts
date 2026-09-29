// @vitest-environment node
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAccount } from './auth.js';
import { createCharacter, getCharacter } from './character.js';
import { openDatabase, seedDatabase } from './database.js';
import { fishBuyerState, priceFish, sellFish } from './fishBuyer.js';
import { fishingConfig, type FishSpecies } from './fishingConfig.js';
import { insertFishSpecimen, weightAtPercentile } from './fishSpecimens.js';
import { getInventory } from './inventory.js';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function setup() {
  const directory = mkdtempSync(path.join(tmpdir(), 'frontier-fish-buyer-'));
  directories.push(directory);
  const databasePath = path.join(directory, 'game.sqlite');
  const database = openDatabase(databasePath);
  seedDatabase(database);
  const account = createAccount(database, 'seller', 'test-password');
  const character = createCharacter(database, account.id, 'Sea Seller');
  const atStore = () =>
    database
      .prepare("UPDATE characters SET current_location = 'fishing-store' WHERE id = ?")
      .run(character.id);
  const addFish = (
    species: FishSpecies,
    weights: Array<number | null>,
    location: 'inventory' | 'locker' = 'inventory',
  ) => {
    const stackId = randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    database
      .prepare(
        `INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(stackId, character.id, species, weights.length, location, now, now);
    for (const weight of weights)
      insertFishSpecimen(database, stackId, weight, weight === null ? 'admin_unknown' : 'catch');
    const ids = database
      .prepare('SELECT id FROM fish_specimens WHERE stack_id = ? ORDER BY rowid')
      .all(stackId) as unknown as Array<{ id: string }>;
    return { stackId, ids: ids.map((row) => row.id) };
  };
  return { database, databasePath, account, character, atStore, addFish };
}

describe('Fishing Store fish buyer', () => {
  it('pays a flat ordinary price and a rising per-kg Trophy premium for each current species', () => {
    for (const species of Object.keys(fishingConfig.weightsKg) as FishSpecies[]) {
      const { min, max } = fishingConfig.weightsKg[species];
      const ordinary = priceFish(species, min);
      expect(priceFish(species, (min + weightAtPercentile(species, 0.95)) / 2)).toEqual(ordinary);
      expect(priceFish(species, null)).toEqual(ordinary);
      const threshold = priceFish(species, weightAtPercentile(species, 0.95));
      const heavier = priceFish(species, max);
      expect(threshold.credits).toBeGreaterThan(ordinary.credits);
      expect(heavier.credits).toBeGreaterThan(threshold.credits);
      expect(threshold.creditsPerKg).toBeGreaterThan(0);
      expect(heavier.creditsPerKg).toBeGreaterThan(threshold.creditsPerKg!);
    }
  });

  it('offers carried specimens only and sells a selected fish atomically without XP', () => {
    const { database, account, atStore, addFish } = setup();
    const trophy = fishingConfig.weightsKg.mackerel.max;
    const carried = addFish('mackerel', [0.21, trophy]);
    addFish('sardine', [0.1], 'locker');
    expect(fishBuyerState(database, account.id)).toEqual({ available: false, offers: [] });
    expect(
      sellFish(database, account.id, carried.stackId, [carried.ids[1]], randomUUID()),
    ).toMatchObject({ error: 'BUYER_UNAVAILABLE' });
    atStore();
    const offers = fishBuyerState(database, account.id).offers;
    expect(offers).toHaveLength(1);
    expect(offers[0].specimens[1]).toMatchObject({ trophy: true, weightKg: trophy });
    const quoted = offers[0].specimens[1].credits;
    const before = getCharacter(database, account.id)!;
    const result = sellFish(database, account.id, carried.stackId, [carried.ids[1]], randomUUID());
    expect(result).toMatchObject({
      creditsEarned: quoted,
      character: { credits: before.credits + quoted, characterXp: before.characterXp },
    });
    expect(
      getInventory(database, account.id)!.items.find((item) => item.instanceId === carried.stackId),
    ).toMatchObject({ quantity: 1 });
    expect(fishBuyerState(database, account.id).offers[0].specimens.map((fish) => fish.id)).toEqual(
      [carried.ids[0]],
    );
    database.close();
  });

  it('sells a whole stack once across retries and rejects stale, duplicate and foreign fish', () => {
    const { database, account, atStore, addFish } = setup();
    const stack = addFish('sardine', [0.05, 0.14]);
    atStore();
    const key = randomUUID();
    const first = sellFish(database, account.id, stack.stackId, stack.ids, key);
    expect(first).toHaveProperty('creditsEarned');
    const balance = getCharacter(database, account.id)!.credits;
    expect(
      sellFish(database, account.id, stack.stackId, [...stack.ids].reverse(), key),
    ).toMatchObject({ creditsEarned: (first as { creditsEarned: number }).creditsEarned });
    expect(getCharacter(database, account.id)!.credits).toBe(balance);
    expect(
      getInventory(database, account.id)!.items.some((item) => item.instanceId === stack.stackId),
    ).toBe(false);
    expect(sellFish(database, account.id, stack.stackId, [stack.ids[0]], key)).toMatchObject({
      error: 'REQUEST_KEY_REUSED',
    });
    expect(
      sellFish(database, account.id, stack.stackId, [stack.ids[0]], randomUUID()),
    ).toMatchObject({ error: 'FISH_UNAVAILABLE' });
    const other = createAccount(database, 'other-seller', 'test-password');
    const otherCharacter = createCharacter(database, other.id, 'Other Seller');
    database
      .prepare("UPDATE characters SET current_location = 'fishing-store' WHERE id = ?")
      .run(otherCharacter.id);
    expect(sellFish(database, other.id, stack.stackId, [stack.ids[0]], randomUUID())).toMatchObject(
      { error: 'FISH_UNAVAILABLE' },
    );
    expect(
      sellFish(database, account.id, stack.stackId, [stack.ids[0], stack.ids[0]], randomUUID()),
    ).toMatchObject({ error: 'VALIDATION_ERROR' });
    database.close();
  });

  it('accepts UUID stack IDs created by the legacy fish-stack migration', () => {
    const { database, account, character, atStore } = setup();
    const stackId = randomUUID();
    const now = new Date().toISOString();
    database
      .prepare(
        `INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at)
      VALUES (?, ?, 'sardine', 1, 'inventory', 0, ?, ?)`,
      )
      .run(stackId, character.id, now, now);
    insertFishSpecimen(database, stackId, 0.1, 'legacy_known');
    atStore();
    const specimenId = fishBuyerState(database, account.id).offers[0].specimens[0].id;
    expect(sellFish(database, account.id, stackId, [specimenId], randomUUID())).toMatchObject({
      creditsEarned: 3,
    });
    database.close();
  });
});
