import type { GridPosition } from './colony-layout';

export interface GeometryRect {
  readonly center: GridPosition;
  readonly size: {
    readonly height: number;
    readonly width: number;
  };
}

export const getRectConnectionPoint = (
  fromRect: GeometryRect,
  toRect: GeometryRect,
): GridPosition => {
  const deltaX = toRect.center.x - fromRect.center.x;
  const deltaY = toRect.center.y - fromRect.center.y;

  if (deltaX === 0 && deltaY === 0) {
    return fromRect.center;
  }

  const horizontalReach =
    deltaX === 0
      ? Number.POSITIVE_INFINITY
      : fromRect.size.width / 2 / Math.abs(deltaX);
  const verticalReach =
    deltaY === 0
      ? Number.POSITIVE_INFINITY
      : fromRect.size.height / 2 / Math.abs(deltaY);
  const reach = Math.min(horizontalReach, verticalReach);

  return {
    x: fromRect.center.x + deltaX * reach,
    y: fromRect.center.y + deltaY * reach,
  };
};
