import { describe, expect, it } from 'vitest';
import { occupiedCells, rotatedFootprint, validatePlacement } from './roomGeometry';

describe('room geometry', () => {
  it('rotates a rectangular footprint and returns to origin after four turns', () => {
    const size = { width: 2, depth: 1 };
    expect(rotatedFootprint(size, 90)).toEqual({ width: 1, depth: 2 });
    expect(occupiedCells({ itemId: 'a', x: 3, y: 2, rotation: 90 }, size)).toEqual([
      [3, 2],
      [3, 3],
    ]);
    expect(rotatedFootprint(size, 270)).toEqual({ width: 1, depth: 2 });
    expect(rotatedFootprint(size, 0)).toEqual(size);
  });
  it('allows edge contact and excludes only the moving instance', () => {
    const size = { width: 2, depth: 1 };
    const original = { placement: { itemId: 'a', x: 0, y: 0, rotation: 0 as const }, size };
    expect(
      validatePlacement({ width: 4, depth: 4 }, { itemId: 'b', x: 2, y: 0, rotation: 0 }, size, [
        original,
      ]),
    ).toBeNull();
    expect(
      validatePlacement({ width: 4, depth: 4 }, { itemId: 'b', x: 1, y: 0, rotation: 0 }, size, [
        original,
      ]),
    ).toBe('SPACE_OCCUPIED');
    expect(
      validatePlacement(
        { width: 4, depth: 4 },
        { itemId: 'a', x: 1, y: 0, rotation: 0 },
        size,
        [original],
        'a',
      ),
    ).toBeNull();
  });
  it('rejects every out-of-bounds and malformed coordinate', () => {
    const room = { width: 4, depth: 4 },
      size = { width: 2, depth: 1 };
    for (const [x, y] of [
      [-1, 0],
      [0, -1],
      [3, 0],
      [0, 4],
    ])
      expect(validatePlacement(room, { itemId: 'a', x, y, rotation: 0 }, size, [])).toBe(
        'OUT_OF_BOUNDS',
      );
    for (const x of [0.5, Number.MAX_SAFE_INTEGER + 1])
      expect(validatePlacement(room, { itemId: 'a', x, y: 0, rotation: 0 }, size, [])).toBe(
        'VALIDATION_ERROR',
      );
    expect(validatePlacement(room, { itemId: 'a', x: 3, y: 0, rotation: 90 }, size, [])).toBeNull();
  });
});
