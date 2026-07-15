export enum GridDirection {
  Down = 'down',
  Left = 'left',
  Right = 'right',
  Up = 'up',
}

export interface ConstructionGridSize {
  readonly columns: number;
  readonly rows: number;
}

export interface ConstructionGridPosition {
  readonly column: number;
  readonly row: number;
}

export interface GalleryPiece {
  readonly connections: readonly GridDirection[];
  readonly definitionId?: string;
  readonly entranceLimit?: number;
  readonly id: string;
  readonly position: ConstructionGridPosition;
  readonly size: ConstructionGridSize;
}

export interface ConstructionGrid {
  readonly pieces: readonly GalleryPiece[];
  readonly size: ConstructionGridSize;
}

export interface ConstructionGridConduit {
  readonly direction: GridDirection;
  readonly position: ConstructionGridPosition;
}

export const createConstructionGrid = (
  size: ConstructionGridSize,
  pieces: readonly GalleryPiece[] = [],
): ConstructionGrid => {
  assertValidGridSize(size);

  for (const piece of pieces) {
    assertPieceFitsGrid(size, piece);
  }
  assertUniquePieceIds(pieces);

  return {
    pieces: [...pieces],
    size,
  };
};

export const isPositionInsideGrid = (
  size: ConstructionGridSize,
  position: ConstructionGridPosition,
): boolean => {
  return (
    Number.isInteger(position.column) &&
    Number.isInteger(position.row) &&
    position.column >= 0 &&
    position.row >= 0 &&
    position.column < size.columns &&
    position.row < size.rows
  );
};

export const isGridPositionOccupied = (
  grid: ConstructionGrid,
  position: ConstructionGridPosition,
): boolean => {
  return grid.pieces.some((piece) =>
    getGalleryPieceOccupiedPositions(piece).some(
      (occupiedPosition) =>
        occupiedPosition.column === position.column &&
        occupiedPosition.row === position.row,
    ),
  );
};

export const isGalleryPieceIdUsed = (
  grid: ConstructionGrid,
  pieceId: string,
): boolean => {
  return grid.pieces.some((piece) => piece.id === pieceId);
};

export const getGalleryPieceOccupiedPositions = (
  piece: GalleryPiece,
): readonly ConstructionGridPosition[] => {
  const occupiedPositions: ConstructionGridPosition[] = [];

  for (
    let columnOffset = 0;
    columnOffset < piece.size.columns;
    columnOffset += 1
  ) {
    for (let rowOffset = 0; rowOffset < piece.size.rows; rowOffset += 1) {
      occupiedPositions.push({
        column: piece.position.column + columnOffset,
        row: piece.position.row + rowOffset,
      });
    }
  }

  return occupiedPositions;
};

export const placeGalleryPiece = (
  grid: ConstructionGrid,
  piece: GalleryPiece,
): ConstructionGrid => {
  assertPieceFitsGrid(grid.size, piece);

  if (isGalleryPieceIdUsed(grid, piece.id)) {
    throw new RangeError(`Gallery piece id ${piece.id} is already used.`);
  }

  for (const occupiedPosition of getGalleryPieceOccupiedPositions(piece)) {
    if (isGridPositionOccupied(grid, occupiedPosition)) {
      throw new RangeError(
        `Grid position ${occupiedPosition.column}:${occupiedPosition.row} is already occupied.`,
      );
    }
  }

  return {
    size: grid.size,
    pieces: [...grid.pieces, piece],
  };
};

export const canPlaceGalleryPieceNextToNetwork = (
  grid: ConstructionGrid,
  piece: GalleryPiece,
  conduit: ConstructionGridConduit,
): boolean => {
  let nextGrid: ConstructionGrid;

  try {
    nextGrid = placeGalleryPiece(grid, piece);
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }

    throw error;
  }

  if (!hasAvailableRoomEntranceCapacity(nextGrid)) {
    return false;
  }

  if (isGalleryPieceConnectedToConduit(piece, conduit)) {
    return true;
  }

  const conduitConnectedPieceIds = getConduitConnectedPieceIds(grid, conduit);

  return grid.pieces.some(
    (existingPiece) =>
      conduitConnectedPieceIds.has(existingPiece.id) &&
      areGalleryPiecesPlacementLinked(piece, existingPiece),
  );
};

export const countGalleryPieceEntrances = (
  grid: ConstructionGrid,
  piece: GalleryPiece,
): number => {
  return grid.pieces
    .filter((candidate) => candidate.id !== piece.id)
    .reduce((entranceCount, candidate) => {
      return entranceCount + countAdjacentPositionPairs(piece, candidate);
    }, 0);
};

export const removeGalleryPiece = (
  grid: ConstructionGrid,
  pieceId: string,
): ConstructionGrid => {
  if (!isGalleryPieceIdUsed(grid, pieceId)) {
    throw new RangeError(`Gallery piece id ${pieceId} does not exist.`);
  }

  return {
    size: grid.size,
    pieces: grid.pieces.filter((piece) => piece.id !== pieceId),
  };
};

