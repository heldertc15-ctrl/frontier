import type { DatabaseSync } from 'node:sqlite';
import { stopFishingForDeparture } from './fishing.js';

export type LocationKind = 'city' | 'district' | 'zone' | 'place';
export type DiscoveryState = 'starting' | 'visit';
export const MAX_PINNED_LOCATIONS = 5;

export interface HotspotDefinition {
  id: string;
  label: string;
  targetLocationId: string;
  region?: { type: 'polygon'; points: Array<{ x: number; y: number }> };
}

export interface LocationDefinition {
  id: string;
  name: string;
  description: string;
  kind: LocationKind;
  parentId: string | null;
  artworkPath?: string;
  childLocationIds: string[];
  hotspots: HotspotDefinition[];
  discoveryState: DiscoveryState;
  pinEligible: boolean;
}

const locationDefinitions: Record<string, LocationDefinition> = {
  'new-harbor': {
    id: 'new-harbor',
    name: 'New Harbor',
    kind: 'city',
    parentId: null,
    description: 'A working city where the coast, commerce, and frontier meet.',
    childLocationIds: [
      'harbor',
      'market-district',
      'industrial-district',
      'civic-residential',
      'city-centre',
      'transit-hub',
      'outskirts',
    ],
    hotspots: [
      { id: 'harbor-district', label: 'Harbor', targetLocationId: 'harbor' },
      { id: 'market-district', label: 'Market District', targetLocationId: 'market-district' },
      {
        id: 'industrial-district',
        label: 'Industrial District',
        targetLocationId: 'industrial-district',
      },
      {
        id: 'civic-residential',
        label: 'Residential District',
        targetLocationId: 'civic-residential',
      },
      { id: 'city-centre', label: 'City Centre', targetLocationId: 'city-centre' },
      { id: 'transit-hub', label: 'Transit Hub', targetLocationId: 'transit-hub' },
      { id: 'outskirts', label: 'Outskirts', targetLocationId: 'outskirts' },
    ],
    discoveryState: 'starting',
    pinEligible: false,
  },
  harbor: {
    id: 'harbor',
    name: 'Harbor District',
    kind: 'district',
    parentId: 'new-harbor',
    description: 'Piers, cargo sheds, and the city’s connection to the water.',
    childLocationIds: [
      'fishing-pier',
      'boat-market',
      'freight-terminal',
      'fishing-store',
      'harbor-contracts-office',
    ],
    hotspots: [
      { id: 'fishing-pier', label: 'Fishing Pier', targetLocationId: 'fishing-pier' },
      { id: 'freight-terminal', label: 'Freight Terminal', targetLocationId: 'freight-terminal' },
    ],
    discoveryState: 'visit',
    pinEligible: true,
  },
  'market-district': {
    id: 'market-district',
    name: 'Market District',
    kind: 'district',
    parentId: 'new-harbor',
    description: 'Stalls, storefronts, and everyday city trade.',
    childLocationIds: ['market-square', 'traders-row'],
    hotspots: [],
    discoveryState: 'visit',
    pinEligible: true,
  },
  'industrial-district': {
    id: 'industrial-district',
    name: 'Industrial District',
    kind: 'district',
    parentId: 'new-harbor',
    description: 'Workshops, materials, and practical infrastructure.',
    childLocationIds: ['refinery', 'workshops', 'warehouse-yard'],
    hotspots: [{ id: 'refinery', label: 'Refinery', targetLocationId: 'refinery' }],
    discoveryState: 'visit',
    pinEligible: true,
  },
  'civic-residential': {
    id: 'civic-residential',
    name: 'Residential District',
    kind: 'district',
    parentId: 'new-harbor',
    description: 'Neighborhood homes and everyday residential streets.',
    childLocationIds: ['newcomer-housing'],
    hotspots: [],
    discoveryState: 'visit',
    pinEligible: true,
  },
  'city-centre': {
    id: 'city-centre',
    name: 'City Centre',
    kind: 'district',
    parentId: 'new-harbor',
    description: 'Civic Hall, public services, and the central square.',
    childLocationIds: ['civic-hall'],
    hotspots: [],
    discoveryState: 'visit',
    pinEligible: true,
  },
  'transit-hub': {
    id: 'transit-hub',
    name: 'Transit Hub',
    kind: 'zone',
    parentId: 'new-harbor',
    description: 'The rail station and city connections. Regional travel is not available yet.',
    childLocationIds: [],
    hotspots: [],
    discoveryState: 'visit',
    pinEligible: true,
  },
  outskirts: {
    id: 'outskirts',
    name: 'Outskirts',
    kind: 'zone',
    parentId: 'new-harbor',
    description: 'The edge of New Harbor. Exploration beyond the city is not available yet.',
    childLocationIds: [],
    hotspots: [],
    discoveryState: 'visit',
    pinEligible: true,
  },
  'fishing-pier': place(
    'fishing-pier',
    'Fishing Pier',
    'A practical pier prepared for future fishing activity.',
    'harbor',
  ),
  'boat-market': place(
    'boat-market',
    'Boat Market',
    'Dockside sellers and small craft listings.',
    'harbor',
  ),
  'freight-terminal': place(
    'freight-terminal',
    'Freight Terminal',
    'Cargo moving through the harbor.',
    'harbor',
  ),
  'fishing-store': place(
    'fishing-store',
    'Fishing Store',
    'Supplies for time on the water.',
    'harbor',
  ),
  'harbor-contracts-office': place(
    'harbor-contracts-office',
    'Harbor Contracts Office',
    'Work notices and port administration.',
    'harbor',
  ),
  'market-square': place(
    'market-square',
    'Market Square',
    'The center of New Harbor’s daily trade.',
    'market-district',
  ),
  'traders-row': place(
    'traders-row',
    'Traders’ Row',
    'Permanent storefronts along a busy lane.',
    'market-district',
  ),
  refinery: place(
    'refinery',
    'Refinery',
    'Industrial processing infrastructure.',
    'industrial-district',
  ),
  workshops: place(
    'workshops',
    'Workshops',
    'Independent makers and repair bays.',
    'industrial-district',
  ),
  'warehouse-yard': place(
    'warehouse-yard',
    'Warehouse Yard',
    'Storage buildings and loading space.',
    'industrial-district',
  ),
  'civic-hall': place(
    'civic-hall',
    'Civic Hall',
    'City services and public notices.',
    'city-centre',
  ),
  'newcomer-housing': place(
    'newcomer-housing',
    'Newcomer Housing',
    'A practical first home for recent arrivals.',
    'civic-residential',
  ),
};

