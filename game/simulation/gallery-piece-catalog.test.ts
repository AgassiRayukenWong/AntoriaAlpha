import { describe, expect, it } from 'vitest';

import { GridDirection } from '@/game/simulation/construction-grid';
import {
  GalleryPieceKind,
  createGalleryPieceFromDefinition,
  findGalleryPieceDefinition,
  galleryPieceCatalog,
} from '@/game/simulation/gallery-piece-catalog';

describe('galleryPieceCatalog', () => {
  it('contains the expected construction piece kinds', () => {
    expect(new Set(galleryPieceCatalog.map((piece) => piece.kind))).toEqual(
      new Set([
        GalleryPieceKind.Barracks,
        GalleryPieceKind.BroodChamber,
        GalleryPieceKind.Cross,
        GalleryPieceKind.FungusFarm,
        GalleryPieceKind.QueenChamber,
        GalleryPieceKind.Straight,
        GalleryPieceKind.Storage,
        GalleryPieceKind.Tee,
        GalleryPieceKind.Turn,
      ]),
    );
  });

  it('defines compatible straight gallery variants', () => {
    expect(findGalleryPieceDefinition('straight-horizontal')).toMatchObject({
      width: 1,
      height: 1,
      connections: [GridDirection.Left, GridDirection.Right],
    });
    expect(findGalleryPieceDefinition('straight-vertical')).toMatchObject({
      width: 1,
      height: 1,
      connections: [GridDirection.Up, GridDirection.Down],
    });
  });

  it('defines every turn rotation', () => {
    const turnDefinitions = galleryPieceCatalog.filter(
      (piece) => piece.kind === GalleryPieceKind.Turn,
    );

    expect(turnDefinitions).toHaveLength(4);
    expect(turnDefinitions.map((piece) => piece.id)).toEqual([
      'turn-up-right',
      'turn-right-down',
      'turn-down-left',
      'turn-left-up',
    ]);
  });

  it('defines every tee rotation', () => {
    const teeDefinitions = galleryPieceCatalog.filter(
      (piece) => piece.kind === GalleryPieceKind.Tee,
    );

    expect(teeDefinitions).toHaveLength(4);
    expect(
      teeDefinitions.every((piece) => piece.connections.length === 3),
    ).toBe(true);
  });

  it('finds a definition by id', () => {
    expect(findGalleryPieceDefinition('cross')).toMatchObject({
      id: 'cross',
      kind: GalleryPieceKind.Cross,
    });
    expect(findGalleryPieceDefinition('missing')).toBeUndefined();
  });

  it('defines the queen chamber as a multi-cell room anchor', () => {
    expect(findGalleryPieceDefinition('queen-chamber')).toMatchObject({
      id: 'queen-chamber',
      kind: GalleryPieceKind.QueenChamber,
      width: 2,
      height: 2,
      entranceLimit: 4,
    });
  });

  it('creates a placed gallery piece from a definition', () => {
    expect(
      createGalleryPieceFromDefinition({
        definitionId: 'turn-right-down',
        pieceId: 'piece-1',
        position: { column: 3, row: 4 },
      }),
    ).toEqual({
      definitionId: 'turn-right-down',
      id: 'piece-1',
      entranceLimit: 2,
      position: { column: 3, row: 4 },
      size: { columns: 1, rows: 1 },
      connections: [GridDirection.Right, GridDirection.Down],
    });
  });

  it('copies multi-cell definition size into placed pieces', () => {
    expect(
      createGalleryPieceFromDefinition({
        definitionId: 'brood-chamber',
        pieceId: 'room-1',
        position: { column: 2, row: 2 },
      }),
    ).toMatchObject({
      entranceLimit: 4,
      size: { columns: 2, rows: 2 },
    });
  });

  it('rejects missing gallery piece definitions', () => {
    expect(() =>
      createGalleryPieceFromDefinition({
        definitionId: 'missing',
        pieceId: 'piece-1',
        position: { column: 3, row: 4 },
      }),
    ).toThrow(RangeError);
  });

  it('keeps all catalog entries on positive grid dimensions', () => {
    expect(
      galleryPieceCatalog.every(
        (piece) =>
          Number.isInteger(piece.width) &&
          Number.isInteger(piece.height) &&
          piece.width > 0 &&
          piece.height > 0,
      ),
    ).toBe(true);
  });
});