export const canRemoveGalleryPieceWithoutDisconnectingNetwork = (
  grid: ConstructionGrid,
  pieceId: string,
  conduit: ConstructionGridConduit,
): boolean => {
  try {
    const nextGrid = removeGalleryPiece(grid, pieceId);

    return (
      nextGrid.pieces.length === 0 ||
      isGalleryNetworkConnectedToConduit(nextGrid, conduit)
    );
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }

    throw error;
  }
};

const assertUniquePieceIds = (pieces: readonly GalleryPiece[]): void => {
  const pieceIds = new Set<string>();

  for (const piece of pieces) {
    if (pieceIds.has(piece.id)) {
      throw new RangeError(`Gallery piece id ${piece.id} is already used.`);
    }

    pieceIds.add(piece.id);
  }
};

export const areAdjacentPositions = (
  firstPosition: ConstructionGridPosition,
  secondPosition: ConstructionGridPosition,
): boolean => {
  const columnDistance = Math.abs(firstPosition.column - secondPosition.column);
  const rowDistance = Math.abs(firstPosition.row - secondPosition.row);

  return columnDistance + rowDistance === 1;
};

export const getDirectionBetweenAdjacentPositions = (
  fromPosition: ConstructionGridPosition,
  toPosition: ConstructionGridPosition,
): GridDirection => {
  if (!areAdjacentPositions(fromPosition, toPosition)) {
    throw new RangeError('Positions must be adjacent.');
  }

  if (toPosition.column > fromPosition.column) {
    return GridDirection.Right;
  }

  if (toPosition.column < fromPosition.column) {
    return GridDirection.Left;
  }

  if (toPosition.row > fromPosition.row) {
    return GridDirection.Down;
  }

  return GridDirection.Up;
};

export const getOppositeDirection = (
  direction: GridDirection,
): GridDirection => {
  switch (direction) {
    case GridDirection.Down:
      return GridDirection.Up;
    case GridDirection.Left:
      return GridDirection.Right;
    case GridDirection.Right:
      return GridDirection.Left;
    case GridDirection.Up:
      return GridDirection.Down;
  }
};

export const areGalleryPiecesConnected = (
  firstPiece: GalleryPiece,
  secondPiece: GalleryPiece,
): boolean => {
  return getGalleryPieceOccupiedPositions(firstPiece).some((firstPosition) =>
    getGalleryPieceOccupiedPositions(secondPiece).some((secondPosition) => {
      if (!areAdjacentPositions(firstPosition, secondPosition)) {
        return false;
      }

      const firstDirection = getDirectionBetweenAdjacentPositions(
        firstPosition,
        secondPosition,
      );
      const secondDirection = getOppositeDirection(firstDirection);

      return (
        firstPiece.connections.includes(firstDirection) &&
        secondPiece.connections.includes(secondDirection)
      );
    }),
  );
};

export const areGalleryPiecesAdjacent = (
  firstPiece: GalleryPiece,
  secondPiece: GalleryPiece,
): boolean => {
  return getGalleryPieceOccupiedPositions(firstPiece).some((firstPosition) =>
    getGalleryPieceOccupiedPositions(secondPiece).some((secondPosition) =>
      areAdjacentPositions(firstPosition, secondPosition),
    ),
  );
};

export const isGalleryNetworkConnected = (
  grid: ConstructionGrid,
  startPieceId: string,
): boolean => {
  return getGalleryNetworkPieceIds(grid, startPieceId).size === grid.pieces.length;
};

export const getGalleryNetworkPieceIds = (
  grid: ConstructionGrid,
  startPieceId: string,
): ReadonlySet<string> => {
  if (!isGalleryPieceIdUsed(grid, startPieceId)) {
    throw new RangeError(`Gallery piece id ${startPieceId} does not exist.`);
  }

  const visitedPieceIds = new Set<string>();
  const pieceIdsToVisit = [startPieceId];

  while (pieceIdsToVisit.length > 0) {
    const currentPieceId = pieceIdsToVisit.pop();

    if (currentPieceId === undefined || visitedPieceIds.has(currentPieceId)) {
      continue;
    }

    const currentPiece = findGalleryPieceById(grid, currentPieceId);
    visitedPieceIds.add(currentPiece.id);

    for (const piece of grid.pieces) {
      if (
        !visitedPieceIds.has(piece.id) &&
        areGalleryPiecesNetworkLinked(currentPiece, piece)
      ) {
        pieceIdsToVisit.push(piece.id);
      }
    }
  }

  return visitedPieceIds;
};

export const isGalleryNetworkConnectedToConduit = (
  grid: ConstructionGrid,
  conduit: ConstructionGridConduit,
): boolean => {
  if (grid.pieces.length === 0) {
    return false;
  }

  return getConduitConnectedPieceIds(grid, conduit).size === grid.pieces.length;
};

