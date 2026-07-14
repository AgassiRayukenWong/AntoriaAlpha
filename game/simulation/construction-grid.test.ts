import { describe, expect, it } from 'vitest';

import {
  GridDirection,
  areAdjacentPositions,
  areGalleryPiecesAdjacent,
  areGalleryPiecesConnected,
  canRemoveGalleryPieceWithoutDisconnectingNetwork,
  canPlaceGalleryPieceNextToNetwork,
  countGalleryPieceEntrances,
  createConstructionGrid,
  getConduitConnectedPieceIds,
  getDirectionBetweenAdjacentPositions,
  getGalleryNetworkPieceIds,
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
  entranceLimit?: number,
): GalleryPiece => ({
  id,
  ...(entranceLimit === undefined ? {} : { entranceLimit }),
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

  it('allows placing a gallery piece next to the conduit', () => {
    const grid = createConstructionGrid({ columns: 4, rows: 3 });

    expect(
      canPlaceGalleryPieceNextToNetwork(
        grid,
        createPiece('entrance', 1, 0, [GridDirection.Up]),
        {
          position: { column: 1, row: -1 },
          direction: GridDirection.Down,
        },
      ),
    ).toBe(true);
  });

  it('allows placing a gallery piece next to the existing network', () => {
    const grid = createConstructionGrid({ columns: 4, rows: 3 }, [
      createPiece('entrance', 1, 0, [GridDirection.Up, GridDirection.Right]),
    ]);

    expect(
      canPlaceGalleryPieceNextToNetwork(
        grid,
        createPiece('corridor', 2, 0, [GridDirection.Left]),
        {
          position: { column: 1, row: -1 },
          direction: GridDirection.Down,
        },
      ),
    ).toBe(true);
  });

  it('rejects placing an isolated gallery piece away from the network', () => {
    const grid = createConstructionGrid({ columns: 4, rows: 3 }, [
      createPiece('entrance', 1, 0, [GridDirection.Up]),
    ]);

    expect(
      canPlaceGalleryPieceNextToNetwork(
        grid,
        createPiece('isolated', 3, 2, [GridDirection.Left]),
        {
          position: { column: 1, row: -1 },
          direction: GridDirection.Down,
        },
      ),
    ).toBe(false);
  });

  it('rejects placing a gallery piece next to a disconnected piece', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 1, 0, [GridDirection.Up]),
      createPiece('isolated', 3, 1, [GridDirection.Right]),
    ]);

    expect(
      canPlaceGalleryPieceNextToNetwork(
        grid,
        createPiece('isolated-extension', 4, 1, [GridDirection.Left]),
        {
          position: { column: 1, row: -1 },
          direction: GridDirection.Down,
        },
      ),
    ).toBe(false);
  });

  it('allows placing a gallery piece next to the conduit network when another piece is disconnected', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 1, 0, [GridDirection.Up, GridDirection.Right]),
      createPiece('isolated', 4, 2, [GridDirection.Left]),
    ]);

    expect(
      canPlaceGalleryPieceNextToNetwork(
        grid,
        createPiece('corridor', 2, 0, [GridDirection.Left]),
        {
          position: { column: 1, row: -1 },
          direction: GridDirection.Down,
        },
      ),
    ).toBe(true);
  });

  it('allows placing a vertical gallery from a connected horizontal gallery', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 1, 1, [
        GridDirection.Up,
        GridDirection.Right,
      ]),
      createPiece('horizontal', 2, 1, [
        GridDirection.Left,
        GridDirection.Right,
      ]),
    ]);

    expect(
      canPlaceGalleryPieceNextToNetwork(
        grid,
        createPiece('vertical-extension', 2, 0, [GridDirection.Down]),
        {
          position: { column: 1, row: 0 },
          direction: GridDirection.Down,
        },
      ),
    ).toBe(true);
  });

  it('allows placing a gallery piece next to a room connected to the conduit network', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 2, 0, [GridDirection.Up, GridDirection.Down]),
      createPiece('room', 1, 1, [GridDirection.Right], {
        columns: 2,
        rows: 2,
      }),
    ]);

    expect(
      canPlaceGalleryPieceNextToNetwork(
        grid,
        createPiece('corridor', 1, 0, [GridDirection.Right]),
        {
          position: { column: 2, row: -1 },
          direction: GridDirection.Down,
        },
      ),
    ).toBe(true);
  });

  it('counts every adjacent cell as one room entrance', () => {
    const room = createPiece(
      'room',
      1,
      1,
      [GridDirection.Up, GridDirection.Right, GridDirection.Down],
      {
        columns: 2,
        rows: 2,
      },
      4,
    );
    const grid = createConstructionGrid({ columns: 5, rows: 4 }, [
      room,
      createPiece('top-left', 1, 0, [GridDirection.Down]),
      createPiece('top-right', 2, 0, [GridDirection.Down]),
      createPiece('right', 3, 1, [GridDirection.Left]),
    ]);

    expect(countGalleryPieceEntrances(grid, room)).toBe(3);
  });

  it('allows placing a gallery piece when a room reaches its entrance limit', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 4 }, [
      createPiece('entrance', 1, 0, [GridDirection.Up, GridDirection.Down]),
      createPiece(
        'room',
        1,
        1,
        [GridDirection.Up, GridDirection.Right, GridDirection.Down],
        {
          columns: 2,
          rows: 2,
        },
        4,
      ),
      createPiece('top-right', 2, 0, [GridDirection.Down]),
      createPiece('right', 3, 1, [GridDirection.Left]),
    ]);

    expect(
      canPlaceGalleryPieceNextToNetwork(
        grid,
        createPiece('bottom', 1, 3, [GridDirection.Up]),
        {
          position: { column: 1, row: -1 },
          direction: GridDirection.Down,
        },
      ),
    ).toBe(true);
  });

  it('rejects placing a gallery piece when a room would exceed its entrance limit', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 4 }, [
      createPiece('entrance', 1, 0, [GridDirection.Up, GridDirection.Down]),
      createPiece(
        'room',
        1,
        1,
        [
          GridDirection.Up,
          GridDirection.Right,
          GridDirection.Down,
          GridDirection.Left,
        ],
        {
          columns: 2,
          rows: 2,
        },
        4,
      ),
      createPiece('top-right', 2, 0, [GridDirection.Down]),
      createPiece('right', 3, 1, [GridDirection.Left]),
      createPiece('bottom', 1, 3, [GridDirection.Up]),
    ]);

    expect(
      canPlaceGalleryPieceNextToNetwork(
        grid,
        createPiece('left', 0, 1, [GridDirection.Right]),
        {
          position: { column: 1, row: -1 },
          direction: GridDirection.Down,
        },
      ),
    ).toBe(false);
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

  it('allows removing a gallery piece that does not disconnect the conduit network', () => {
    const grid = createConstructionGrid({ columns: 4, rows: 3 }, [
      createPiece('entrance', 1, 0, [
        GridDirection.Up,
        GridDirection.Right,
      ]),
      createPiece('leaf', 2, 0, [GridDirection.Left]),
    ]);

    expect(
      canRemoveGalleryPieceWithoutDisconnectingNetwork(grid, 'leaf', {
        position: { column: 1, row: -1 },
        direction: GridDirection.Down,
      }),
    ).toBe(true);
  });

  it('rejects removing a gallery piece that disconnects the conduit network', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 1, 0, [
        GridDirection.Up,
        GridDirection.Right,
      ]),
      createPiece('bridge', 2, 0, [
        GridDirection.Left,
        GridDirection.Right,
      ]),
      createPiece('leaf', 3, 0, [GridDirection.Left]),
    ]);

    expect(
      canRemoveGalleryPieceWithoutDisconnectingNetwork(grid, 'bridge', {
        position: { column: 1, row: -1 },
        direction: GridDirection.Down,
      }),
    ).toBe(false);
  });

  it('rejects safe removal checks for unknown gallery pieces', () => {
    const grid = createConstructionGrid({ columns: 4, rows: 3 });

    expect(
      canRemoveGalleryPieceWithoutDisconnectingNetwork(grid, 'missing-piece', {
        position: { column: 1, row: -1 },
        direction: GridDirection.Down,
      }),
    ).toBe(false);
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

  it('detects adjacent room and gallery pieces even when their directed edges differ', () => {
    const room = createPiece('room', 1, 1, [GridDirection.Right], {
      columns: 2,
      rows: 2,
    });
    const corridor = createPiece('corridor', 2, 0, [GridDirection.Left]);

    expect(areGalleryPiecesConnected(room, corridor)).toBe(false);
    expect(areGalleryPiecesAdjacent(room, corridor)).toBe(true);
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

  it('returns the network connected to a specific gallery piece', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('queen', 1, 1, [GridDirection.Right]),
      createPiece('connected', 2, 1, [GridDirection.Left]),
      createPiece('isolated', 4, 1, [GridDirection.Left]),
    ]);

    expect(getGalleryNetworkPieceIds(grid, 'queen')).toEqual(
      new Set(['queen', 'connected']),
    );
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

  it('returns the gallery pieces connected to a conduit', () => {
    const grid = createConstructionGrid({ columns: 5, rows: 3 }, [
      createPiece('entrance', 1, 1, [GridDirection.Left, GridDirection.Right]),
      createPiece('connected-room', 2, 1, [GridDirection.Left], {
        columns: 2,
        rows: 2,
      }),
      createPiece('isolated', 4, 0, [GridDirection.Left]),
    ]);

    expect(
      getConduitConnectedPieceIds(grid, {
        position: { column: 0, row: 1 },
        direction: GridDirection.Right,
      }),
    ).toEqual(new Set(['entrance', 'connected-room']));
  });
});