function place(
  id: string,
  name: string,
  description: string,
  parentId: string,
): LocationDefinition {
  return {
    id,
    name,
    description,
    kind: 'place',
    parentId,
    childLocationIds: [],
    hotspots: [],
    discoveryState: 'visit',
    pinEligible: true,
  };
}

export function locationDefinition(id: string): LocationDefinition | null {
  return locationDefinitions[id] ?? null;
}
export function allLocationDefinitions(): LocationDefinition[] {
  return Object.values(locationDefinitions);
}
export function canonicalLocationId(value: string): string {
  return value === 'New Harbor' ? 'new-harbor' : value;
}
export function locationDisplayName(value: string): string {
  const definition = locationDefinition(canonicalLocationId(value));
  return definition?.name ?? value;
}
export function isCityLocation(id: string): boolean {
  let current = locationDefinition(id);
  while (current) {
    if (current.id === 'new-harbor') return true;
    current = current.parentId ? locationDefinition(current.parentId) : null;
  }
  return false;
}
export function canNavigateNormally(fromId: string, toId: string): boolean {
  const from = locationDefinition(fromId);
  const to = locationDefinition(toId);
  if (!from || !to || !isCityLocation(toId)) return false;
  return from.childLocationIds.includes(toId) || from.parentId === toId;
}
function characterId(database: DatabaseSync, accountId: string): string | null {
  const row = database.prepare('SELECT id FROM characters WHERE account_id = ?').get(accountId) as
    { id: string } | undefined;
  return row?.id ?? null;
}
export function seedStarterLocations(database: DatabaseSync, accountId: string): void {
  const id = characterId(database, accountId);
  if (!id) throw new Error('Cannot seed locations without a character.');
  database
    .prepare(
      'INSERT OR IGNORE INTO character_discovered_locations (character_id, location_id, discovered_at) VALUES (?, ?, ?)',
    )
    .run(id, 'new-harbor', new Date().toISOString());
}
export interface LocationState {
  currentLocationId: string;
  locations: LocationDefinition[];
  discoveredLocationIds: string[];
  pinnedLocationIds: string[];
}
export function getLocationState(database: DatabaseSync, accountId: string): LocationState | null {
  const id = characterId(database, accountId);
  if (!id) return null;
  const current = database
    .prepare('SELECT current_location FROM characters WHERE id = ?')
    .get(id) as { current_location: string } | undefined;
  if (!current) return null;
  const discovered = database
    .prepare(
      'SELECT location_id FROM character_discovered_locations WHERE character_id = ? ORDER BY discovered_at, location_id',
    )
    .all(id) as unknown as Array<{ location_id: string }>;
  const pinned = database
    .prepare(
      'SELECT location_id FROM character_pinned_locations WHERE character_id = ? ORDER BY pinned_at, location_id',
    )
    .all(id) as unknown as Array<{ location_id: string }>;
  return {
    currentLocationId: canonicalLocationId(current.current_location),
    locations: allLocationDefinitions(),
    discoveredLocationIds: discovered.map((row) => row.location_id),
    pinnedLocationIds: pinned.map((row) => row.location_id),
  };
}
export type LocationResult = { state: LocationState } | { error: string; message: string };
function updateCurrentLocation(database: DatabaseSync, id: string, locationId: string): void {
  database
    .prepare('UPDATE characters SET current_location = ?, updated_at = ? WHERE id = ?')
    .run(locationId, new Date().toISOString(), id);
}
function discover(database: DatabaseSync, id: string, locationId: string): void {
  database
    .prepare(
      'INSERT OR IGNORE INTO character_discovered_locations (character_id, location_id, discovered_at) VALUES (?, ?, ?)',
    )
    .run(id, locationId, new Date().toISOString());
}
export function navigateLocation(
  database: DatabaseSync,
  accountId: string,
  targetId: unknown,
  quick = false,
): LocationResult {
  if (typeof targetId !== 'string')
    return { error: 'VALIDATION_ERROR', message: 'Provide a location id.' };
  const target = locationDefinition(targetId);
  const id = characterId(database, accountId);
  const state = getLocationState(database, accountId);
  if (!target || !id || !state || !isCityLocation(targetId))
    return { error: 'LOCATION_NOT_FOUND', message: 'That location is not available.' };
  if (targetId === state.currentLocationId)
    return { error: 'ALREADY_THERE', message: 'You are already at that location.' };
  const allowed = quick
    ? state.discoveredLocationIds.includes(targetId)
    : canNavigateNormally(state.currentLocationId, targetId);
  if (!allowed)
    return {
      error: 'LOCATION_NOT_REACHABLE',
      message: quick
        ? 'Discover that location before using quick navigation.'
        : 'Use a connected city route to reach that location.',
    };
  database.exec('BEGIN');
  try {
    if (state.currentLocationId === 'fishing-pier') stopFishingForDeparture(database, id);
    discover(database, id, targetId);
    updateCurrentLocation(database, id, targetId);
    database.exec('COMMIT');
    return { state: getLocationState(database, accountId)! };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
export function setLocationPin(
  database: DatabaseSync,
  accountId: string,
  targetId: unknown,
  pinned: unknown,
): LocationResult {
  if (typeof targetId !== 'string' || typeof pinned !== 'boolean')
    return { error: 'VALIDATION_ERROR', message: 'Provide a location id and pin state.' };
  const id = characterId(database, accountId);
  const state = getLocationState(database, accountId);
  const target = locationDefinition(targetId);
  if (!id || !state || !target)
    return { error: 'LOCATION_NOT_FOUND', message: 'That location is not available.' };
  if (!target.pinEligible)
    return { error: 'LOCATION_NOT_PINNABLE', message: 'This location cannot be pinned.' };
  if (!state.discoveredLocationIds.includes(targetId))
    return { error: 'LOCATION_NOT_DISCOVERED', message: 'Enter this location before pinning it.' };
  database.exec('BEGIN IMMEDIATE');
  try {
    if (pinned) {
      const alreadyPinned = database
        .prepare(
          'SELECT 1 FROM character_pinned_locations WHERE character_id = ? AND location_id = ?',
        )
        .get(id, targetId);
      const count = database
        .prepare('SELECT count(*) AS count FROM character_pinned_locations WHERE character_id = ?')
        .get(id) as { count: number };
      if (!alreadyPinned && count.count >= MAX_PINNED_LOCATIONS) {
        database.exec('ROLLBACK');
        return {
          error: 'PIN_LIMIT_REACHED',
          message: '5 locations pinned. Unpin one to add another.',
        };
      }
      database
        .prepare(
          'INSERT OR IGNORE INTO character_pinned_locations (character_id, location_id, pinned_at) VALUES (?, ?, ?)',
        )
        .run(id, targetId, new Date().toISOString());
    } else {
      database
        .prepare(
          'DELETE FROM character_pinned_locations WHERE character_id = ? AND location_id = ?',
        )
        .run(id, targetId);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return { state: getLocationState(database, accountId)! };
}