export const getConduitConnectedPieceIds = (
  grid: ConstructionGrid,
  conduit: ConstructionGridConduit,
): ReadonlySet<string> => {
  const conduitConnectedPieces = grid.pieces.filter((piece) =>
    isGalleryPieceConnectedToConduit(piece, conduit),
  );

  if (conduitConnectedPieces.length === 0) {
    return new Set<string>();
  }

  const visitedPieceIds = new Set<string>();
  const pieceIdsToVisit = conduitConnectedPieces.map((piece) => piece.id);

  while (pieceIdsToVisit.length > 0) {
    const currentPieceId = pieceIdsToVisit.pop();

    if (currentPieceId === undefined || visitedPieceIds.has(currentPieceId)) {
      continue;
    }

    const currentPiece = findGalleryPieceById(grid, currentPieceId);
    visitedPieceIds.add(currentPiece.id);

    for (const piece of grid.pieces) {
      if (
        !visitedPieceIds.has(piece.id) &&
        areGalleryPiecesNetworkLinked(currentPiece, piece)
      ) {
        pieceIdsToVisit.push(piece.id);
      }
    }
  }

  return visitedPieceIds;
};

const areGalleryPiecesNetworkLinked = (
  firstPiece: GalleryPiece,
  secondPiece: GalleryPiece,
): boolean => {
  if (isRoomPiece(firstPiece) || isRoomPiece(secondPiece)) {
    return areGalleryPiecesAdjacent(firstPiece, secondPiece);
  }

  return areGalleryPiecesConnected(firstPiece, secondPiece);
};

const areGalleryPiecesPlacementLinked = (
  firstPiece: GalleryPiece,
  secondPiece: GalleryPiece,
): boolean => {
  if (
    isSingleCellGalleryPiece(firstPiece) &&
    isSingleCellGalleryPiece(secondPiece)
  ) {
    return areGalleryPiecesAdjacent(firstPiece, secondPiece);
  }

  return areGalleryPiecesNetworkLinked(firstPiece, secondPiece);
};

const hasAvailableRoomEntranceCapacity = (grid: ConstructionGrid): boolean => {
  return grid.pieces
    .filter((piece) => isRoomPiece(piece) && piece.entranceLimit !== undefined)
    .every((piece) => {
      const entranceLimit = piece.entranceLimit;

      return (
        entranceLimit === undefined ||
        countGalleryPieceEntrances(grid, piece) <= entranceLimit
      );
    });
};

const countAdjacentPositionPairs = (
  firstPiece: GalleryPiece,
  secondPiece: GalleryPiece,
): number => {
  return getGalleryPieceOccupiedPositions(firstPiece).reduce(
    (entranceCount, firstPosition) => {
      const adjacentCount = getGalleryPieceOccupiedPositions(
        secondPiece,
      ).filter((secondPosition) =>
        areAdjacentPositions(firstPosition, secondPosition),
      ).length;

      return entranceCount + adjacentCount;
    },
    0,
  );
};

const isSingleCellGalleryPiece = (piece: GalleryPiece): boolean => {
  return piece.size.columns === 1 && piece.size.rows === 1;
};

const isRoomPiece = (piece: GalleryPiece): boolean => {
  return piece.size.columns > 1 || piece.size.rows > 1;
};

const isGalleryPieceConnectedToConduit = (
  piece: GalleryPiece,
  conduit: ConstructionGridConduit,
): boolean => {
  return getGalleryPieceOccupiedPositions(piece).some((position) => {
    if (!areAdjacentPositions(conduit.position, position)) {
      return false;
    }

    const directionFromConduit = getDirectionBetweenAdjacentPositions(
      conduit.position,
      position,
    );

    return (
      directionFromConduit === conduit.direction &&
      piece.connections.includes(getOppositeDirection(conduit.direction))
    );
  });
};

const findGalleryPieceById = (
  grid: ConstructionGrid,
  pieceId: string,
): GalleryPiece => {
  const piece = grid.pieces.find((gridPiece) => gridPiece.id === pieceId);

  if (piece === undefined) {
    throw new RangeError(`Gallery piece id ${pieceId} does not exist.`);
  }

  return piece;
};

const assertValidGridSize = (size: ConstructionGridSize): void => {
  if (
    !Number.isInteger(size.columns) ||
    !Number.isInteger(size.rows) ||
    size.columns <= 0 ||
    size.rows <= 0
  ) {
    throw new RangeError('Grid size must contain positive integer dimensions.');
  }
};

const assertPieceFitsGrid = (
  size: ConstructionGridSize,
  piece: GalleryPiece,
): void => {
  assertValidGridSize(piece.size);

  if (
    !getGalleryPieceOccupiedPositions(piece).every((position) =>
      isPositionInsideGrid(size, position),
    )
  ) {
    throw new RangeError(`Gallery piece ${piece.id} is outside the grid.`);
  }
};
