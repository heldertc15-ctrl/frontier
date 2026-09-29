import { expect, it } from 'vitest';
import { fitRoom, project, unproject } from './roomProjection';

it('keeps cell centers aligned through projection and inverse at different sizes', () => {
  for (const [w, h] of [
    [1000, 700],
    [320, 400],
    [1440, 900],
  ]) {
    const p = fitRoom({ width: 8, depth: 8 }, w, h);
    for (const [x, y] of [
      [0, 0],
      [7, 7],
      [3, 2],
    ]) {
      const pixel = project(x + 0.5, y + 0.5, p);
      expect(unproject(pixel.x, pixel.y, p)).toEqual({ x, y });
    }
  }
});
