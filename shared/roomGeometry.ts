export type Rotation = 0 | 90 | 180 | 270;
export type Placement = { itemId: string; x: number; y: number; rotation: Rotation };
export type Footprint = { width: number; depth: number };
export type RoomSize = { width: number; depth: number };
export type PlacementProblem = 'OUT_OF_BOUNDS' | 'SPACE_OCCUPIED' | 'VALIDATION_ERROR';

export function isRotation(value: unknown): value is Rotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

export function rotatedFootprint(size: Footprint, rotation: Rotation): Footprint {
  return rotation === 90 || rotation === 270 ? { width: size.depth, depth: size.width } : size;
}

export function occupiedCells(placement: Placement, size: Footprint): Array<[number, number]> {
  const rotated = rotatedFootprint(size, placement.rotation);
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < rotated.depth; y++)
    for (let x = 0; x < rotated.width; x++) cells.push([placement.x + x, placement.y + y]);
  return cells;
}

export function validatePlacement(
  room: RoomSize,
  placement: Placement,
  size: Footprint,
  existing: Array<{ placement: Placement; size: Footprint }>,
  movingItemId?: string,
): PlacementProblem | null {
  if (
    !Number.isSafeInteger(room.width) ||
    !Number.isSafeInteger(room.depth) ||
    room.width < 1 ||
    room.depth < 1 ||
    room.width > 64 ||
    room.depth > 64 ||
    !Number.isSafeInteger(size.width) ||
    !Number.isSafeInteger(size.depth) ||
    size.width < 1 ||
    size.depth < 1 ||
    size.width > 16 ||
    size.depth > 16 ||
    !Number.isSafeInteger(placement.x) ||
    !Number.isSafeInteger(placement.y) ||
    !isRotation(placement.rotation)
  )
    return 'VALIDATION_ERROR';
  const candidate = occupiedCells(placement, size);
  if (candidate.some(([x, y]) => x < 0 || y < 0 || x >= room.width || y >= room.depth))
    return 'OUT_OF_BOUNDS';
  const occupied = new Set<string>();
  for (const entry of existing) {
    if (entry.placement.itemId === movingItemId) continue;
    for (const [x, y] of occupiedCells(entry.placement, entry.size)) occupied.add(`${x},${y}`);
  }
  return candidate.some(([x, y]) => occupied.has(`${x},${y}`)) ? 'SPACE_OCCUPIED' : null;
}
