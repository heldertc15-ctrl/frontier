import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { fishingConfig, type FishSpecies } from './fishingConfig.js';

export interface FishSpecimen {
  id: string;
  weightKg: number | null;
  trophy: boolean;
  weightKnown: boolean;
  minKg: number;
  maxKg: number;
  position: number | null;
}

const newId = () => randomBytes(16).toString('hex');

export function isFish(definitionId: string): definitionId is FishSpecies {
  return Object.hasOwn(fishingConfig.weightsKg, definitionId);
}

export function weightAtPercentile(species: FishSpecies, percentile: number): number {
  const { min, max, raritySlope } = fishingConfig.weightsKg[species];
  const fraction = -Math.log(1 - percentile * (1 - Math.exp(-raritySlope))) / raritySlope;
  return min + (max - min) * fraction;
}

export function sampleFishWeight(species: FishSpecies, roll: number): number {
  const clamped = Math.max(0, Math.min(1, roll));
  return Math.round(weightAtPercentile(species, clamped) * 100_000) / 100_000;
}

export function sampleTrophyWeight(species: FishSpecies, roll: number): number {
  const percentile = 0.95 + Math.max(0, Math.min(1, roll)) * 0.05;
  const minimumTrophy = Math.ceil(weightAtPercentile(species, 0.95) * 100_000) / 100_000;
  return Math.max(minimumTrophy, sampleFishWeight(species, percentile));
}

export function fishWeightPosition(species: FishSpecies, weightKg: number): number {
  const { min, max } = fishingConfig.weightsKg[species];
  return Math.max(0, Math.min(1, (weightKg - min) / (max - min)));
}

export function isTrophy(species: FishSpecies, weightKg: number): boolean {
  return weightKg >= weightAtPercentile(species, 0.95);
}

export function insertFishSpecimen(
  database: DatabaseSync,
  stackId: string,
  weightKg: number | null,
  source: 'catch' | 'admin_unknown' | 'legacy_known' | 'legacy_unknown',
  timestamp = new Date().toISOString(),
): void {
  database
    .prepare(
      'INSERT INTO fish_specimens (id, stack_id, weight_kg, source, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(newId(), stackId, weightKg, source, timestamp);
}

export function insertUnknownFishSpecimens(
  database: DatabaseSync,
  stackId: string,
  count: number,
): void {
  for (let index = 0; index < count; index++)
    insertFishSpecimen(database, stackId, null, 'admin_unknown');
}

export function fishSpecimensForStack(
  database: DatabaseSync,
  stackId: string,
  species: FishSpecies,
): FishSpecimen[] {
  const { min, max } = fishingConfig.weightsKg[species];
  const rows = database
    .prepare(
      'SELECT id, weight_kg FROM fish_specimens WHERE stack_id = ? ORDER BY created_at, rowid',
    )
    .all(stackId) as unknown as Array<{ id: string; weight_kg: number | null }>;
  return rows.map((row) => ({
    id: row.id,
    weightKg: row.weight_kg,
    weightKnown: row.weight_kg !== null,
    trophy: row.weight_kg !== null && isTrophy(species, row.weight_kg),
    minKg: min,
    maxKg: max,
    position: row.weight_kg === null ? null : fishWeightPosition(species, row.weight_kg),
  }));
}

export function moveFishSpecimens(
  database: DatabaseSync,
  fromId: string,
  toId: string,
  count: number,
): void {
  database
    .prepare(
      `UPDATE fish_specimens SET stack_id = ? WHERE id IN (
        SELECT id FROM fish_specimens WHERE stack_id = ? ORDER BY created_at, rowid LIMIT ?
      )`,
    )
    .run(toId, fromId, count);
}

export function removeFishSpecimens(database: DatabaseSync, stackId: string, count: number): void {
  database
    .prepare(
      `DELETE FROM fish_specimens WHERE id IN (
        SELECT id FROM fish_specimens WHERE stack_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?
      )`,
    )
    .run(stackId, count);
}
