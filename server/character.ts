import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { seedStarterItems } from './inventory.js';
import { canonicalLocationId, locationDisplayName, seedStarterLocations } from './locations.js';

export interface Character {
  id: string;
  name: string;
  credits: number;
  hp: number;
  maxHp: number;
  characterXp: number;
  characterLevel: number;
  currentLocation: string;
  currentLocationId: string;
  activeStatus: string;
}

interface CharacterRow {
  id: string;
  name: string;
  credits: number;
  hp: number;
  max_hp: number;
  character_xp: number;
  character_level: number;
  current_location: string;
  active_status: string;
}

export interface CharacterUpdate {
  credits?: number;
  hp?: number;
  characterXp?: number;
}

function id(): string {
  return randomBytes(16).toString('hex');
}

function mapCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    name: row.name,
    credits: row.credits,
    hp: row.hp,
    maxHp: row.max_hp,
    characterXp: row.character_xp,
    characterLevel: row.character_level,
    currentLocation: locationDisplayName(row.current_location),
    currentLocationId: canonicalLocationId(row.current_location),
    activeStatus: row.active_status,
  };
}

export function validateCharacterName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return /^[\p{L}][\p{L}0-9 '-]{1,23}$/u.test(name) ? name : null;
}

export function createCharacter(
  database: DatabaseSync,
  accountId: string,
  name: string,
): Character {
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO characters
       (id, account_id, name, credits, hp, max_hp, character_xp, character_level, current_location, active_status, created_at, updated_at)
       VALUES (?, ?, ?, 250, 100, 100, 0, 1, 'new-harbor', 'idle', ?, ?)`,
    )
    .run(id(), accountId, name, now, now);
  const character = getCharacter(database, accountId);
  if (!character) throw new Error('Character was not created.');
  seedStarterItems(database, accountId);
  seedStarterLocations(database, accountId);
  return character;
}

export function getCharacter(database: DatabaseSync, accountId: string): Character | null {
  const row = database
    .prepare(
      `SELECT id, name, credits, hp, max_hp, character_xp, character_level, current_location, active_status
       FROM characters WHERE account_id = ?`,
    )
    .get(accountId) as CharacterRow | undefined;
  return row ? mapCharacter(row) : null;
}

export function updateDevelopmentCharacter(
  database: DatabaseSync,
  accountId: string,
  update: CharacterUpdate,
): Character | null {
  const current = getCharacter(database, accountId);
  if (!current) return null;
  const credits = update.credits ?? current.credits;
  const characterXp = update.characterXp ?? current.characterXp;
  const hp = update.hp ?? current.hp;
  if (
    !Number.isSafeInteger(credits) ||
    credits < 0 ||
    !Number.isSafeInteger(characterXp) ||
    characterXp < 0 ||
    !Number.isSafeInteger(hp) ||
    hp < 0 ||
    hp > current.maxHp
  ) {
    return null;
  }
  database
    .prepare(
      'UPDATE characters SET credits = ?, hp = ?, character_xp = ?, updated_at = ? WHERE account_id = ?',
    )
    .run(credits, hp, characterXp, new Date().toISOString(), accountId);
  return getCharacter(database, accountId);
}
