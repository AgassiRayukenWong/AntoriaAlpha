export interface GridPosition {
  readonly x: number;
  readonly y: number;
}

export interface GridSize {
  readonly height: number;
  readonly width: number;
}

export interface ColonyRoomNode {
  readonly gridPosition: GridPosition;
  readonly id: string;
  readonly size: GridSize;
}

export interface ColonyTunnelEdge {
  readonly fromRoomId: string;
  readonly toRoomId: string;
}

export interface ColonyLayout {
  readonly gridSize: GridSize;
  readonly rooms: readonly ColonyRoomNode[];
  readonly tunnels: readonly ColonyTunnelEdge[];
}

export interface CreateColonyLayoutOptions {
  readonly gridSize: GridSize;
}

const roomDefinitions: readonly Omit<ColonyRoomNode, 'gridPosition'>[] = [
  {
    id: 'entrance',
    size: { width: 2, height: 1 },
  },
  {
    id: 'upper-west',
    size: { width: 3, height: 2 },
  },
  {
    id: 'upper-east',
    size: { width: 3, height: 2 },
  },
  {
    id: 'lower-center',
    size: { width: 4, height: 2 },
  },
  {
    id: 'lower-east',
    size: { width: 2, height: 1 },
  },
];

const tunnelDefinitions: readonly ColonyTunnelEdge[] = [
  { fromRoomId: 'entrance', toRoomId: 'upper-west' },
  { fromRoomId: 'upper-west', toRoomId: 'upper-east' },
  { fromRoomId: 'upper-west', toRoomId: 'lower-center' },
  { fromRoomId: 'lower-center', toRoomId: 'lower-east' },
];

export const createColonyLayout = (
  options: CreateColonyLayoutOptions,
): ColonyLayout => {
  assertValidGridSize(options.gridSize);

  const rooms = createRooms(options.gridSize);

  assertRoomsFitGrid(rooms, options.gridSize);
  assertTunnelReferences(rooms, tunnelDefinitions);

  return {
    gridSize: options.gridSize,
    rooms,
    tunnels: tunnelDefinitions,
  };
};

const createRooms = (gridSize: GridSize): readonly ColonyRoomNode[] => {
  const centerX = Math.floor(gridSize.width / 2);

  return [
    {
      ...roomDefinitions[0],
      gridPosition: { x: centerX, y: 1 },
    },
    {
      ...roomDefinitions[1],
      gridPosition: { x: centerX - 3, y: 3 },
    },
    {
      ...roomDefinitions[2],
      gridPosition: { x: centerX + 2, y: 3 },
    },
    {
      ...roomDefinitions[3],
      gridPosition: { x: centerX - 2, y: 6 },
    },
    {
      ...roomDefinitions[4],
      gridPosition: { x: centerX + 4, y: 7 },
    },
  ];
};

const assertValidGridSize = (gridSize: GridSize): void => {
  if (
    !Number.isInteger(gridSize.width) ||
    !Number.isInteger(gridSize.height) ||
    gridSize.width <= 0 ||
    gridSize.height <= 0
  ) {
    throw new RangeError('gridSize must contain positive integer dimensions.');
  }
};

const assertRoomsFitGrid = (
  rooms: readonly ColonyRoomNode[],
  gridSize: GridSize,
): void => {
  for (const room of rooms) {
    const roomRight = room.gridPosition.x + room.size.width;
    const roomBottom = room.gridPosition.y + room.size.height;

    if (
      room.gridPosition.x < 0 ||
      room.gridPosition.y < 0 ||
      roomRight > gridSize.width ||
      roomBottom > gridSize.height
    ) {
      throw new RangeError(`Room ${room.id} does not fit inside the grid.`);
    }
  }
};

const assertTunnelReferences = (
  rooms: readonly ColonyRoomNode[],
  tunnels: readonly ColonyTunnelEdge[],
): void => {
  const roomIds = new Set(rooms.map((room) => room.id));

  for (const tunnel of tunnels) {
    if (!roomIds.has(tunnel.fromRoomId) || !roomIds.has(tunnel.toRoomId)) {
      throw new RangeError('Tunnel references must target existing rooms.');
    }
  }
};
