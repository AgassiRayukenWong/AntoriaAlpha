import {
  GridDirection,
  type ConstructionGridPosition,
  type GalleryPiece,
} from './construction-grid';

export enum GalleryPieceKind {
  Cross = 'cross',
  Room = 'room',
  Straight = 'straight',
  Tee = 'tee',
  Turn = 'turn',
}

export interface GalleryPieceDefinition {
  readonly connections: readonly GridDirection[];
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
    connections: [GridDirection.Left, GridDirection.Right],
  },
  {
    id: 'straight-vertical',
    kind: GalleryPieceKind.Straight,
    label: 'Galerie droite verticale',
    width: 1,
    height: 1,
    connections: [GridDirection.Up, GridDirection.Down],
  },
  {
    id: 'turn-up-right',
    kind: GalleryPieceKind.Turn,
    label: 'Virage haut droite',
    width: 1,
    height: 1,
    connections: [GridDirection.Up, GridDirection.Right],
  },
  {
    id: 'turn-right-down',
    kind: GalleryPieceKind.Turn,
    label: 'Virage droite bas',
    width: 1,
    height: 1,
    connections: [GridDirection.Right, GridDirection.Down],
  },
  {
    id: 'turn-down-left',
    kind: GalleryPieceKind.Turn,
    label: 'Virage bas gauche',
    width: 1,
    height: 1,
    connections: [GridDirection.Down, GridDirection.Left],
  },
  {
    id: 'turn-left-up',
    kind: GalleryPieceKind.Turn,
    label: 'Virage gauche haut',
    width: 1,
    height: 1,
    connections: [GridDirection.Left, GridDirection.Up],
  },
  {
    id: 'tee-up',
    kind: GalleryPieceKind.Tee,
    label: 'Jonction T haut',
    width: 1,
    height: 1,
    connections: [GridDirection.Left, GridDirection.Up, GridDirection.Right],
  },
  {
    id: 'tee-right',
    kind: GalleryPieceKind.Tee,
    label: 'Jonction T droite',
    width: 1,
    height: 1,
    connections: [GridDirection.Up, GridDirection.Right, GridDirection.Down],
  },
  {
    id: 'tee-down',
    kind: GalleryPieceKind.Tee,
    label: 'Jonction T bas',
    width: 1,
    height: 1,
    connections: [GridDirection.Right, GridDirection.Down, GridDirection.Left],
  },
  {
    id: 'tee-left',
    kind: GalleryPieceKind.Tee,
    label: 'Jonction T gauche',
    width: 1,
    height: 1,
    connections: [GridDirection.Down, GridDirection.Left, GridDirection.Up],
  },
  {
    id: 'cross',
    kind: GalleryPieceKind.Cross,
    label: 'Croix',
    width: 1,
    height: 1,
    connections: [
      GridDirection.Up,
      GridDirection.Right,
      GridDirection.Down,
      GridDirection.Left,
    ],
  },
  {
    id: 'small-room',
    kind: GalleryPieceKind.Room,
    label: 'Petite salle',
    width: 2,
    height: 2,
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
    id: options.pieceId,
    position: options.position,
    size: {
      columns: definition.width,
      rows: definition.height,
    },
    connections: [...definition.connections],
  };
};
