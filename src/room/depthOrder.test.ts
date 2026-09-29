import { expect, it } from 'vitest';
import { depthOrder } from './depthOrder';

it('draws a long rear footprint before an adjacent foreground object', () => {
  const items = [
    {
      placement: { itemId: 'front', x: 2, y: 0, rotation: 0 as const },
      size: { width: 1, depth: 1 },
    },
    {
      placement: { itemId: 'long', x: 0, y: 0, rotation: 0 as const },
      size: { width: 2, depth: 1 },
    },
  ];
  expect(depthOrder(items)).toEqual(['long', 'front']);
});
