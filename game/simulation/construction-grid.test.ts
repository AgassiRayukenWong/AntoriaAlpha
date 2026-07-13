import { describe, expect, it } from 'vitest';

import {
  GridDirection,
  areAdjacentPositions,
  areGalleryPiecesConnected,
  createConstructionGrid,
  getDirectionBetweenAdjacentPositions,
  getGalleryPieceOccupiedPositions,
  getOppositeDirection,
  isGalleryPieceIdUsed,
  isGridPositionOccupied,
  isGalleryNetworkConnected,
  isGalleryNetworkConnectedToConduit,
  isPositionInsideGrid,
  placeGalleryPiece,
  removeGalleryPiece,
  type GalleryPiece,
} from '@/game/simulation/construction-grid';

const createPiece = (
  id: string,
  column: number,
  row: number,
  connections: readonly GridDirection[],
  size = { columns: 1, rows: 1 },
): GalleryPiece => ({
  id,
  position: { column, row },
  size,
  connections,
});

describe('construction grid', () => {
  it('creates a grid with copied pieces', () => {
    const pieces = [createPiece('piece-1', 1, 1, [GridDirection.Right])];

    const grid = createConstructionGrid(
      {
        columns: 4,
        rows: 3,
      },
      pieces,
    );

    pieces.push(createPiece('piece-2', 2, 1, [GridDirection.Left]));

    expect(grid).toEqual({
      size: { columns: 4, rows: 3 },
      pieces: [
        {
          id: 'piece-1',
          position: { column: 1, row: 1 },
          size: { columns: 1, rows: 1 },
          connections: [GridDirection.Right],
        },
      ],
    });
  });

  it('rejects invalid grid sizes', () => {
    expect(() => createConstructionGrid({ columns: 0, rows: 3 })).toThrow(
      RangeError,
    );
    expect(() => createConstructionGrid({ columns: 4.5, rows: 3 })).toThrow(
      RangeError,
    );
  });

  it('detects whether a position is inside the grid', () => {
    const size = { columns: 4, rows: 3 };

    expect(isPositionInsideGrid(size, { column: 0, row: 0 })).toBe(true);
    expect(isPositionInsideGrid(size, { column: 3, row: 2 })).toBe(true);
    expect(isPositionInsideGrid(size, { column: 4, row: 2 })).toBe(false);
    expect(isPositionInsideGrid(size, { column: 3, row: -1 })).toBe(false);
  });

  it('rejects gallery pieces outside the grid', () => {
    expect(() =>
      createConstructionGrid({ columns: 4, rows: 3 }, [
        createPiece('piece-1', 4, 1, [GridDirection.Left]),
      ]),
    ).toThrow(RangeError);
  });

  it('rejects duplicated piece ids in initial grids', () => {
    expect(() =>
      createConstructionGrid({ columns: 4, rows: 3 }, [
        createPiece('piece-1', 0, 0, [GridDirection.Right]),
        createPiece('piece-1', 1, 0, [GridDirection.Left]),
      ]),
    ).toThrow(RangeError);
  });

  it('places a gallery piece into a new grid instance', () => {
    const grid = createConstructionGrid({ columns: 4, rows: 3 });
    const piece = createPiece('piece-1', 1, 1, [GridDirection.Right]);

    const nextGrid = placeGalleryPiece(grid, piece);

    expect(grid.pieces).toEqual([]);
    expect(nextGrid.pieces).toEqual([piece]);
  });

  it('detects occupied grid positions', () => {
    const piece = createPiece('piece-1', 1, 1, [GridDirection.Right], {
      columns: 2,
      rows: 2,
    });
    const grid = createConstructionGrid({ columns: 4, rows: 3 }, [piece]);

    expect(isGridPositionOccupied(grid, { column: 1, row: 1 })).toBe(true);
    expect(isGridPositionOccupied(grid, { column: 2, row: 1 })).toBe(true);
    expect(isGridPositionOccupied(grid, { column: 2, row: 2 })).toBe(true);
    expect(isGridPositionOccupied(grid, { column: 3, row: 1 })).toBe(false);
  });

  it('detects used gallery piece ids', () => {
    const piece = createPiece('piece-1', 1, 1, [GridDirection.Right]);
    const grid = createConstructionGrid({ columns: 4, rows: 3 }, [piece]);

    expect(isGalleryPieceIdUsed(grid, 'piece-1')).toBe(true);
    expect(isGalleryPieceIdUsed(grid, 'piece-2')).toBe(false);
  });

  it('returns every occupied position for multi-cell pieces', () => {
    expect(
      getGalleryPieceOccupiedPositions(
        createPiece('room-1', 1, 1, [GridDirection.Right], {
          columns: 2,
          rows: 2,
        }),
      ),
    ).toEqual([
      { column: 1, row: 1 },
      { column: 1, row: 2 },
      { column: 2, row: 1 },
      { column: 2, row: 2 },
    ]);
  });

  it('rejects placement on occupied positions', () => {
    const piece = createPiece('piece-1', 1, 1, [GridDirection.Right], {
      columns: 2,
      rows: 2,
    });
    const grid = createConstructionGrid({ columns: 4, rows: 3 }, [piece]);

    expect(() =>
      placeGalleryPiece(
        grid,
        createPiece('piece-2', 2, 2, [GridDirection.Left]),
      ),
    ).toThrow(RangeError);
  });

  it('rejects placement with an already used piece id', () => {
    const piece = createPiece('piece-1', 1, 1, [GridDirection.Right]);
    const grid = createConstructionGrid({ columns: 4, rows: 3 }, [piece]);

    expect(() =>
      placeGalleryPiece(
        grid,
        createPiece('piece-1', 2, 1, [GridDirection.Left]),
      ),
    ).toThrow(RangeError);
  });

  it('rejects placement outside the grid', () => {
    const grid = createConstructionGrid({ columns: 4, rows: 3 });

    expect(() =>
      placeGalleryPiece(
        grid,
        createPiece('piece-1', 3, 1, [GridDirection.Left], {
          columns: 2,
          rows: 1,
        }),
      ),
    ).toThrow(RangeError);
  });

  it('removes a gallery piece from a new grid instance', () => {
    const firstPiece = createPiece('piece-1', 1, 1, [GridDirection.Right]);
    const secondPiece = createPiece('piece-2', 2, 1, [GridDirection.Left]);
    const grid = createConstructionGrid({ columns: 4, rows: 3 }, [
      firstPiece,
      secondPiece,
    ]);

    const nextGrid = removeGalleryPiece(grid, 'piece-1');

    expect(grid.pieces).toEqual([firstPiece, secondPiece]);
    expect(nextGrid.pieces).toEqual([secondPiece]);
  });

  it('frees occupied positions when removing a gallery piece', () => {
    const room = createPiece('room-1', 1, 1, [GridDirection.Right], {
      columns: 2,
      rows: 2,
    });
    const grid = createConstructionGrid({ columns: 4, rows: 3 }, [room]);

    const nextGrid = removeGalleryPiece(grid, 'room-1');

    expect(isGridPositionOccupied(nextGrid, { column: 1, row: 1 })).toBe(false);
    expect(isGridPositionOccupied(nextGrid, { column: 2, row: 2 })).toBe(false);
  });

  it('rejects removal of an unknown gallery piece id', () => {
    const grid = createConstructionGrid({ columns: 4, rows: 3 });

    expect(() => removeGalleryPiece(grid, 'missing-piece')).toThrow(RangeError);
  });

  it('detects adjacent positions', () => {
    expect(
      areAdjacentPositions({ column: 1, row: 1 }, { column: 2, row: 1 }),
    ).toBe(true);
    expect(
      areAdjacentPositions({ column: 1, row: 1 }, { column: 2, row: 2 }),
    ).toBe(false);
  });

  it('finds directions between adjacent positions', () => {
    expect(
      getDirectionBetweenAdjacentPositions(
        { column: 1, row: 1 },
        { column: 2, row: 1 },
      ),
    ).toBe(GridDirection.Right);
    expect(
      getDirectionBetweenAdjacentPositions(
        { column: 1, row: 1 },
        { column: 1, row: 0 },
      ),
    ).toBe(GridDirection.Up);
    expect(() =>
      getDirectionBetweenAdjacentPositions(
        { column: 1, row: 1 },
        { column: 2, row: 2 },
      ),
    ).toThrow(RangeError);
  });

  it('returns opposite directions', () => {
    expect(getOppositeDirection(GridDirection.Up)).toBe(GridDirection.Down);
    expect(getOppositeDirection(GridDirection.Right)).toBe(GridDirection.Left);
  });

  it('connects gallery pieces only when adjacent edges are compatible', () => {
    const firstPiece = createPiece('first', 1, 1, [GridDirection.Right]);
    const connectedPiece = createPiece('second', 2, 1, [GridDirection.Left]);
    const incompatiblePiece = createPiece('third', 2, 1, [GridDirection.Right]);
    const distantPiece = createPiece('fourth', 3, 1, [GridDirection.Left]);

    expect(areGalleryPiecesConnected(firstPiece, connectedPiece)).toBe(true);
    expect(areGalleryPiecesConnected(firstPiece, incompatiblePiece)).toBe(
      false,
    );
    expect(areGalleryPiecesConnected(firstPiece, distantPiece)).toBe(false);
  });

  it('connects multi-cell gallery pieces through their occupied edges', () => {
    const room = createPiece('room', 1, 1, [GridDirection.Right], {
      columns: 2,
      rows: 2,
    });
    const corridor = createPiece('corridor', 3, 2, [GridDirection.Left]);

    expect(areGalleryPiecesConnected(room, corridor)).toBe(true);
  });

  it('validates a fully connected gallery network', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 0, 1, [GridDirection.Right]),
      createPiece('middle', 1, 1, [GridDirection.Left, GridDirection.Right]),
      createPiece('room', 2, 1, [GridDirection.Left]),
    ]);

    expect(isGalleryNetworkConnected(grid, 'entrance')).toBe(true);
  });

  it('rejects a gallery network with an isolated piece', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 0, 1, [GridDirection.Right]),
      createPiece('middle', 1, 1, [GridDirection.Left]),
      createPiece('isolated', 4, 1, [GridDirection.Left]),
    ]);

    expect(isGalleryNetworkConnected(grid, 'entrance')).toBe(false);
  });

  it('rejects a gallery network with incompatible adjacent connections', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 0, 1, [GridDirection.Right]),
      createPiece('blocked', 1, 1, [GridDirection.Right]),
    ]);

    expect(isGalleryNetworkConnected(grid, 'entrance')).toBe(false);
  });

  it('validates a gallery network containing one piece', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 0, 1, [GridDirection.Right]),
    ]);

    expect(isGalleryNetworkConnected(grid, 'entrance')).toBe(true);
  });

  it('rejects gallery network validation from an unknown piece id', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 });

    expect(() => isGalleryNetworkConnected(grid, 'missing-piece')).toThrow(
      RangeError,
    );
  });

  it('validates a gallery network connected to a conduit', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 1, 1, [GridDirection.Left, GridDirection.Right]),
      createPiece('room', 2, 1, [GridDirection.Left]),
    ]);

    expect(
      isGalleryNetworkConnectedToConduit(grid, {
        position: { column: 0, row: 1 },
        direction: GridDirection.Right,
      }),
    ).toBe(true);
  });

  it('validates a gallery network connected to a right outside conduit', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 4, 1, [GridDirection.Right]),
    ]);

    expect(
      isGalleryNetworkConnectedToConduit(grid, {
        position: { column: 5, row: 1 },
        direction: GridDirection.Left,
      }),
    ).toBe(true);
  });

  it('validates a multi-cell gallery network connected to a conduit', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('room', 1, 0, [GridDirection.Left], {
        columns: 2,
        rows: 2,
      }),
    ]);

    expect(
      isGalleryNetworkConnectedToConduit(grid, {
        position: { column: 0, row: 1 },
        direction: GridDirection.Right,
      }),
    ).toBe(true);
  });

  it('rejects a gallery network without conduit contact', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 2, 1, [GridDirection.Left]),
    ]);

    expect(
      isGalleryNetworkConnectedToConduit(grid, {
        position: { column: 0, row: 1 },
        direction: GridDirection.Right,
      }),
    ).toBe(false);
  });

  it('rejects a gallery network with an incompatible conduit direction', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 1, 1, [GridDirection.Right]),
    ]);

    expect(
      isGalleryNetworkConnectedToConduit(grid, {
        position: { column: 0, row: 1 },
        direction: GridDirection.Right,
      }),
    ).toBe(false);
  });

  it('rejects a conduit-connected gallery network with an isolated piece', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 1, 1, [GridDirection.Left]),
      createPiece('isolated', 4, 1, [GridDirection.Left]),
    ]);

    expect(
      isGalleryNetworkConnectedToConduit(grid, {
        position: { column: 0, row: 1 },
        direction: GridDirection.Right,
      }),
    ).toBe(false);
  });

  it('rejects an empty gallery network connected to a conduit', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 });

    expect(
      isGalleryNetworkConnectedToConduit(grid, {
        position: { column: 0, row: 1 },
        direction: GridDirection.Right,
      }),
    ).toBe(false);
  });
});
