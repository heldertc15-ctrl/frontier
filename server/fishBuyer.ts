import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getCharacter } from './character.js';
import { fishingConfig, type FishSpecies } from './fishingConfig.js';
import { fishSpecimensForStack, isFish, weightAtPercentile } from './fishSpecimens.js';
import { getInventory, itemDefinition, type InventoryState } from './inventory.js';

// Provisional Fishing Store prices. Ordinary fish are paid per fish; Trophy rates
// climb linearly between the species' Trophy threshold and maximum weight.
export const fishBuyerPrices: Record<
  FishSpecies,
  { ordinary: number; trophyRateMin: number; trophyRateMax: number }
> = {
  sardine: { ordinary: 3, trophyRateMin: 35, trophyRateMax: 60 },
  mackerel: { ordinary: 9, trophyRateMin: 20, trophyRateMax: 34 },
  bluefin_tuna: { ordinary: 60, trophyRateMin: 0.5, trophyRateMax: 1 },
  red_mullet: { ordinary: 9, trophyRateMin: 20, trophyRateMax: 34 },
  seabass: { ordinary: 20, trophyRateMin: 8, trophyRateMax: 16 },
  conger_eel: { ordinary: 30, trophyRateMin: 4, trophyRateMax: 8 },
  barracuda: { ordinary: 30, trophyRateMin: 6, trophyRateMax: 12 },
  swordfish: { ordinary: 80, trophyRateMin: 0.5, trophyRateMax: 1 },
};

export interface FishBuyerOffer {
  stackId: string;
  speciesId: FishSpecies;
  name: string;
  artworkPath?: string;
  totalCredits: number;
  specimens: Array<{
    id: string;
    weightKg: number | null;
    trophy: boolean;
    credits: number;
    creditsPerKg: number | null;
  }>;
}

export interface FishBuyerState {
  available: boolean;
  offers: FishBuyerOffer[];
}

type BuyerError = { error: string; message: string };

export function priceFish(
  species: FishSpecies,
  weightKg: number | null,
): { credits: number; creditsPerKg: number | null } {
  const price = fishBuyerPrices[species];
  if (weightKg === null || weightKg < weightAtPercentile(species, 0.95))
    return { credits: price.ordinary, creditsPerKg: null };
  const maximum = fishingConfig.weightsKg[species].max;
  const threshold = weightAtPercentile(species, 0.95);
  const fraction = Math.max(0, Math.min(1, (weightKg - threshold) / (maximum - threshold)));
  const creditsPerKg = price.trophyRateMin + fraction * (price.trophyRateMax - price.trophyRateMin);
  return {
    credits: Math.max(price.ordinary + 1, Math.round(weightKg * creditsPerKg)),
    creditsPerKg,
  };
}

export function fishBuyerState(database: DatabaseSync, accountId: string): FishBuyerState {
  const character = getCharacter(database, accountId);
  if (!character || character.currentLocationId !== 'fishing-store')
    return { available: false, offers: [] };
  const inventory = getInventory(database, accountId);
  const offers: FishBuyerOffer[] = (inventory?.items ?? []).flatMap((item) => {
    if (!isFish(item.id)) return [];
    const speciesId = item.id;
    const specimens = fishSpecimensForStack(database, item.instanceId, speciesId).map(
      (specimen) => ({
        id: specimen.id,
        weightKg: specimen.weightKg,
        trophy: specimen.trophy,
        ...priceFish(speciesId, specimen.weightKg),
      }),
    );
    return [
      {
        stackId: item.instanceId,
        speciesId,
        name: item.name,
        artworkPath: itemDefinition(item.id)?.artworkPath,
        totalCredits: specimens.reduce((sum, specimen) => sum + specimen.credits, 0),
        specimens,
      },
    ];
  });
  return { available: true, offers };
}

