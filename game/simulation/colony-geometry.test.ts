import { describe, expect, it } from 'vitest';

import { getRectConnectionPoint } from '@/game/simulation/colony-geometry';

describe('getRectConnectionPoint', () => {
  it('returns the right edge when the target is directly right', () => {
    expect(
      getRectConnectionPoint(
        {
          center: { x: 10, y: 10 },
          size: { width: 6, height: 4 },
        },
        {
          center: { x: 20, y: 10 },
          size: { width: 4, height: 4 },
        },
      ),
    ).toEqual({ x: 13, y: 10 });
  });

  it('returns the bottom edge when the target is directly below', () => {
    expect(
      getRectConnectionPoint(
        {
          center: { x: 10, y: 10 },
          size: { width: 6, height: 4 },
        },
        {
          center: { x: 10, y: 20 },
          size: { width: 4, height: 4 },
        },
      ),
    ).toEqual({ x: 10, y: 12 });
  });

  it('returns a proportional edge point for diagonal targets', () => {
    expect(
      getRectConnectionPoint(
        {
          center: { x: 10, y: 10 },
          size: { width: 8, height: 4 },
        },
        {
          center: { x: 18, y: 14 },
          size: { width: 4, height: 4 },
        },
      ),
    ).toEqual({ x: 14, y: 12 });
  });

  it('returns the center when both rectangles share the same center', () => {
    expect(
      getRectConnectionPoint(
        {
          center: { x: 10, y: 10 },
          size: { width: 8, height: 4 },
        },
        {
          center: { x: 10, y: 10 },
          size: { width: 4, height: 4 },
        },
      ),
    ).toEqual({ x: 10, y: 10 });
  });
});
