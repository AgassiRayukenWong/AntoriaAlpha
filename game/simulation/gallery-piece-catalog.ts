import {
  GridDirection,
  type ConstructionGridPosition,
  type GalleryPiece,
} from './construction-grid';

export enum GalleryPieceKind {
  Barracks = 'barracks',
  BroodChamber = 'brood-chamber',
  Cross = 'cross',
  FungusFarm = 'fungus-farm',
  QueenChamber = 'queen-chamber',
  Straight = 'straight',
  Storage = 'storage',
  Tee = 'tee',
  Turn = 'turn',
}

export interface GalleryPieceDefinition {
  readonly connections: readonly GridDirection[];
  readonly entranceLimit: number;
  readonly height: number;
  readonly id: string;
  readonly kind: GalleryPieceKind;
  readonly label: string;
  readonly width: number;
}

export interface CreateGalleryPieceFromDefinitionOptions {
  readonly definitionId: string;
  readonly pieceId: string;
  readonly position: ConstructionGridPosition;
}

export const galleryPieceCatalog = [
  {
    id: 'straight-horizontal',
    kind: GalleryPieceKind.Straight,
    label: 'Galerie droite horizontale',
    width: 1,
    height: 1,
    entranceLimit: 2,
    connections: [GridDirection.Left, GridDirection.Right],
  },
  {
    id: 'straight-vertical',
    kind: GalleryPieceKind.Straight,
    label: 'Galerie droite verticale',
    width: 1,
    height: 1,
    entranceLimit: 2,
    connections: [GridDirection.Up, GridDirection.Down],
  },
  {
    id: 'turn-up-right',
    kind: GalleryPieceKind.Turn,
    label: 'Virage haut droite',
    width: 1,
    height: 1,
    entranceLimit: 2,
    connections: [GridDirection.Up, GridDirection.Right],
  },
  {
    id: 'turn-right-down',
    kind: GalleryPieceKind.Turn,
    label: 'Virage droite bas',
    width: 1,
    height: 1,
    entranceLimit: 2,
    connections: [GridDirection.Right, GridDirection.Down],
  },
  {
    id: 'turn-down-left',
    kind: GalleryPieceKind.Turn,
    label: 'Virage bas gauche',
    width: 1,
    height: 1,
    entranceLimit: 2,
    connections: [GridDirection.Down, GridDirection.Left],
  },
  {
    id: 'turn-left-up',
    kind: GalleryPieceKind.Turn,
    label: 'Virage gauche haut',
    width: 1,
    height: 1,
    entranceLimit: 2,
    connections: [GridDirection.Left, GridDirection.Up],
  },
  {
    id: 'tee-up',
    kind: GalleryPieceKind.Tee,
    label: 'Jonction T haut',
    width: 1,
    height: 1,
    entranceLimit: 3,
    connections: [GridDirection.Left, GridDirection.Up, GridDirection.Right],
  },
  {
    id: 'tee-right',
    kind: GalleryPieceKind.Tee,
    label: 'Jonction T droite',
    width: 1,
    height: 1,
    entranceLimit: 3,
    connections: [GridDirection.Up, GridDirection.Right, GridDirection.Down],
  },
  {
    id: 'tee-down',
    kind: GalleryPieceKind.Tee,
    label: 'Jonction T bas',
    width: 1,
    height: 1,
    entranceLimit: 3,
    connections: [GridDirection.Right, GridDirection.Down, GridDirection.Left],
  },
  {
    id: 'tee-left',
    kind: GalleryPieceKind.Tee,
    label: 'Jonction T gauche',
    width: 1,
    height: 1,
    entranceLimit: 3,
    connections: [GridDirection.Down, GridDirection.Left, GridDirection.Up],
  },
  {
    id: 'cross',
    kind: GalleryPieceKind.Cross,
    label: 'Croix',
    width: 1,
    height: 1,
    entranceLimit: 4,
    connections: [
      GridDirection.Up,
      GridDirection.Right,
      GridDirection.Down,
      GridDirection.Left,
    ],
  },
  {
    id: 'queen-chamber',
    kind: GalleryPieceKind.QueenChamber,
    label: 'Chambre royale',
    width: 2,
    height: 2,
    entranceLimit: 4,
    connections: [
      GridDirection.Up,
      GridDirection.Right,
      GridDirection.Down,
      GridDirection.Left,
    ],
  },
  {
    id: 'brood-chamber',
    kind: GalleryPieceKind.BroodChamber,
    label: 'Chambre de ponte',
    width: 2,
    height: 2,
    entranceLimit: 4,
    connections: [
      GridDirection.Up,
      GridDirection.Right,
      GridDirection.Down,
      GridDirection.Left,
    ],
  },
  {
    id: 'barracks',
    kind: GalleryPieceKind.Barracks,
    label: 'Caserne',
    width: 2,
    height: 2,
    entranceLimit: 3,
    connections: [
      GridDirection.Up,
      GridDirection.Right,
      GridDirection.Down,
      GridDirection.Left,
    ],
  },
  {
    id: 'storage',
    kind: GalleryPieceKind.Storage,
    label: 'Entrep\u00f4t',
    width: 2,
    height: 2,
    entranceLimit: 3,
    connections: [
      GridDirection.Up,
      GridDirection.Right,
      GridDirection.Down,
      GridDirection.Left,
    ],
  },
  {
    id: 'fungus-farm',
    kind: GalleryPieceKind.FungusFarm,
    label: 'Champignonni\u00e8re',
    width: 2,
    height: 2,
    entranceLimit: 2,
    connections: [
      GridDirection.Up,
      GridDirection.Right,
      GridDirection.Down,
      GridDirection.Left,
    ],
  },
] as const satisfies readonly GalleryPieceDefinition[];

export const findGalleryPieceDefinition = (
  id: string,
): GalleryPieceDefinition | undefined => {
  return galleryPieceCatalog.find((definition) => definition.id === id);
};

export const createGalleryPieceFromDefinition = (
  options: CreateGalleryPieceFromDefinitionOptions,
): GalleryPiece => {
  const definition = findGalleryPieceDefinition(options.definitionId);

  if (!definition) {
    throw new RangeError(
      `Gallery piece definition ${options.definitionId} does not exist.`,
    );
  }

  return {
    definitionId: options.definitionId,
    id: options.pieceId,
    position: options.position,
    size: {
      columns: definition.width,
      rows: definition.height,
    },
    entranceLimit: definition.entranceLimit,
    connections: [...definition.connections],
  };
};