export function sellFish(
  database: DatabaseSync,
  accountId: string,
  stackId: unknown,
  specimenIds: unknown,
  requestKey: unknown,
):
  | {
      creditsEarned: number;
      inventory: InventoryState | null;
      character: ReturnType<typeof getCharacter>;
      buyer: FishBuyerState;
    }
  | BuyerError {
  if (
    typeof stackId !== 'string' ||
    !/^(?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(stackId) ||
    !Array.isArray(specimenIds) ||
    specimenIds.length < 1 ||
    specimenIds.length > 10 ||
    !specimenIds.every((id) => typeof id === 'string' && /^[a-f\d]{32}$/i.test(id)) ||
    new Set(specimenIds).size !== specimenIds.length ||
    typeof requestKey !== 'string' ||
    !/^[a-zA-Z\d_-]{8,80}$/.test(requestKey)
  )
    return {
      error: 'VALIDATION_ERROR',
      message: 'Choose one or more fish and provide a unique request key.',
    };
  const ids = specimenIds as string[];
  const signature = JSON.stringify({ stackId, specimenIds: [...ids].sort() });
  database.exec('BEGIN IMMEDIATE');
  try {
    const character = getCharacter(database, accountId);
    if (!character) {
      database.exec('ROLLBACK');
      return { error: 'CHARACTER_NOT_FOUND', message: 'Character not found.' };
    }
    const prior = database
      .prepare(
        'SELECT signature, credits_earned FROM npc_fish_sales WHERE character_id = ? AND request_key = ?',
      )
      .get(character.id, requestKey) as { signature: string; credits_earned: number } | undefined;
    if (prior) {
      database.exec('COMMIT');
      return prior.signature === signature
        ? {
            creditsEarned: prior.credits_earned,
            inventory: getInventory(database, accountId),
            character: getCharacter(database, accountId),
            buyer: fishBuyerState(database, accountId),
          }
        : {
            error: 'REQUEST_KEY_REUSED',
            message: 'This request key was used for a different sale.',
          };
    }
    if (character.currentLocationId !== 'fishing-store') {
      database.exec('ROLLBACK');
      return {
        error: 'BUYER_UNAVAILABLE',
        message: 'Visit the Fishing Store to sell carried fish.',
      };
    }
    const stack = database
      .prepare(
        "SELECT definition_id, quantity FROM character_items WHERE id = ? AND character_id = ? AND location = 'inventory'",
      )
      .get(stackId, character.id) as { definition_id: string; quantity: number } | undefined;
    if (!stack || !isFish(stack.definition_id)) {
      database.exec('ROLLBACK');
      return {
        error: 'FISH_UNAVAILABLE',
        message: 'That carried fish stack is no longer available.',
      };
    }
    const specimens = fishSpecimensForStack(database, stackId, stack.definition_id);
    const selected = specimens.filter((specimen) => ids.includes(specimen.id));
    if (selected.length !== ids.length || selected.length > stack.quantity) {
      database.exec('ROLLBACK');
      return {
        error: 'FISH_UNAVAILABLE',
        message: 'One or more selected fish are no longer available.',
      };
    }
    const creditsEarned = selected.reduce(
      (sum, specimen) =>
        sum + priceFish(stack.definition_id as FishSpecies, specimen.weightKg).credits,
      0,
    );
    if (!Number.isSafeInteger(character.credits + creditsEarned)) {
      database.exec('ROLLBACK');
      return { error: 'CREDIT_LIMIT', message: 'This sale would exceed the credit limit.' };
    }
    const timestamp = new Date().toISOString();
    const remove = database.prepare('DELETE FROM fish_specimens WHERE id = ? AND stack_id = ?');
    for (const specimen of selected) remove.run(specimen.id, stackId);
    if (selected.length === stack.quantity)
      database.prepare('DELETE FROM character_items WHERE id = ?').run(stackId);
    else
      database
        .prepare('UPDATE character_items SET quantity = quantity - ?, updated_at = ? WHERE id = ?')
        .run(selected.length, timestamp, stackId);
    database
      .prepare('UPDATE characters SET credits = credits + ?, updated_at = ? WHERE id = ?')
      .run(creditsEarned, timestamp, character.id);
    database
      .prepare(
        'INSERT INTO npc_fish_sales (id, character_id, request_key, signature, species_id, specimen_count, credits_earned, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        randomUUID(),
        character.id,
        requestKey,
        signature,
        stack.definition_id,
        selected.length,
        creditsEarned,
        JSON.stringify(
          selected.map((specimen) => ({
            id: specimen.id,
            weightKg: specimen.weightKg,
            trophy: specimen.trophy,
            ...priceFish(stack.definition_id as FishSpecies, specimen.weightKg),
          })),
        ),
        timestamp,
      );
    database.exec('COMMIT');
    return {
      creditsEarned,
      inventory: getInventory(database, accountId),
      character: getCharacter(database, accountId),
      buyer: fishBuyerState(database, accountId),
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
