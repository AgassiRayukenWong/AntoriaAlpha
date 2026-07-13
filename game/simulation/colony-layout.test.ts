import { describe, expect, it } from 'vitest';

import { createColonyLayout } from '@/game/simulation/colony-layout';

describe('createColonyLayout', () => {
  it('creates a grid-based colony layout', () => {
    const layout = createColonyLayout({
      gridSize: { width: 12, height: 10 },
    });

    expect(layout).toEqual({
      gridSize: { width: 12, height: 10 },
      rooms: [
        {
          id: 'entrance',
          gridPosition: { x: 6, y: 1 },
          size: { width: 2, height: 1 },
        },
        {
          id: 'upper-west',
          gridPosition: { x: 3, y: 3 },
          size: { width: 3, height: 2 },
        },
        {
          id: 'upper-east',
          gridPosition: { x: 8, y: 3 },
          size: { width: 3, height: 2 },
        },
        {
          id: 'lower-center',
          gridPosition: { x: 4, y: 6 },
          size: { width: 4, height: 2 },
        },
        {
          id: 'lower-east',
          gridPosition: { x: 10, y: 7 },
          size: { width: 2, height: 1 },
        },
      ],
      tunnels: [
        { fromRoomId: 'entrance', toRoomId: 'upper-west' },
        { fromRoomId: 'upper-west', toRoomId: 'upper-east' },
        { fromRoomId: 'upper-west', toRoomId: 'lower-center' },
        { fromRoomId: 'lower-center', toRoomId: 'lower-east' },
      ],
    });
  });

  it('keeps all rooms inside the grid', () => {
    const layout = createColonyLayout({
      gridSize: { width: 12, height: 10 },
    });

    expect(
      layout.rooms.every((room) => {
        const roomRight = room.gridPosition.x + room.size.width;
        const roomBottom = room.gridPosition.y + room.size.height;

        return (
          room.gridPosition.x >= 0 &&
          room.gridPosition.y >= 0 &&
          roomRight <= layout.gridSize.width &&
          roomBottom <= layout.gridSize.height
        );
      }),
    ).toBe(true);
  });

  it('creates tunnels that reference existing rooms', () => {
    const layout = createColonyLayout({
      gridSize: { width: 12, height: 10 },
    });
    const roomIds = new Set(layout.rooms.map((room) => room.id));

    expect(
      layout.tunnels.every(
        (tunnel) =>
          roomIds.has(tunnel.fromRoomId) && roomIds.has(tunnel.toRoomId),
      ),
    ).toBe(true);
  });

  it('rejects invalid grid sizes', () => {
    expect(() =>
      createColonyLayout({
        gridSize: { width: 0, height: 10 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      createColonyLayout({
        gridSize: { width: 12.5, height: 10 },
      }),
    ).toThrow(RangeError);
  });

  it('rejects grids that cannot contain the generated layout', () => {
    expect(() =>
      createColonyLayout({
        gridSize: { width: 8, height: 10 },
      }),
    ).toThrow(RangeError);
  });
});
