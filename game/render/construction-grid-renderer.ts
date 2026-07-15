import {
  areGalleryPiecesAdjacent,
  areGalleryPiecesConnected,
  countGalleryPieceEntrances,
  createConstructionGrid,
  getDirectionBetweenAdjacentPositions,
  getGalleryNetworkPieceIds,
  getGalleryPieceOccupiedPositions,
  getOppositeDirection,
  GridDirection,
  isGridPositionOccupied,
  placeGalleryPiece,
  removeGalleryPiece,
  type ConstructionGridPosition,
  type ConstructionGrid,
  type ConstructionGridConduit,
  type GalleryPiece,
} from '@/game/simulation/construction-grid';
import {
  createGalleryPieceFromDefinition,
  findGalleryPieceDefinition,
} from '@/game/simulation/gallery-piece-catalog';

import type PhaserType from 'phaser';

interface GridArea {
  readonly cellSize: number;
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface GalleryRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface EntranceMarker {
  readonly x: number;
  readonly y: number;
}

interface ToolButtonArea {
  readonly height: number;
  readonly mode: ConstructionToolMode;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface ConstructionPieceButtonArea {
  readonly height: number;
  readonly pieceType: ConstructionPieceType;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface FloatingMenuToggleArea {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface FloatingMenuRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface RoomVisualStyle {
  readonly accentColor: number;
  readonly fillColor: number;
}

export interface ConstructionGridPointer {
  readonly x: number;
  readonly y: number;
}

export enum ConstructionToolMode {
  Build = 'build',
  Destroy = 'destroy',
}

export enum ConstructionPieceType {
  Barracks = 'barracks',
  BroodChamber = 'brood-chamber',
  FungusFarm = 'fungus-farm',
  Gallery = 'gallery',
  Storage = 'storage',
}

const constructionGridPalette = {
  base: 0x100f0b,
  conduitBorder: 0x8f7a55,
  conduitFill: 0x242017,
  conduitInner: 0x0b0a08,
  depthBands: [0x17130f, 0x1d1711, 0x241b13, 0x1b1510, 0x120f0c],
  entranceMarker: 0xf0c76a,
  entranceMarkerBorder: 0x3a2714,
  entranceMarkerFull: 0xd46a56,
  entranceTextFull: '#d46a56',
  panelFill: 0x17130f,
  ghostBlockedFill: 0x8f2d24,
  ghostBlockedStroke: 0xd46a56,
  ghostFill: 0x7a542f,
  ghostStroke: 0xf0c76a,
  gridBorder: 0x5f5440,
  gridBlockedHover: 0xb85b4b,
  gridLine: 0x6d6048,
  gridHover: 0xd0b071,
  gridBlockedSelection: 0xd46a56,
  gridSelection: 0xf0c76a,
  pieceSelection: 0xf0c76a,
  queenAccent: 0xf0c76a,
  queenBody: 0x8a4f28,
  toolButtonActiveFill: 0x4b351e,
  toolButtonInactiveFill: 0x211b15,
  galleryBorder: 0xb2874c,
  galleryFill: 0x6b4424,
  galleryHighlight: 0xd0b071,
  galleryShadow: 0x0a0705,
  moss: 0x64734b,
  networkConnected: 0x9fbf73,
  networkDisconnected: 0xd46a56,
  roomFill: 0x50341f,
  roomHighlight: 0xe0c08a,
  roomInnerShadow: 0x24160d,
  soilLine: 0x78644a,
  softLight: 0x93a66f,
  surface: 0x0d160f,
  textShadow: '#24160d',
  textWarning: '#f0c76a',
} as const;

const constructionToolModeLabels = {
  [ConstructionToolMode.Build]: 'Construire',
  [ConstructionToolMode.Destroy]: 'D\u00e9truire',
} as const satisfies Record<ConstructionToolMode, string>;

const constructionTextResolution = 2;

const constructionPieceTypeLabels = {
  [ConstructionPieceType.Gallery]: {
    costLabel: 'Co\u00fbt 1',
    keyLabel: '1',
    nameLabel: 'Galerie',
  },
  [ConstructionPieceType.BroodChamber]: {
    costLabel: 'Co\u00fbt 4',
    keyLabel: '2',
    nameLabel: 'Ponte',
  },
  [ConstructionPieceType.Barracks]: {
    costLabel: 'Co\u00fbt 6',
    keyLabel: '3',
    nameLabel: 'Caserne',
  },
  [ConstructionPieceType.Storage]: {
    costLabel: 'Co\u00fbt 5',
    keyLabel: '4',
    nameLabel: 'Entrep\u00f4t',
  },
  [ConstructionPieceType.FungusFarm]: {
    costLabel: 'Co\u00fbt 5',
    keyLabel: '5',
    nameLabel: 'Champi',
  },
} as const satisfies Record<
  ConstructionPieceType,
  {
    readonly costLabel: string;
    readonly keyLabel: string;
    readonly nameLabel: string;
  }
>;

const constructionPieceTypes = [
  ConstructionPieceType.Gallery,
  ConstructionPieceType.BroodChamber,
  ConstructionPieceType.Barracks,
  ConstructionPieceType.Storage,
  ConstructionPieceType.FungusFarm,
] as const satisfies readonly ConstructionPieceType[];

const constructionPieceDefinitionIds = {
  [ConstructionPieceType.Barracks]: 'barracks',
  [ConstructionPieceType.BroodChamber]: 'brood-chamber',
  [ConstructionPieceType.FungusFarm]: 'fungus-farm',
  [ConstructionPieceType.Gallery]: undefined,
  [ConstructionPieceType.Storage]: 'storage',
} as const satisfies Record<ConstructionPieceType, string | undefined>;

const roomVisualStyles: Readonly<Record<string, RoomVisualStyle>> = {
  barracks: {
    accentColor: 0xd46a56,
    fillColor: 0x5a2f24,
  },
  'brood-chamber': {
    accentColor: 0xf0c76a,
    fillColor: 0x5c3a22,
  },
  'fungus-farm': {
    accentColor: 0xa9c779,
    fillColor: 0x344b2c,
  },
  'queen-chamber': {
    accentColor: 0xf0c76a,
    fillColor: 0x50341f,
  },
  storage: {
    accentColor: 0xb2874c,
    fillColor: 0x4d3b24,
  },
} as const;

const queenChamberPieceId = 'sample-queen-chamber';

const constructionGridLayout = {
  columns: 16,
  conduit: {
    direction: GridDirection.Down,
    position: { column: 12, row: -1 },
  },
  depthBandCount: 5,
  gridAlpha: 0.3,
  horizontalPaddingRatio: 0.055,
  minimumTopPadding: 18,
  reservedTopRows: 1,
  rows: 18,
  sampleGalleryPieces: [
    createGalleryPieceFromDefinition({
      definitionId: 'straight-vertical',
      pieceId: 'sample-gallery-1',
      position: { column: 12, row: 0 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-vertical',
      pieceId: 'sample-gallery-2',
      position: { column: 12, row: 1 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-vertical',
      pieceId: 'sample-gallery-3',
      position: { column: 12, row: 2 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'cross',
      pieceId: 'sample-gallery-4',
      position: { column: 12, row: 3 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-horizontal',
      pieceId: 'sample-gallery-5',
      position: { column: 13, row: 3 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'brood-chamber',
      pieceId: 'sample-brood-chamber',
      position: { column: 14, row: 2 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-horizontal',
      pieceId: 'sample-gallery-7',
      position: { column: 11, row: 3 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'queen-chamber',
      pieceId: queenChamberPieceId,
      position: { column: 9, row: 2 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-vertical',
      pieceId: 'sample-gallery-9',
      position: { column: 12, row: 4 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-vertical',
      pieceId: 'sample-gallery-10',
      position: { column: 12, row: 5 },
    }),
  ],
  soilLineCount: 18,
  surfaceRatio: 0.16,
  verticalPaddingRatio: 0.045,
  visibleRows: 9,
} as const satisfies {
  readonly columns: number;
  readonly conduit: ConstructionGridConduit;
  readonly depthBandCount: number;
  readonly gridAlpha: number;
  readonly horizontalPaddingRatio: number;
  readonly minimumTopPadding: number;
  readonly reservedTopRows: number;
  readonly rows: number;
  readonly sampleGalleryPieces: readonly GalleryPiece[];
  readonly soilLineCount: number;
  readonly surfaceRatio: number;
  readonly verticalPaddingRatio: number;
  readonly visibleRows: number;
};

export class ConstructionGridRenderer {
  private actionHintLabel?: PhaserType.GameObjects.Text;
  private constructionGrid: ConstructionGrid;
  private entranceCounterLabels: PhaserType.GameObjects.Text[] = [];
  private floatingMenuRect?: FloatingMenuRect;
  private floatingMenuToggleArea?: FloatingMenuToggleArea;
  private networkStatusLabel?: PhaserType.GameObjects.Text;
  private constructionPieceButtonAreas: readonly ConstructionPieceButtonArea[] =
    [];
  private queenStatusLabel?: PhaserType.GameObjects.Text;
  private selectedInfoLabel?: PhaserType.GameObjects.Text;
  private toolButtonAreas: readonly ToolButtonArea[] = [];
  private toolModeLabel?: PhaserType.GameObjects.Text;
  private placedGalleryIndex = 1;

  public constructor(
    private readonly graphics: PhaserType.GameObjects.Graphics,
    private readonly gameObjects: PhaserType.GameObjects.GameObjectFactory,
    private readonly Phaser: typeof PhaserType,
  ) {
    this.constructionGrid = createConstructionGrid(
      {
        columns: constructionGridLayout.columns,
        rows: constructionGridLayout.rows,
      },
      constructionGridLayout.sampleGalleryPieces,
    );
  }

  public render(
    width: number,
    height: number,
    pointer?: ConstructionGridPointer,
    selectedPosition?: ConstructionGridPosition,
    toolMode: ConstructionToolMode = ConstructionToolMode.Build,
    selectedPieceType: ConstructionPieceType = ConstructionPieceType.Gallery,
    gridScrollY = 0,
    isFloatingMenuCollapsed = false,
    floatingMenuSlideProgress = isFloatingMenuCollapsed ? 1 : 0,
  ): void {
    const gridArea = this.createGridArea(width, height, gridScrollY);
    const viewportGridArea = this.createGridArea(width, height);
    const floatingMenuOffsetX = this.getFloatingMenuOffsetX(
      viewportGridArea,
      floatingMenuSlideProgress,
    );

    this.toolButtonAreas = this.createToolButtonAreas(
      viewportGridArea,
      floatingMenuOffsetX,
    );
    this.constructionPieceButtonAreas = this.createConstructionPieceButtonAreas(
      viewportGridArea,
      floatingMenuOffsetX,
    );
    const floatingMenuRect = this.createFloatingMenuRect(
      viewportGridArea,
      floatingMenuOffsetX,
    );
    this.floatingMenuRect = floatingMenuRect;
    this.floatingMenuToggleArea = this.createFloatingMenuToggleArea(
      viewportGridArea,
      floatingMenuRect,
    );
    this.clearActionHintLabel();
    this.clearEntranceCounterLabels();
    this.clearNetworkStatusLabel();
    this.clearQueenStatusLabel();
    this.clearSelectedInfoLabel();
    this.clearToolModeLabel();
    this.graphics.clear();
    this.drawBackground(width, height);
    this.drawSurface(width, height, gridArea);
    this.drawSoilTexture(width, height);
    this.drawSoftLight(width, height, gridArea);
    this.drawGrid(gridArea);
    this.drawSelectedGridCell(gridArea, selectedPosition, selectedPieceType);
    this.drawGalleryPieces(gridArea, this.constructionGrid.pieces);
    this.drawQueenAnchor(gridArea);
    this.drawSelectedPiece(gridArea, selectedPosition);
    if (floatingMenuSlideProgress < 1) {
      this.drawFloatingMenuPanel(viewportGridArea, floatingMenuRect);
      this.drawToolModeLabel(viewportGridArea, toolMode, floatingMenuOffsetX);
      this.drawToolButtons(viewportGridArea, toolMode);
      this.drawConstructionPiecePanel(viewportGridArea, selectedPieceType);
      this.drawNetworkStatusLabel(viewportGridArea, floatingMenuOffsetX);
    }
    this.drawSelectedInfoLabel(gridArea, selectedPosition);
    this.drawToolPreview(gridArea, pointer, toolMode, selectedPieceType);
    this.drawActionHintLabel(gridArea, pointer, toolMode, selectedPieceType);
    this.drawConduit(gridArea, constructionGridLayout.conduit);
    this.drawFloatingMenuToggle(
      viewportGridArea,
      pointer,
      isFloatingMenuCollapsed,
    );
  }

  public getGridPositionAtPointer(
    width: number,
    height: number,
    pointer: ConstructionGridPointer,
    gridScrollY = 0,
  ): ConstructionGridPosition | undefined {
    const gridArea = this.createGridArea(width, height, gridScrollY);
    const position = this.getGridPositionAtPoint(gridArea, pointer);

    if (position === undefined) {
      return undefined;
    }

    return position;
  }

  public getMaximumGridScrollY(width: number, height: number): number {
    const gridArea = this.createGridArea(width, height);
    const viewportHeight =
      height - gridArea.y - height * constructionGridLayout.verticalPaddingRatio;

    return Math.max(0, gridArea.height - viewportHeight);
  }

  public getToolModeAtPointer(
    width: number,
    height: number,
    pointer: ConstructionGridPointer,
    isFloatingMenuCollapsed = false,
  ): ConstructionToolMode | undefined {
    if (isFloatingMenuCollapsed) {
      return undefined;
    }

    if (this.toolButtonAreas.length === 0) {
      this.toolButtonAreas = this.createToolButtonAreas(
        this.createGridArea(width, height),
      );
    }

    return this.toolButtonAreas.find(
      (area) =>
        pointer.x >= area.x &&
        pointer.x <= area.x + area.width &&
        pointer.y >= area.y &&
        pointer.y <= area.y + area.height,
    )?.mode;
  }

  public getConstructionPieceTypeAtPointer(
    width: number,
    height: number,
    pointer: ConstructionGridPointer,
    isFloatingMenuCollapsed = false,
  ): ConstructionPieceType | undefined {
    if (isFloatingMenuCollapsed) {
      return undefined;
    }

    if (this.constructionPieceButtonAreas.length === 0) {
      this.constructionPieceButtonAreas =
        this.createConstructionPieceButtonAreas(
          this.createGridArea(width, height),
        );
    }

    return this.constructionPieceButtonAreas.find(
      (area) =>
        pointer.x >= area.x &&
        pointer.x <= area.x + area.width &&
        pointer.y >= area.y &&
        pointer.y <= area.y + area.height,
    )?.pieceType;
  }

  public isFloatingMenuToggleAtPointer(
    width: number,
    height: number,
    pointer: ConstructionGridPointer,
  ): boolean {
    if (this.floatingMenuToggleArea === undefined) {
      this.floatingMenuToggleArea = this.createFloatingMenuToggleArea(
        this.createGridArea(width, height),
      );
    }

    return this.isPointInsideFloatingMenuToggle(pointer);
  }

  public isFloatingMenuPanelAtPointer(
    width: number,
    height: number,
    pointer: ConstructionGridPointer,
    floatingMenuSlideProgress: number,
  ): boolean {
    if (floatingMenuSlideProgress >= 1) {
      return false;
    }

    if (this.floatingMenuRect === undefined) {
      const gridArea = this.createGridArea(width, height);
      const floatingMenuOffsetX = this.getFloatingMenuOffsetX(
        gridArea,
        floatingMenuSlideProgress,
      );

      this.floatingMenuRect = this.createFloatingMenuRect(
        gridArea,
        floatingMenuOffsetX,
      );
    }

    return (
      pointer.x >= this.floatingMenuRect.x &&
      pointer.x <= this.floatingMenuRect.x + this.floatingMenuRect.width &&
      pointer.y >= this.floatingMenuRect.y &&
      pointer.y <= this.floatingMenuRect.y + this.floatingMenuRect.height
    );
  }

  public placeConstructionPieceAtPosition(
    position: ConstructionGridPosition,
    pieceType: ConstructionPieceType,
  ): boolean {
    if (!this.canPlaceConstructionPieceAtPosition(position, pieceType)) {
      return false;
    }

    const piece = this.createConstructionPieceForPosition(position, pieceType);

    this.constructionGrid = placeGalleryPiece(this.constructionGrid, piece);
    getGalleryPieceOccupiedPositions(piece).forEach((occupiedPosition) => {
      this.refreshGalleryPiecesAroundPosition(occupiedPosition);
    });
    this.placedGalleryIndex += 1;

    return true;
  }

  private canPlaceConstructionPieceAtPosition(
    position: ConstructionGridPosition,
    pieceType: ConstructionPieceType,
  ): boolean {
    const piece = this.createConstructionPieceForPosition(position, pieceType);

    try {
      placeGalleryPiece(this.constructionGrid, piece);
    } catch (error) {
      if (error instanceof RangeError) {
        return false;
      }

      throw error;
    }

    if (this.wouldExceedRoomEntranceLimit(piece)) {
      return false;
    }

    return this.isGalleryPieceTouchingQueenNetwork(piece);
  }

  private createConstructionPieceForPosition(
    position: ConstructionGridPosition,
    pieceType: ConstructionPieceType,
  ): GalleryPiece {
    const definitionId = constructionPieceDefinitionIds[pieceType];

    if (definitionId !== undefined) {
      return createGalleryPieceFromDefinition({
        definitionId,
        pieceId: `placed-${pieceType}-${this.placedGalleryIndex}`,
        position,
      });
    }

    return this.createGalleryPieceForPosition(position);
  }

  private createGalleryPieceForPosition(
    position: ConstructionGridPosition,
  ): GalleryPiece {
    return createGalleryPieceFromDefinition({
      definitionId: this.getGalleryDefinitionIdForPosition(position),
      pieceId: `placed-gallery-${this.placedGalleryIndex}`,
      position,
    });
  }

  public removeGalleryAtPosition(position: ConstructionGridPosition): boolean {
    const piece = this.findPieceAtPosition(position);

    if (piece === undefined) {
      return false;
    }

    const occupiedPositions = getGalleryPieceOccupiedPositions(piece);

    this.constructionGrid = removeGalleryPiece(this.constructionGrid, piece.id);
    occupiedPositions.forEach((occupiedPosition) => {
      this.refreshGalleryPiecesAroundPosition(occupiedPosition);
    });

    return true;
  }

  private wouldExceedRoomEntranceLimit(piece: GalleryPiece): boolean {
    let nextGrid: ConstructionGrid;

    try {
      nextGrid = placeGalleryPiece(this.constructionGrid, piece);
    } catch (error) {
      if (error instanceof RangeError) {
        return false;
      }

      throw error;
    }

    return nextGrid.pieces
      .filter(
        (gridPiece) =>
          this.isRoomPiece(gridPiece) && gridPiece.entranceLimit !== undefined,
      )
      .some((roomPiece) => {
        const entranceLimit = roomPiece.entranceLimit;

        return (
          entranceLimit !== undefined &&
          countGalleryPieceEntrances(nextGrid, roomPiece) > entranceLimit
        );
      });
  }

  private isGalleryPieceTouchingQueenNetwork(piece: GalleryPiece): boolean {
    const queenNetworkPieceIds = this.getQueenNetworkPieceIds();

    if (queenNetworkPieceIds.size === 0) {
      return false;
    }

    return this.constructionGrid.pieces.some(
      (existingPiece) =>
        queenNetworkPieceIds.has(existingPiece.id) &&
        this.areGalleryPiecesPlacementLinked(piece, existingPiece),
    );
  }

  private areGalleryPiecesPlacementLinked(
    firstPiece: GalleryPiece,
    secondPiece: GalleryPiece,
  ): boolean {
    if (this.isRoomPiece(firstPiece) || this.isRoomPiece(secondPiece)) {
      return areGalleryPiecesAdjacent(firstPiece, secondPiece);
    }

    if (
      this.isSingleCellPiece(firstPiece) &&
      this.isSingleCellPiece(secondPiece)
    ) {
      return areGalleryPiecesAdjacent(firstPiece, secondPiece);
    }

    return areGalleryPiecesConnected(firstPiece, secondPiece);
  }

  private isSingleCellPiece(piece: GalleryPiece): boolean {
    return piece.size.columns === 1 && piece.size.rows === 1;
  }

  private refreshGalleryPiecesAroundPosition(
    position: ConstructionGridPosition,
  ): void {
    const positionsToRefresh = [
      position,
      { column: position.column, row: position.row - 1 },
      { column: position.column + 1, row: position.row },
      { column: position.column, row: position.row + 1 },
      { column: position.column - 1, row: position.row },
    ];

    positionsToRefresh.forEach((positionToRefresh) => {
      const piece = this.findSingleCellPieceAtPosition(positionToRefresh);

      if (piece === undefined) {
        return;
      }

      this.replaceGalleryPiece(
        piece,
        this.getGalleryDefinitionIdForPosition(piece.position),
      );
    });
  }

  private findSingleCellPieceAtPosition(
    position: ConstructionGridPosition,
  ): GalleryPiece | undefined {
    const piece = this.findPieceAtPosition(position);

    if (
      piece === undefined ||
      piece.size.columns !== 1 ||
      piece.size.rows !== 1
    ) {
      return undefined;
    }

    return piece;
  }

  private findPieceAtPosition(
    position: ConstructionGridPosition,
  ): GalleryPiece | undefined {
    return this.constructionGrid.pieces.find((piece) =>
      getGalleryPieceOccupiedPositions(piece).some(
        (occupiedPosition) =>
          occupiedPosition.column === position.column &&
          occupiedPosition.row === position.row,
      ),
    );
  }

  private findQueenChamber(): GalleryPiece | undefined {
    return this.constructionGrid.pieces.find(
      (piece) => piece.id === queenChamberPieceId,
    );
  }

  private getQueenNetworkPieceIds(): ReadonlySet<string> {
    if (this.findQueenChamber() === undefined) {
      return new Set<string>();
    }

    return getGalleryNetworkPieceIds(this.constructionGrid, queenChamberPieceId);
  }

  private replaceGalleryPiece(piece: GalleryPiece, definitionId: string): void {
    const replacement = createGalleryPieceFromDefinition({
      definitionId,
      pieceId: piece.id,
      position: piece.position,
    });

    this.constructionGrid = placeGalleryPiece(
      removeGalleryPiece(this.constructionGrid, piece.id),
      replacement,
    );
  }

  private getGalleryDefinitionIdForPosition(
    position: ConstructionGridPosition,
  ): string {
    const connections = this.getNeighborDirections(position);
    const hasUp = connections.includes(GridDirection.Up);
    const hasRight = connections.includes(GridDirection.Right);
    const hasDown = connections.includes(GridDirection.Down);
    const hasLeft = connections.includes(GridDirection.Left);

    if (connections.length === 4) {
      return 'cross';
    }

    if (connections.length === 3) {
      if (!hasDown) {
        return 'tee-up';
      }

      if (!hasLeft) {
        return 'tee-right';
      }

      if (!hasUp) {
        return 'tee-down';
      }

      return 'tee-left';
    }

    if (connections.length === 2) {
      if (hasLeft && hasRight) {
        return 'straight-horizontal';
      }

      if (hasUp && hasDown) {
        return 'straight-vertical';
      }

      if (hasUp && hasRight) {
        return 'turn-up-right';
      }

      if (hasRight && hasDown) {
        return 'turn-right-down';
      }

      if (hasDown && hasLeft) {
        return 'turn-down-left';
      }

      return 'turn-left-up';
    }

    if (hasUp || hasDown) {
      return 'straight-vertical';
    }

    return 'straight-horizontal';
  }

  private getNeighborDirections(
    position: ConstructionGridPosition,
  ): readonly GridDirection[] {
    const neighborDirections: GridDirection[] = [];
    const conduitDirection = this.getConduitConnectionDirection(position);

    if (conduitDirection !== undefined) {
      neighborDirections.push(conduitDirection);
    }

    const candidates = [
      {
        direction: GridDirection.Up,
        position: { column: position.column, row: position.row - 1 },
      },
      {
        direction: GridDirection.Right,
        position: { column: position.column + 1, row: position.row },
      },
      {
        direction: GridDirection.Down,
        position: { column: position.column, row: position.row + 1 },
      },
      {
        direction: GridDirection.Left,
        position: { column: position.column - 1, row: position.row },
      },
    ] as const;

    candidates.forEach((candidate) => {
      if (
        candidate.position.column >= 0 &&
        candidate.position.row >= 0 &&
        candidate.position.column < this.constructionGrid.size.columns &&
        candidate.position.row < this.constructionGrid.size.rows &&
        isGridPositionOccupied(this.constructionGrid, candidate.position)
      ) {
        neighborDirections.push(candidate.direction);
      }
    });

    return neighborDirections;
  }

  private getConduitConnectionDirection(
    position: ConstructionGridPosition,
  ): GridDirection | undefined {
    try {
      const directionFromConduit = getDirectionBetweenAdjacentPositions(
        constructionGridLayout.conduit.position,
        position,
      );

      if (directionFromConduit !== constructionGridLayout.conduit.direction) {
        return undefined;
      }

      return getOppositeDirection(directionFromConduit);
    } catch (error) {
      if (error instanceof RangeError) {
        return undefined;
      }

      throw error;
    }
  }

  private createGridArea(
    width: number,
    height: number,
    scrollOffsetY = 0,
  ): GridArea {
    const availableWidth =
      width * (1 - constructionGridLayout.horizontalPaddingRatio * 2);
    const availableHeight =
      height *
      (1 -
        constructionGridLayout.surfaceRatio -
        constructionGridLayout.verticalPaddingRatio);
    const cellSize = Math.min(
      availableWidth / constructionGridLayout.columns,
      availableHeight /
        (constructionGridLayout.visibleRows +
          constructionGridLayout.reservedTopRows),
    );
    const gridWidth = cellSize * constructionGridLayout.columns;
    const gridHeight = cellSize * constructionGridLayout.rows;
    const reservedTopHeight = cellSize * constructionGridLayout.reservedTopRows;
    const topPadding = Math.max(
      constructionGridLayout.minimumTopPadding,
      height * constructionGridLayout.verticalPaddingRatio,
    );

    return {
      cellSize,
      height: gridHeight,
      width: gridWidth,
      x: (width - gridWidth) / 2,
      y:
        height * constructionGridLayout.surfaceRatio +
        topPadding +
        reservedTopHeight -
        scrollOffsetY,
    };
  }

  private drawBackground(width: number, height: number): void {
    const bandHeight = height / constructionGridLayout.depthBandCount;

    this.graphics.fillStyle(constructionGridPalette.base, 1);
    this.graphics.fillRect(0, 0, width, height);

    constructionGridPalette.depthBands.forEach((color, index) => {
      this.graphics.fillStyle(color, 0.76);
      this.graphics.fillRect(0, index * bandHeight, width, bandHeight + 2);
    });
  }

  private drawSurface(width: number, height: number, gridArea: GridArea): void {
    const surfaceY = gridArea.y - gridArea.cellSize * 0.35;
    const mossHeight = Math.max(5, height * 0.012);

    this.graphics.fillStyle(constructionGridPalette.surface, 0.92);
    this.graphics.fillRect(0, 0, width, surfaceY);
    this.graphics.fillStyle(constructionGridPalette.moss, 0.5);
    this.graphics.fillRect(0, surfaceY - mossHeight, width, mossHeight);
    this.graphics.lineStyle(2, constructionGridPalette.moss, 0.28);
    this.graphics.lineBetween(0, surfaceY, width, surfaceY);
  }

  private drawSoilTexture(width: number, height: number): void {
    this.graphics.lineStyle(1, constructionGridPalette.soilLine, 0.11);

    for (
      let index = 0;
      index < constructionGridLayout.soilLineCount;
      index += 1
    ) {
      const y = (height / constructionGridLayout.soilLineCount) * index;
      const offset = index % 2 === 0 ? width * 0.035 : width * -0.025;

      this.graphics.beginPath();
      this.graphics.moveTo(0, y);
      this.graphics.lineTo(width * 0.32 + offset, y + height * 0.01);
      this.graphics.lineTo(width * 0.67 - offset, y - height * 0.008);
      this.graphics.lineTo(width, y + height * 0.01);
      this.graphics.strokePath();
    }
  }

  private drawSoftLight(
    width: number,
    height: number,
    gridArea: GridArea,
  ): void {
    const centerX = gridArea.x + gridArea.width / 2;
    const centerY = gridArea.y + gridArea.height / 2;
    const maxRadius = Math.max(width, height) * 0.48;

    for (let index = 0; index < 7; index += 1) {
      const progress = index / 7;

      this.graphics.fillStyle(
        constructionGridPalette.softLight,
        0.018 + progress * 0.01,
      );
      this.graphics.fillEllipse(
        centerX,
        centerY,
        maxRadius * (1 - progress * 0.7),
        maxRadius * 0.42 * (1 - progress * 0.7),
      );
    }
  }

  private drawGrid(gridArea: GridArea): void {
    this.graphics.lineStyle(
      1,
      constructionGridPalette.gridLine,
      constructionGridLayout.gridAlpha,
    );

    for (
      let column = 0;
      column <= constructionGridLayout.columns;
      column += 1
    ) {
      const x = gridArea.x + column * gridArea.cellSize;

      this.graphics.lineBetween(x, gridArea.y, x, gridArea.y + gridArea.height);
    }

    for (let row = 0; row <= constructionGridLayout.rows; row += 1) {
      const y = gridArea.y + row * gridArea.cellSize;

      this.graphics.lineBetween(gridArea.x, y, gridArea.x + gridArea.width, y);
    }

    this.graphics.lineStyle(2, constructionGridPalette.gridBorder, 0.42);
    this.graphics.strokeRect(
      gridArea.x,
      gridArea.y,
      gridArea.width,
      gridArea.height,
    );
  }

  private drawToolModeLabel(
    gridArea: GridArea,
    toolMode: ConstructionToolMode,
    floatingMenuOffsetX: number,
  ): void {
    const layout = this.getFloatingMenuLayout(gridArea, floatingMenuOffsetX);
    const label = this.gameObjects.text(
      layout.contentX,
      layout.modeY,
      `Mode : ${constructionToolModeLabels[toolMode]}`,
      {
        color: constructionGridPalette.textWarning,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(11, Math.round(gridArea.cellSize * 0.18))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    label.setOrigin(0, 0.5);
    label.setShadow(
      1,
      1,
      constructionGridPalette.textShadow,
      2,
      true,
      true,
    );
    label.setDepth(1);
    this.toolModeLabel = label;
  }

  private createFloatingMenuRect(
    gridArea: GridArea,
    floatingMenuOffsetX: number,
  ): FloatingMenuRect {
    const layout = this.getFloatingMenuLayout(gridArea, floatingMenuOffsetX);

    return {
      height: layout.height,
      width: layout.width,
      x: layout.x,
      y: layout.y,
    };
  }

  private getFloatingMenuLayout(
    gridArea: GridArea,
    floatingMenuOffsetX = 0,
  ): {
    readonly contentX: number;
    readonly height: number;
    readonly modeY: number;
    readonly networkY: number;
    readonly padding: number;
    readonly pieceButtonHeight: number;
    readonly pieceButtonWidth: number;
    readonly pieceFirstY: number;
    readonly rowGap: number;
    readonly titleY: number;
    readonly toolButtonHeight: number;
    readonly toolButtonWidth: number;
    readonly toolY: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  } {
    const padding = Math.max(18, gridArea.cellSize * 0.28);
    const rowGap = Math.max(10, gridArea.cellSize * 0.15);
    const toolButtonWidth = Math.max(84, gridArea.cellSize * 1.85);
    const toolButtonHeight = Math.max(24, gridArea.cellSize * 0.36);
    const toolButtonsWidth = toolButtonWidth * 2 + rowGap;
    const pieceButtonWidth = Math.max(
      220,
      gridArea.cellSize * 4.1,
      toolButtonsWidth,
    );
    const pieceButtonHeight = Math.max(30, gridArea.cellSize * 0.46);
    const x = Math.max(16, gridArea.cellSize * 0.32) + floatingMenuOffsetX;
    const y = Math.max(8, gridArea.cellSize * 0.12);
    const contentX = x + padding;
    const networkY = y + padding;
    const modeY = networkY + Math.max(28, gridArea.cellSize * 0.42);
    const toolY = modeY + Math.max(28, gridArea.cellSize * 0.42);
    const titleY = toolY + toolButtonHeight + rowGap * 2.1;
    const pieceFirstY = titleY + rowGap * 0.65;
    const height =
      pieceFirstY +
      pieceButtonHeight * constructionPieceTypes.length +
      rowGap * (constructionPieceTypes.length - 1) -
      y +
      padding;
    const width = pieceButtonWidth + padding * 2;

    return {
      contentX,
      height,
      modeY,
      networkY,
      padding,
      pieceButtonHeight,
      pieceButtonWidth,
      pieceFirstY,
      rowGap,
      titleY,
      toolButtonHeight,
      toolButtonWidth,
      toolY,
      width,
      x,
      y,
    };
  }

  private drawFloatingMenuPanel(
    gridArea: GridArea,
    rect: FloatingMenuRect,
  ): void {
    const cornerRadius = Math.max(10, gridArea.cellSize * 0.16);

    this.graphics.fillStyle(constructionGridPalette.panelFill, 0.82);
    this.graphics.fillRoundedRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      cornerRadius,
    );
    this.graphics.lineStyle(1, constructionGridPalette.gridBorder, 0.56);
    this.graphics.strokeRoundedRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      cornerRadius,
    );
  }

  private createFloatingMenuToggleArea(
    gridArea: GridArea,
    menuRect?: FloatingMenuRect,
  ): FloatingMenuToggleArea {
    const layout = this.getFloatingMenuLayout(
      gridArea,
      menuRect === undefined ? 0 : menuRect.x - Math.max(16, gridArea.cellSize * 0.32),
    );
    const height = Math.max(38, gridArea.cellSize * 0.6);
    const width = Math.max(22, gridArea.cellSize * 0.34);
    const x =
      menuRect === undefined
        ? 0
        : Math.max(0, menuRect.x + menuRect.width - width * 0.35);
    const toggleCenterY =
      menuRect === undefined
        ? Math.max(16, gridArea.cellSize * 0.24) + height / 2
        : (layout.networkY + layout.modeY) / 2;
    const y =
      menuRect === undefined
        ? Math.max(16, gridArea.cellSize * 0.24)
        : toggleCenterY - height / 2;

    return {
      height,
      width,
      x,
      y,
    };
  }

  private drawFloatingMenuToggle(
    gridArea: GridArea,
    pointer: ConstructionGridPointer | undefined,
    isFloatingMenuCollapsed: boolean,
  ): void {
    const area = this.floatingMenuToggleArea;

    if (area === undefined) {
      return;
    }

    const isHovered =
      pointer !== undefined && this.isPointInsideFloatingMenuToggle(pointer);
    const cornerRadius = Math.max(8, gridArea.cellSize * 0.12);

    this.graphics.fillStyle(
      isHovered
        ? constructionGridPalette.toolButtonActiveFill
        : constructionGridPalette.panelFill,
      isHovered ? 0.96 : 0.84,
    );
    this.graphics.fillRoundedRect(
      area.x,
      area.y,
      area.width,
      area.height,
      cornerRadius,
    );
    this.graphics.lineStyle(
      2,
      isHovered
        ? constructionGridPalette.ghostStroke
        : constructionGridPalette.gridBorder,
      isHovered ? 0.88 : 0.48,
    );
    this.graphics.strokeRoundedRect(
      area.x,
      area.y,
      area.width,
      area.height,
      cornerRadius,
    );

    const symbol = this.gameObjects.text(
      area.x + area.width / 2,
      area.y + area.height / 2,
      isFloatingMenuCollapsed ? '>' : '<',
      {
        color: constructionGridPalette.textWarning,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(18, Math.round(gridArea.cellSize * 0.28))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    symbol.setOrigin(0.5);
    symbol.setDepth(2);
    this.entranceCounterLabels.push(symbol);

    if (isHovered) {
      this.drawFloatingMenuToggleTooltip(gridArea, area);
    }
  }

  private drawFloatingMenuToggleTooltip(
    gridArea: GridArea,
    area: FloatingMenuToggleArea,
  ): void {
    const tooltipWidth = Math.max(52, gridArea.cellSize * 0.84);
    const tooltipHeight = Math.max(24, gridArea.cellSize * 0.34);
    const tooltipX = area.x + area.width + Math.max(8, gridArea.cellSize * 0.12);
    const tooltipY = area.y + area.height / 2 - tooltipHeight / 2;
    const cornerRadius = Math.max(6, gridArea.cellSize * 0.09);

    this.graphics.fillStyle(constructionGridPalette.panelFill, 0.94);
    this.graphics.fillRoundedRect(
      tooltipX,
      tooltipY,
      tooltipWidth,
      tooltipHeight,
      cornerRadius,
    );
    this.graphics.lineStyle(1, constructionGridPalette.ghostStroke, 0.62);
    this.graphics.strokeRoundedRect(
      tooltipX,
      tooltipY,
      tooltipWidth,
      tooltipHeight,
      cornerRadius,
    );

    const label = this.gameObjects.text(
      tooltipX + tooltipWidth / 2,
      tooltipY + tooltipHeight / 2,
      'Tab',
      {
        color: constructionGridPalette.textWarning,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(11, Math.round(gridArea.cellSize * 0.15))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    label.setOrigin(0.5);
    label.setDepth(2);
    this.entranceCounterLabels.push(label);
  }

  private isPointInsideFloatingMenuToggle(
    pointer: ConstructionGridPointer,
  ): boolean {
    const area = this.floatingMenuToggleArea;

    return (
      area !== undefined &&
      pointer.x >= area.x &&
      pointer.x <= area.x + area.width &&
      pointer.y >= area.y &&
      pointer.y <= area.y + area.height
    );
  }

  private getFloatingMenuOffsetX(
    gridArea: GridArea,
    slideProgress: number,
  ): number {
    const easedProgress = 1 - (1 - slideProgress) ** 3;
    const menuWidth = this.getFloatingMenuLayout(gridArea).width;

    return -menuWidth * easedProgress;
  }

  private createToolButtonAreas(
    gridArea: GridArea,
    floatingMenuOffsetX = 0,
  ): readonly ToolButtonArea[] {
    const layout = this.getFloatingMenuLayout(gridArea, floatingMenuOffsetX);
    const buttonWidth = layout.toolButtonWidth;
    const buttonHeight = layout.toolButtonHeight;
    const gap = layout.rowGap;
    const x = layout.contentX;
    const y = layout.toolY;

    return [
      {
        height: buttonHeight,
        mode: ConstructionToolMode.Build,
        width: buttonWidth,
        x,
        y,
      },
      {
        height: buttonHeight,
        mode: ConstructionToolMode.Destroy,
        width: buttonWidth,
        x: x + buttonWidth + gap,
        y,
      },
    ];
  }

  private drawToolButtons(
    gridArea: GridArea,
    toolMode: ConstructionToolMode,
  ): void {
    const cornerRadius = Math.max(6, gridArea.cellSize * 0.1);

    this.toolButtonAreas.forEach((area) => {
      const isActive = area.mode === toolMode;
      const fillColor = isActive
        ? constructionGridPalette.toolButtonActiveFill
        : constructionGridPalette.toolButtonInactiveFill;
      const borderColor = isActive
        ? constructionGridPalette.ghostStroke
        : constructionGridPalette.gridBorder;

      this.graphics.fillStyle(fillColor, isActive ? 0.95 : 0.86);
      this.graphics.fillRoundedRect(
        area.x,
        area.y,
        area.width,
        area.height,
        cornerRadius,
      );
      this.graphics.lineStyle(2, borderColor, isActive ? 0.9 : 0.55);
      this.graphics.strokeRoundedRect(
        area.x,
        area.y,
        area.width,
        area.height,
        cornerRadius,
      );

      const label = this.gameObjects.text(
        area.x + area.width / 2,
        area.y + area.height / 2,
        `${area.mode === ConstructionToolMode.Build ? 'B' : 'D'} ${
          constructionToolModeLabels[area.mode]
        }`,
        {
          color: isActive
            ? constructionGridPalette.textWarning
            : '#b4b5aa',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: `${Math.max(11, Math.round(gridArea.cellSize * 0.16))}px`,
          fontStyle: '700',
        resolution: constructionTextResolution,
        },
      );

      label.setOrigin(0.5);
      label.setDepth(1);
      this.entranceCounterLabels.push(label);
    });
  }

  private createConstructionPieceButtonAreas(
    gridArea: GridArea,
    floatingMenuOffsetX = 0,
  ): readonly ConstructionPieceButtonArea[] {
    const layout = this.getFloatingMenuLayout(gridArea, floatingMenuOffsetX);
    const buttonWidth = layout.pieceButtonWidth;
    const buttonHeight = layout.pieceButtonHeight;
    const gap = layout.rowGap;
    const x = layout.contentX;
    const y = layout.pieceFirstY;

    return constructionPieceTypes.map((pieceType, index) => ({
      height: buttonHeight,
      pieceType,
      width: buttonWidth,
      x,
      y: y + index * (buttonHeight + gap),
    }));
  }

  private drawConstructionPiecePanel(
    gridArea: GridArea,
    selectedPieceType: ConstructionPieceType,
  ): void {
    if (this.constructionPieceButtonAreas.length === 0) {
      return;
    }

    const panelX = Math.min(
      ...this.constructionPieceButtonAreas.map((area) => area.x),
    );
    const panelY = Math.min(
      ...this.constructionPieceButtonAreas.map((area) => area.y),
    );
    const titleGap = Math.max(8, gridArea.cellSize * 0.12);

    const title = this.gameObjects.text(
      panelX,
      panelY - titleGap,
      'Pi\u00e8ces :',
      {
        color: constructionGridPalette.textWarning,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(11, Math.round(gridArea.cellSize * 0.16))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    title.setOrigin(0, 1);
    title.setDepth(1);
    this.entranceCounterLabels.push(title);

    this.constructionPieceButtonAreas.forEach((area) => {
      this.drawConstructionPieceButton(gridArea, area, selectedPieceType);
    });
  }

  private drawConstructionPieceButton(
    gridArea: GridArea,
    area: ConstructionPieceButtonArea,
    selectedPieceType: ConstructionPieceType,
  ): void {
    const isActive = area.pieceType === selectedPieceType;
    const cornerRadius = Math.max(6, gridArea.cellSize * 0.1);
    const fillColor = isActive
      ? constructionGridPalette.toolButtonActiveFill
      : constructionGridPalette.toolButtonInactiveFill;
    const borderColor = isActive
      ? constructionGridPalette.ghostStroke
      : constructionGridPalette.gridBorder;

    this.graphics.fillStyle(fillColor, isActive ? 0.95 : 0.86);
    this.graphics.fillRoundedRect(
      area.x,
      area.y,
      area.width,
      area.height,
      cornerRadius,
    );
    this.graphics.lineStyle(2, borderColor, isActive ? 0.9 : 0.55);
    this.graphics.strokeRoundedRect(
      area.x,
      area.y,
      area.width,
      area.height,
      cornerRadius,
    );

    const pieceLabel = constructionPieceTypeLabels[area.pieceType];
    const pieceCount = this.getConstructionPieceCount(area.pieceType);
    const textColor = isActive
      ? constructionGridPalette.textWarning
      : '#b4b5aa';
    const keyLabel = this.gameObjects.text(
      area.x + area.height * 0.5,
      area.y + area.height / 2,
      pieceLabel.keyLabel,
      {
        color: textColor,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(12, Math.round(gridArea.cellSize * 0.18))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    keyLabel.setOrigin(0.5);
    keyLabel.setDepth(1);
    this.entranceCounterLabels.push(keyLabel);

    const nameLabel = this.gameObjects.text(
      area.x + area.height * 0.95,
      area.y + area.height / 2,
      pieceLabel.nameLabel,
      {
        color: textColor,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(11, Math.round(gridArea.cellSize * 0.16))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    nameLabel.setOrigin(0, 0.5);
    nameLabel.setDepth(1);
    this.entranceCounterLabels.push(nameLabel);

    const countLabel = this.gameObjects.text(
      area.x + area.width - area.height * 2.2,
      area.y + area.height / 2,
      `x${pieceCount}`,
      {
        color: isActive ? '#f6d98a' : '#8f927f',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(10, Math.round(gridArea.cellSize * 0.14))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    countLabel.setOrigin(1, 0.5);
    countLabel.setDepth(1);
    this.entranceCounterLabels.push(countLabel);

    const costLabel = this.gameObjects.text(
      area.x + area.width - area.height * 0.35,
      area.y + area.height / 2,
      pieceLabel.costLabel,
      {
        color: isActive ? '#f6d98a' : '#8f927f',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(10, Math.round(gridArea.cellSize * 0.14))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    costLabel.setOrigin(1, 0.5);
    costLabel.setDepth(1);
    this.entranceCounterLabels.push(costLabel);
  }

  private getConstructionPieceCount(
    pieceType: ConstructionPieceType,
  ): number {
    if (pieceType === ConstructionPieceType.Gallery) {
      return this.constructionGrid.pieces.filter((piece) =>
        this.isSingleCellPiece(piece),
      ).length;
    }

    const definitionId = constructionPieceDefinitionIds[pieceType];

    return this.constructionGrid.pieces.filter(
      (piece) => piece.definitionId === definitionId,
    ).length;
  }

  private drawHoveredGridCell(
    gridArea: GridArea,
    pointer: ConstructionGridPointer | undefined,
    selectedPieceType: ConstructionPieceType,
  ): void {
    if (pointer === undefined) {
      return;
    }

    const position = this.getGridPositionAtPoint(gridArea, pointer);

    if (position === undefined) {
      return;
    }

    const x = gridArea.x + position.column * gridArea.cellSize;
    const y = gridArea.y + position.row * gridArea.cellSize;
    const isBlocked = !this.canPlaceConstructionPieceAtPosition(
      position,
      selectedPieceType,
    );
    const hoverColor = isBlocked
      ? constructionGridPalette.gridBlockedHover
      : constructionGridPalette.gridHover;
    const fillAlpha = isBlocked ? 0.1 : 0.08;
    const strokeAlpha = isBlocked ? 0.55 : 0.42;

    this.graphics.fillStyle(hoverColor, fillAlpha);
    this.graphics.fillRect(x, y, gridArea.cellSize, gridArea.cellSize);
    this.graphics.lineStyle(2, hoverColor, strokeAlpha);
    this.graphics.strokeRect(x, y, gridArea.cellSize, gridArea.cellSize);
  }

  private drawToolPreview(
    gridArea: GridArea,
    pointer: ConstructionGridPointer | undefined,
    toolMode: ConstructionToolMode,
    selectedPieceType: ConstructionPieceType,
  ): void {
    if (pointer === undefined) {
      return;
    }

    const position = this.getGridPositionAtPoint(gridArea, pointer);

    if (position === undefined) {
      return;
    }

    this.drawHoveredGridCell(gridArea, pointer, selectedPieceType);

    if (toolMode === ConstructionToolMode.Destroy) {
      this.drawRemovalPreview(gridArea, position);
      return;
    }

    if (isGridPositionOccupied(this.constructionGrid, position)) {
      return;
    }

    const piece = this.createConstructionPieceForPosition(
      position,
      selectedPieceType,
    );
    const canPlace = this.canPlaceConstructionPieceAtPosition(
      position,
      selectedPieceType,
    );

    this.drawPlacementGhost(gridArea, piece, canPlace);
  }

  private drawActionHintLabel(
    gridArea: GridArea,
    pointer: ConstructionGridPointer | undefined,
    toolMode: ConstructionToolMode,
    selectedPieceType: ConstructionPieceType,
  ): void {
    if (pointer === undefined) {
      return;
    }

    const position = this.getGridPositionAtPoint(gridArea, pointer);

    if (position === undefined) {
      return;
    }

    const hintText = this.getActionHintText(
      position,
      toolMode,
      selectedPieceType,
    );
    const label = this.gameObjects.text(
      gridArea.x + gridArea.width / 2,
      gridArea.y + gridArea.height - gridArea.cellSize * 0.24,
      hintText,
      {
        align: 'center',
        color: constructionGridPalette.textWarning,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(10, Math.round(gridArea.cellSize * 0.16))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    label.setOrigin(0.5);
    label.setShadow(
      1,
      1,
      constructionGridPalette.textShadow,
      2,
      true,
      true,
    );
    label.setDepth(1);
    this.actionHintLabel = label;
  }

  private getActionHintText(
    position: ConstructionGridPosition,
    toolMode: ConstructionToolMode,
    selectedPieceType: ConstructionPieceType,
  ): string {
    if (toolMode === ConstructionToolMode.Destroy) {
      return this.getDestroyActionHintText(position);
    }

    return this.getBuildActionHintText(position, selectedPieceType);
  }

  private getBuildActionHintText(
    position: ConstructionGridPosition,
    selectedPieceType: ConstructionPieceType,
  ): string {
    if (isGridPositionOccupied(this.constructionGrid, position)) {
      return 'Case occup\u00e9e';
    }

    const piece = this.createConstructionPieceForPosition(
      position,
      selectedPieceType,
    );

    if (this.wouldExceedRoomEntranceLimit(piece)) {
      return 'Limite d\u2019entr\u00e9es atteinte';
    }

    if (!this.canPlaceConstructionPieceAtPosition(position, selectedPieceType)) {
      return 'Doit toucher le r\u00e9seau de la reine';
    }

    return 'Construire ici';
  }

  private getDestroyActionHintText(position: ConstructionGridPosition): string {
    const piece = this.findPieceAtPosition(position);

    if (piece === undefined) {
      return 'Aucune pi\u00e8ce \u00e0 d\u00e9truire';
    }

    return 'D\u00e9truire cette pi\u00e8ce';
  }

  private drawRemovalPreview(
    gridArea: GridArea,
    position: ConstructionGridPosition,
  ): void {
    const piece = this.findPieceAtPosition(position);

    if (piece === undefined) {
      return;
    }

    this.drawRemovalPreviewOverlay(gridArea, piece);
  }

  private drawRemovalPreviewOverlay(
    gridArea: GridArea,
    piece: GalleryPiece,
  ): void {
    const rect = this.getGalleryRect(gridArea, piece);
    const padding = gridArea.cellSize * 0.08;
    const cornerRadius = this.isRoomPiece(piece) ? gridArea.cellSize * 0.28 : 0;

    this.graphics.fillStyle(constructionGridPalette.ghostFill, 0.2);
    this.graphics.fillRoundedRect(
      rect.x + padding,
      rect.y + padding,
      rect.width - padding * 2,
      rect.height - padding * 2,
      cornerRadius,
    );
    this.graphics.lineStyle(3, constructionGridPalette.ghostStroke, 0.82);
    this.graphics.strokeRoundedRect(
      rect.x + padding,
      rect.y + padding,
      rect.width - padding * 2,
      rect.height - padding * 2,
      cornerRadius,
    );
  }

  private drawPlacementGhost(
    gridArea: GridArea,
    piece: GalleryPiece,
    canPlace: boolean,
  ): void {
    const rect = this.getGalleryRect(gridArea, piece);
    const padding = gridArea.cellSize * 0.16;
    const cornerRadius = gridArea.cellSize * 0.2;
    const fillColor = canPlace
      ? constructionGridPalette.ghostFill
      : constructionGridPalette.ghostBlockedFill;
    const strokeColor = canPlace
      ? constructionGridPalette.ghostStroke
      : constructionGridPalette.ghostBlockedStroke;

    this.graphics.fillStyle(fillColor, canPlace ? 0.42 : 0.32);
    this.graphics.fillRoundedRect(
      rect.x + padding,
      rect.y + padding,
      rect.width - padding * 2,
      rect.height - padding * 2,
      cornerRadius,
    );
    this.graphics.lineStyle(2, strokeColor, 0.78);
    this.graphics.strokeRoundedRect(
      rect.x + padding,
      rect.y + padding,
      rect.width - padding * 2,
      rect.height - padding * 2,
      cornerRadius,
    );
  }

  private drawSelectedGridCell(
    gridArea: GridArea,
    selectedPosition: ConstructionGridPosition | undefined,
    selectedPieceType: ConstructionPieceType,
  ): void {
    if (selectedPosition === undefined) {
      return;
    }

    const x = gridArea.x + selectedPosition.column * gridArea.cellSize;
    const y = gridArea.y + selectedPosition.row * gridArea.cellSize;
    const isBlocked = !this.canPlaceConstructionPieceAtPosition(
      selectedPosition,
      selectedPieceType,
    );
    const selectionColor = isBlocked
      ? constructionGridPalette.gridBlockedSelection
      : constructionGridPalette.gridSelection;

    this.graphics.fillStyle(selectionColor, 0.14);
    this.graphics.fillRect(x, y, gridArea.cellSize, gridArea.cellSize);
    this.graphics.lineStyle(3, selectionColor, 0.78);
    this.graphics.strokeRect(x, y, gridArea.cellSize, gridArea.cellSize);
  }

  private drawSelectedPiece(
    gridArea: GridArea,
    selectedPosition: ConstructionGridPosition | undefined,
  ): void {
    if (selectedPosition === undefined) {
      return;
    }

    const piece = this.findPieceAtPosition(selectedPosition);

    if (piece === undefined) {
      return;
    }

    const rect = this.getGalleryRect(gridArea, piece);
    const padding = gridArea.cellSize * 0.06;
    const cornerRadius = this.isRoomPiece(piece)
      ? gridArea.cellSize * 0.32
      : gridArea.cellSize * 0.16;

    this.graphics.lineStyle(3, constructionGridPalette.pieceSelection, 0.94);
    this.graphics.strokeRoundedRect(
      rect.x + padding,
      rect.y + padding,
      rect.width - padding * 2,
      rect.height - padding * 2,
      cornerRadius,
    );
    this.graphics.lineStyle(1, constructionGridPalette.pieceSelection, 0.42);
    this.graphics.strokeRoundedRect(
      rect.x + padding * 2,
      rect.y + padding * 2,
      rect.width - padding * 4,
      rect.height - padding * 4,
      cornerRadius * 0.75,
    );
  }

  private drawSelectedInfoLabel(
    gridArea: GridArea,
    selectedPosition: ConstructionGridPosition | undefined,
  ): void {
    if (selectedPosition === undefined) {
      return;
    }

    const piece = this.findPieceAtPosition(selectedPosition);

    if (piece === undefined) {
      return;
    }

    const label = this.gameObjects.text(
      gridArea.x + gridArea.width,
      gridArea.y - gridArea.cellSize * 0.22,
      this.getSelectedPieceLabel(piece),
      {
        color: constructionGridPalette.textWarning,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(10, Math.round(gridArea.cellSize * 0.16))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    label.setOrigin(1, 0.5);
    label.setShadow(
      1,
      1,
      constructionGridPalette.textShadow,
      2,
      true,
      true,
    );
    label.setDepth(1);
    this.selectedInfoLabel = label;
  }

  private drawNetworkStatusLabel(
    gridArea: GridArea,
    floatingMenuOffsetX: number,
  ): void {
    const layout = this.getFloatingMenuLayout(gridArea, floatingMenuOffsetX);
    const connectedPieceIds = this.getQueenNetworkPieceIds();
    const isolatedPieceCount =
      this.constructionGrid.pieces.length - connectedPieceIds.size;
    const queenChamber = this.findQueenChamber();
    const isNetworkComplete =
      queenChamber !== undefined && isolatedPieceCount === 0;
    const indicatorRadius = Math.max(5, gridArea.cellSize * 0.085);
    const indicatorX = layout.contentX + indicatorRadius;
    const indicatorY = layout.networkY;
    const indicatorColor = isNetworkComplete
      ? constructionGridPalette.networkConnected
      : constructionGridPalette.networkDisconnected;

    this.graphics.fillStyle(indicatorColor, 0.95);
    this.graphics.fillCircle(indicatorX, indicatorY, indicatorRadius);
    this.graphics.lineStyle(2, constructionGridPalette.ghostStroke, 0.35);
    this.graphics.strokeCircle(indicatorX, indicatorY, indicatorRadius);

    const label = this.gameObjects.text(
      indicatorX + indicatorRadius * 2.2,
      indicatorY,
      this.getQueenNetworkStatusText(queenChamber, isolatedPieceCount),
      {
        color: isNetworkComplete
          ? '#9fbf73'
          : constructionGridPalette.entranceTextFull,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(10, Math.round(gridArea.cellSize * 0.16))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    label.setOrigin(0, 0.5);
    label.setShadow(
      1,
      1,
      constructionGridPalette.textShadow,
      2,
      true,
      true,
    );
    label.setDepth(1);
    this.networkStatusLabel = label;
  }

  private getQueenNetworkStatusText(
    queenChamber: GalleryPiece | undefined,
    isolatedPieceCount: number,
  ): string {
    if (queenChamber === undefined) {
      return 'Reine absente';
    }

    if (isolatedPieceCount === 0) {
      return 'R\u00e9seau reine complet';
    }

    return `Hors r\u00e9seau reine : ${isolatedPieceCount}`;
  }

  private getSelectedPieceLabel(piece: GalleryPiece): string {
    if (!this.isRoomPiece(piece)) {
      return 'S\u00e9lection : Galerie';
    }

    const definition = piece.definitionId
      ? findGalleryPieceDefinition(piece.definitionId)
      : undefined;
    const pieceLabel = definition?.label ?? 'Pi\u00e8ce';

    if (piece.entranceLimit === undefined) {
      return `S\u00e9lection : ${pieceLabel}`;
    }

    const entranceCount = countGalleryPieceEntrances(
      this.constructionGrid,
      piece,
    );

    return `S\u00e9lection : ${pieceLabel} - ${entranceCount}/${piece.entranceLimit} entr\u00e9es`;
  }

  private getGridPositionAtPoint(
    gridArea: GridArea,
    point: ConstructionGridPointer,
  ): ConstructionGridPosition | undefined {
    const column = Math.floor((point.x - gridArea.x) / gridArea.cellSize);
    const row = Math.floor((point.y - gridArea.y) / gridArea.cellSize);

    if (
      column < 0 ||
      row < 0 ||
      column >= constructionGridLayout.columns ||
      row >= constructionGridLayout.rows
    ) {
      return undefined;
    }

    return { column, row };
  }

  private drawGalleryPieces(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
  ): void {
    this.drawGalleryLayer(
      gridArea,
      pieces,
      constructionGridPalette.galleryShadow,
      0.4,
      1.4,
    );
    this.drawGalleryLayer(
      gridArea,
      pieces,
      constructionGridPalette.galleryFill,
      0.82,
      1,
    );
    this.drawRoomSurfaces(gridArea, pieces);
    this.drawGalleryHighlights(gridArea, pieces);
    this.drawGalleryOuterBorders(gridArea, pieces);
    this.drawNetworkStatusHighlights(gridArea, pieces);
    this.drawRoomEntranceMarkers(gridArea, pieces);
    this.drawRoomEntranceCounters(gridArea, pieces);
  }

  public destroy(): void {
    this.clearActionHintLabel();
    this.clearEntranceCounterLabels();
    this.clearNetworkStatusLabel();
    this.clearQueenStatusLabel();
    this.clearSelectedInfoLabel();
    this.clearToolModeLabel();
  }

  private drawRoomSurfaces(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
  ): void {
    const roomPieces = pieces.filter((piece) => this.isRoomPiece(piece));
    const padding = gridArea.cellSize * 0.08;
    const cornerRadius = gridArea.cellSize * 0.34;

    roomPieces.forEach((piece) => {
      const rect = this.getGalleryRect(gridArea, piece);
      const visualStyle = this.getRoomVisualStyle(piece);

      this.graphics.fillStyle(visualStyle.fillColor, 0.9);
      this.graphics.fillRoundedRect(
        rect.x + padding,
        rect.y + padding,
        rect.width - padding * 2,
        rect.height - padding * 2,
        cornerRadius,
      );
      this.graphics.fillStyle(constructionGridPalette.roomInnerShadow, 0.26);
      this.graphics.fillEllipse(
        rect.x + rect.width / 2,
        rect.y + rect.height * 0.58,
        rect.width * 0.72,
        rect.height * 0.52,
      );
      this.graphics.fillStyle(constructionGridPalette.roomHighlight, 0.12);
      this.graphics.fillEllipse(
        rect.x + rect.width / 2,
        rect.y + rect.height * 0.34,
        rect.width * 0.6,
        rect.height * 0.22,
      );
      this.drawRoomTypeMarker(gridArea, piece, rect, visualStyle);
    });
  }

  private getRoomVisualStyle(piece: GalleryPiece): RoomVisualStyle {
    if (piece.definitionId !== undefined && piece.definitionId in roomVisualStyles) {
      return roomVisualStyles[piece.definitionId];
    }

    return {
      accentColor: constructionGridPalette.roomHighlight,
      fillColor: constructionGridPalette.roomFill,
    };
  }

  private drawRoomTypeMarker(
    gridArea: GridArea,
    piece: GalleryPiece,
    rect: GalleryRect,
    visualStyle: RoomVisualStyle,
  ): void {
    if (piece.definitionId === 'brood-chamber') {
      this.drawBroodChamberMarker(gridArea, rect, visualStyle);
      return;
    }

    if (piece.definitionId === 'barracks') {
      this.drawBarracksMarker(gridArea, rect, visualStyle);
      return;
    }

    if (piece.definitionId === 'storage') {
      this.drawStorageMarker(gridArea, rect, visualStyle);
      return;
    }

    if (piece.definitionId === 'fungus-farm') {
      this.drawFungusFarmMarker(gridArea, rect, visualStyle);
    }
  }

  private drawBroodChamberMarker(
    gridArea: GridArea,
    rect: GalleryRect,
    visualStyle: RoomVisualStyle,
  ): void {
    const eggWidth = gridArea.cellSize * 0.18;
    const eggHeight = gridArea.cellSize * 0.26;
    const centerY = rect.y + rect.height * 0.5;
    const centerX = rect.x + rect.width * 0.5;

    this.graphics.fillStyle(0xf4dfb0, 0.88);
    [-0.22, 0, 0.22].forEach((offset) => {
      this.graphics.fillEllipse(
        centerX + rect.width * offset,
        centerY + Math.abs(offset) * gridArea.cellSize * 0.18,
        eggWidth,
        eggHeight,
      );
    });
    this.graphics.lineStyle(1, visualStyle.accentColor, 0.42);
    this.graphics.strokeEllipse(centerX, centerY, rect.width * 0.52, rect.height * 0.26);
  }

  private drawBarracksMarker(
    gridArea: GridArea,
    rect: GalleryRect,
    visualStyle: RoomVisualStyle,
  ): void {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const length = gridArea.cellSize * 0.58;
    const guard = gridArea.cellSize * 0.1;

    this.graphics.lineStyle(4, visualStyle.accentColor, 0.72);
    this.graphics.lineBetween(
      centerX - length / 2,
      centerY + length / 2,
      centerX + length / 2,
      centerY - length / 2,
    );
    this.graphics.lineBetween(
      centerX - length / 2,
      centerY - length / 2,
      centerX + length / 2,
      centerY + length / 2,
    );
    this.graphics.lineStyle(2, 0x24160d, 0.8);
    this.graphics.lineBetween(centerX - guard, centerY, centerX + guard, centerY);
  }

  private drawStorageMarker(
    gridArea: GridArea,
    rect: GalleryRect,
    visualStyle: RoomVisualStyle,
  ): void {
    const boxSize = gridArea.cellSize * 0.3;
    const gap = gridArea.cellSize * 0.06;
    const startX = rect.x + rect.width / 2 - boxSize - gap / 2;
    const startY = rect.y + rect.height / 2 - boxSize / 2;
    const cornerRadius = gridArea.cellSize * 0.04;

    this.graphics.fillStyle(visualStyle.accentColor, 0.36);
    this.graphics.lineStyle(2, visualStyle.accentColor, 0.62);
    [0, 1].forEach((index) => {
      const x = startX + index * (boxSize + gap);

      this.graphics.fillRoundedRect(x, startY, boxSize, boxSize, cornerRadius);
      this.graphics.strokeRoundedRect(x, startY, boxSize, boxSize, cornerRadius);
      this.graphics.lineBetween(x, startY + boxSize * 0.36, x + boxSize, startY + boxSize * 0.36);
    });
  }

  private drawFungusFarmMarker(
    gridArea: GridArea,
    rect: GalleryRect,
    visualStyle: RoomVisualStyle,
  ): void {
    const stemWidth = gridArea.cellSize * 0.09;
    const stemHeight = gridArea.cellSize * 0.25;
    const capWidth = gridArea.cellSize * 0.34;
    const capHeight = gridArea.cellSize * 0.18;
    const centerX = rect.x + rect.width / 2;
    const baseY = rect.y + rect.height * 0.62;

    this.graphics.fillStyle(0xe5dcc2, 0.76);
    this.graphics.fillRoundedRect(
      centerX - stemWidth / 2,
      baseY - stemHeight,
      stemWidth,
      stemHeight,
      stemWidth / 2,
    );
    this.graphics.fillStyle(visualStyle.accentColor, 0.78);
    this.graphics.fillEllipse(
      centerX,
      baseY - stemHeight,
      capWidth,
      capHeight,
    );
    this.graphics.fillCircle(
      centerX - capWidth * 0.18,
      baseY - stemHeight - capHeight * 0.05,
      gridArea.cellSize * 0.025,
    );
    this.graphics.fillCircle(
      centerX + capWidth * 0.16,
      baseY - stemHeight + capHeight * 0.08,
      gridArea.cellSize * 0.022,
    );
  }

  private drawQueenAnchor(gridArea: GridArea): void {
    const queenChamber = this.findQueenChamber();

    if (queenChamber === undefined) {
      return;
    }

    const rect = this.getGalleryRect(gridArea, queenChamber);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const bodyWidth = rect.width * 0.36;
    const bodyHeight = rect.height * 0.28;
    const headRadius = Math.max(4, gridArea.cellSize * 0.12);

    this.graphics.fillStyle(constructionGridPalette.queenBody, 0.9);
    this.graphics.fillEllipse(
      centerX,
      centerY + bodyHeight * 0.22,
      bodyWidth,
      bodyHeight,
    );
    this.graphics.fillStyle(constructionGridPalette.queenAccent, 0.92);
    this.graphics.fillCircle(centerX, centerY - bodyHeight * 0.3, headRadius);
    this.graphics.lineStyle(2, constructionGridPalette.queenAccent, 0.72);
    this.graphics.lineBetween(
      centerX - headRadius * 1.4,
      centerY - bodyHeight * 0.85,
      centerX,
      centerY - bodyHeight * 1.18,
    );
    this.graphics.lineBetween(
      centerX,
      centerY - bodyHeight * 1.18,
      centerX + headRadius * 1.4,
      centerY - bodyHeight * 0.85,
    );
    this.drawQueenStatusLabel(gridArea, rect);
  }

  private drawQueenStatusLabel(
    gridArea: GridArea,
    rect: GalleryRect,
  ): void {
    const queenNetworkPieceIds = this.getQueenNetworkPieceIds();
    const isNetworkComplete =
      queenNetworkPieceIds.size === this.constructionGrid.pieces.length;
    const label = this.gameObjects.text(
      rect.x + rect.width / 2,
      rect.y - gridArea.cellSize * 0.18,
      isNetworkComplete ? 'Connect\u00e9' : 'Non connect\u00e9',
      {
        color: isNetworkComplete
          ? '#9fbf73'
          : constructionGridPalette.entranceTextFull,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(9, Math.round(gridArea.cellSize * 0.13))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    label.setOrigin(0.5);
    label.setShadow(
      1,
      1,
      constructionGridPalette.textShadow,
      2,
      true,
      true,
    );
    label.setDepth(1);
    this.queenStatusLabel = label;
  }

  private drawGalleryLayer(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
    color: number,
    alpha: number,
    shadowOffsetMultiplier: number,
  ): void {
    const padding = gridArea.cellSize * 0.1;
    const cornerRadius = gridArea.cellSize * 0.28;
    const yOffset = padding * (shadowOffsetMultiplier - 1);

    this.graphics.fillStyle(color, alpha);

    pieces.forEach((piece) => {
      const rect = this.getGalleryRect(gridArea, piece);

      this.graphics.fillRoundedRect(
        rect.x + padding,
        rect.y + padding + yOffset,
        rect.width - padding * 2,
        rect.height - padding * 2,
        cornerRadius,
      );
    });

    this.drawGalleryConnectors(gridArea, pieces, color, alpha, yOffset);
  }

  private drawGalleryConnectors(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
    color: number,
    alpha: number,
    yOffset: number,
  ): void {
    const thickness = gridArea.cellSize * 0.8;

    this.graphics.fillStyle(color, alpha);

    pieces.forEach((piece) => {
      pieces.forEach((candidate) => {
        if (
          piece.id >= candidate.id ||
          !areGalleryPiecesConnected(piece, candidate)
        ) {
          return;
        }

        const connection = this.findConnectionPositions(piece, candidate);

        if (connection === undefined) {
          return;
        }

        const firstCenter = this.getCellCenter(
          gridArea,
          connection.firstPosition,
        );
        const secondCenter = this.getCellCenter(
          gridArea,
          connection.secondPosition,
        );
        const isHorizontal = firstCenter.y === secondCenter.y;

        if (isHorizontal) {
          this.graphics.fillRect(
            Math.min(firstCenter.x, secondCenter.x),
            firstCenter.y - thickness / 2 + yOffset,
            Math.abs(firstCenter.x - secondCenter.x),
            thickness,
          );
          return;
        }

        this.graphics.fillRect(
          firstCenter.x - thickness / 2,
          Math.min(firstCenter.y, secondCenter.y) + yOffset,
          thickness,
          Math.abs(firstCenter.y - secondCenter.y),
        );
      });
    });
  }

  private drawGalleryHighlights(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
  ): void {
    const padding = gridArea.cellSize * 0.1;
    const cornerRadius = gridArea.cellSize * 0.18;

    this.graphics.fillStyle(constructionGridPalette.galleryHighlight, 0.12);

    pieces.forEach((piece) => {
      const rect = this.getGalleryRect(gridArea, piece);

      this.graphics.fillRoundedRect(
        rect.x + padding * 1.7,
        rect.y + padding * 1.55,
        rect.width - padding * 3.4,
        rect.height * 0.22,
        cornerRadius,
      );
    });
  }

  private drawGalleryOuterBorders(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
  ): void {
    this.graphics.lineStyle(2, constructionGridPalette.galleryBorder, 0.72);

    pieces.forEach((piece) => {
      this.drawGalleryPieceOuterBorders(gridArea, piece, pieces);
    });
  }

  private drawNetworkStatusHighlights(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
  ): void {
    const connectedPieceIds = this.getQueenNetworkPieceIds();

    pieces.forEach((piece) => {
      const isConnected = connectedPieceIds.has(piece.id);
      const color = isConnected
        ? constructionGridPalette.networkConnected
        : constructionGridPalette.networkDisconnected;
      const alpha = isConnected ? 0.34 : 0.42;

      this.drawNetworkStatusHighlight(gridArea, piece, color, alpha);
    });
  }

  private drawNetworkStatusHighlight(
    gridArea: GridArea,
    piece: GalleryPiece,
    color: number,
    alpha: number,
  ): void {
    const rect = this.getGalleryRect(gridArea, piece);
    const padding = gridArea.cellSize * 0.04;
    const cornerRadius = this.isRoomPiece(piece)
      ? gridArea.cellSize * 0.28
      : gridArea.cellSize * 0.1;

    this.graphics.lineStyle(2, color, alpha);
    this.graphics.strokeRoundedRect(
      rect.x + padding,
      rect.y + padding,
      rect.width - padding * 2,
      rect.height - padding * 2,
      cornerRadius,
    );
  }

  private drawRoomEntranceMarkers(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
  ): void {
    const markerRadius = Math.max(3, gridArea.cellSize * 0.075);

    pieces
      .filter((piece) => this.isRoomPiece(piece))
      .forEach((roomPiece) => {
        const markers = this.getRoomEntranceMarkers(
          gridArea,
          roomPiece,
          pieces,
        );
        const markerColor = this.isRoomEntranceLimitReached(roomPiece)
          ? constructionGridPalette.entranceMarkerFull
          : constructionGridPalette.entranceMarker;

        markers.forEach((marker) => {
          this.graphics.fillStyle(markerColor, 0.9);
          this.graphics.fillCircle(marker.x, marker.y, markerRadius);
          this.graphics.lineStyle(
            2,
            constructionGridPalette.entranceMarkerBorder,
            0.74,
          );
          this.graphics.strokeCircle(marker.x, marker.y, markerRadius);
        });
      });
  }

  private getRoomEntranceMarkers(
    gridArea: GridArea,
    roomPiece: GalleryPiece,
    pieces: readonly GalleryPiece[],
  ): readonly EntranceMarker[] {
    const markers: EntranceMarker[] = [];
    const roomPositions = getGalleryPieceOccupiedPositions(roomPiece);

    pieces.forEach((candidate) => {
      if (candidate.id === roomPiece.id) {
        return;
      }

      getGalleryPieceOccupiedPositions(candidate).forEach(
        (candidatePosition) => {
          roomPositions.forEach((roomPosition) => {
            try {
              const direction = getDirectionBetweenAdjacentPositions(
                roomPosition,
                candidatePosition,
              );

              markers.push(
                this.getEntranceMarkerPosition(gridArea, roomPosition, direction),
              );
            } catch (error) {
              if (!(error instanceof RangeError)) {
                throw error;
              }
            }
          });
        },
      );
    });

    return markers;
  }

  private getEntranceMarkerPosition(
    gridArea: GridArea,
    roomPosition: ConstructionGridPosition,
    direction: GridDirection,
  ): EntranceMarker {
    const center = this.getCellCenter(gridArea, roomPosition);
    const offset = gridArea.cellSize * 0.5;

    switch (direction) {
      case GridDirection.Down:
        return { x: center.x, y: center.y + offset };
      case GridDirection.Left:
        return { x: center.x - offset, y: center.y };
      case GridDirection.Right:
        return { x: center.x + offset, y: center.y };
      case GridDirection.Up:
        return { x: center.x, y: center.y - offset };
    }
  }

  private drawGalleryPieceOuterBorders(
    gridArea: GridArea,
    piece: GalleryPiece,
    pieces: readonly GalleryPiece[],
  ): void {
    if (piece.size.columns === 1 && piece.size.rows === 1) {
      this.drawStraightGalleryPieceOuterBorders(gridArea, piece, pieces);
      return;
    }

    this.drawRoundedGalleryPieceOuterBorders(gridArea, piece, pieces);
  }

  private drawStraightGalleryPieceOuterBorders(
    gridArea: GridArea,
    piece: GalleryPiece,
    pieces: readonly GalleryPiece[],
  ): void {
    const rect = this.getGalleryRect(gridArea, piece);
    const padding = gridArea.cellSize * 0.1;
    const hasUp = this.hasConnectedNeighbor(piece, pieces, GridDirection.Up);
    const hasRight = this.hasConnectedNeighbor(
      piece,
      pieces,
      GridDirection.Right,
    );
    const hasDown = this.hasConnectedNeighbor(
      piece,
      pieces,
      GridDirection.Down,
    );
    const hasLeft = this.hasConnectedNeighbor(
      piece,
      pieces,
      GridDirection.Left,
    );
    const startX = rect.x + (hasLeft ? 0 : padding);
    const endX = rect.x + rect.width - (hasRight ? 0 : padding);
    const startY = rect.y + (hasUp ? 0 : padding);
    const endY = rect.y + rect.height - (hasDown ? 0 : padding);

    if (!hasUp) {
      this.graphics.lineBetween(
        startX,
        rect.y + padding,
        endX,
        rect.y + padding,
      );
    }

    if (!hasRight) {
      this.graphics.lineBetween(
        rect.x + rect.width - padding,
        startY,
        rect.x + rect.width - padding,
        endY,
      );
    }

    if (!hasDown) {
      this.graphics.lineBetween(
        startX,
        rect.y + rect.height - padding,
        endX,
        rect.y + rect.height - padding,
      );
    }

    if (!hasLeft) {
      this.graphics.lineBetween(
        rect.x + padding,
        startY,
        rect.x + padding,
        endY,
      );
    }
  }

  private drawRoundedGalleryPieceOuterBorders(
    gridArea: GridArea,
    piece: GalleryPiece,
    pieces: readonly GalleryPiece[],
  ): void {
    const rect = this.getGalleryRect(gridArea, piece);
    const padding = gridArea.cellSize * 0.1;
    const cornerRadius = gridArea.cellSize * 0.28;
    const hasUp = this.hasConnectedNeighbor(piece, pieces, GridDirection.Up);
    const hasRight = this.hasConnectedNeighbor(
      piece,
      pieces,
      GridDirection.Right,
    );
    const hasDown = this.hasConnectedNeighbor(
      piece,
      pieces,
      GridDirection.Down,
    );
    const hasLeft = this.hasConnectedNeighbor(
      piece,
      pieces,
      GridDirection.Left,
    );

    this.graphics.strokeRoundedRect(
      rect.x + padding,
      rect.y + padding,
      rect.width - padding * 2,
      rect.height - padding * 2,
      cornerRadius,
    );

    this.eraseConnectedBorderSeams(gridArea, rect, {
      down: hasDown,
      left: hasLeft,
      right: hasRight,
      up: hasUp,
    });
  }

  private drawRoomEntranceCounters(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
  ): void {
    pieces
      .filter(
        (piece) => this.isRoomPiece(piece) && piece.entranceLimit !== undefined,
      )
      .forEach((roomPiece) => {
        const rect = this.getGalleryRect(gridArea, roomPiece);
        const usedEntrances = countGalleryPieceEntrances(
          this.constructionGrid,
          roomPiece,
        );
        const entranceLimit = roomPiece.entranceLimit;

        if (entranceLimit === undefined) {
          return;
        }

        const counterColor =
          usedEntrances >= entranceLimit
            ? constructionGridPalette.entranceTextFull
            : constructionGridPalette.textWarning;

        const label = this.gameObjects.text(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          `${usedEntrances}/${entranceLimit}`,
          {
            color: counterColor,
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: `${Math.max(10, Math.round(gridArea.cellSize * 0.22))}px`,
            fontStyle: '700',
        resolution: constructionTextResolution,
          },
        );

        label.setOrigin(0.5);
        label.setShadow(
          1,
          1,
          constructionGridPalette.textShadow,
          2,
          true,
          true,
        );
        label.setDepth(1);
        this.entranceCounterLabels.push(label);
      });
  }

  private isRoomEntranceLimitReached(roomPiece: GalleryPiece): boolean {
    const entranceLimit = roomPiece.entranceLimit;

    return (
      entranceLimit !== undefined &&
      countGalleryPieceEntrances(this.constructionGrid, roomPiece) >=
        entranceLimit
    );
  }

  private clearEntranceCounterLabels(): void {
    this.entranceCounterLabels.forEach((label) => {
      label.destroy();
    });
    this.entranceCounterLabels = [];
  }

  private clearActionHintLabel(): void {
    this.actionHintLabel?.destroy();
    this.actionHintLabel = undefined;
  }

  private clearNetworkStatusLabel(): void {
    this.networkStatusLabel?.destroy();
    this.networkStatusLabel = undefined;
  }

  private clearQueenStatusLabel(): void {
    this.queenStatusLabel?.destroy();
    this.queenStatusLabel = undefined;
  }

  private clearToolModeLabel(): void {
    this.toolModeLabel?.destroy();
    this.toolModeLabel = undefined;
  }

  private clearSelectedInfoLabel(): void {
    this.selectedInfoLabel?.destroy();
    this.selectedInfoLabel = undefined;
  }

  private eraseConnectedBorderSeams(
    gridArea: GridArea,
    rect: GalleryRect,
    connectedDirections: {
      readonly down: boolean;
      readonly left: boolean;
      readonly right: boolean;
      readonly up: boolean;
    },
  ): void {
    const padding = gridArea.cellSize * 0.1;
    const seamThickness = 4;

    this.graphics.fillStyle(constructionGridPalette.galleryFill, 0.92);

    if (connectedDirections.up) {
      this.graphics.fillRect(
        rect.x + padding,
        rect.y + padding - seamThickness / 2,
        rect.width - padding * 2,
        seamThickness,
      );
    }

    if (connectedDirections.right) {
      this.graphics.fillRect(
        rect.x + rect.width - padding - seamThickness / 2,
        rect.y + padding,
        seamThickness,
        rect.height - padding * 2,
      );
    }

    if (connectedDirections.down) {
      this.graphics.fillRect(
        rect.x + padding,
        rect.y + rect.height - padding - seamThickness / 2,
        rect.width - padding * 2,
        seamThickness,
      );
    }

    if (connectedDirections.left) {
      this.graphics.fillRect(
        rect.x + padding - seamThickness / 2,
        rect.y + padding,
        seamThickness,
        rect.height - padding * 2,
      );
    }
  }

  private hasConnectedNeighbor(
    piece: GalleryPiece,
    pieces: readonly GalleryPiece[],
    direction: GridDirection,
  ): boolean {
    return pieces.some((candidate) => {
      if (
        candidate.id === piece.id ||
        !areGalleryPiecesConnected(piece, candidate)
      ) {
        return false;
      }

      const connection = this.findConnectionPositions(piece, candidate);

      return (
        connection !== undefined &&
        getDirectionBetweenAdjacentPositions(
          connection.firstPosition,
          connection.secondPosition,
        ) === direction
      );
    });
  }

  private findConnectionPositions(
    firstPiece: GalleryPiece,
    secondPiece: GalleryPiece,
  ):
    | {
        readonly firstPosition: ConstructionGridPosition;
        readonly secondPosition: ConstructionGridPosition;
      }
    | undefined {
    for (const firstPosition of getGalleryPieceOccupiedPositions(firstPiece)) {
      for (const secondPosition of getGalleryPieceOccupiedPositions(
        secondPiece,
      )) {
        try {
          getDirectionBetweenAdjacentPositions(firstPosition, secondPosition);

          return {
            firstPosition,
            secondPosition,
          };
        } catch (error) {
          if (!(error instanceof RangeError)) {
            throw error;
          }
        }
      }
    }

    return undefined;
  }

  private getGalleryRect(gridArea: GridArea, piece: GalleryPiece): GalleryRect {
    return {
      height: piece.size.rows * gridArea.cellSize,
      width: piece.size.columns * gridArea.cellSize,
      x: gridArea.x + piece.position.column * gridArea.cellSize,
      y: gridArea.y + piece.position.row * gridArea.cellSize,
    };
  }

  private isRoomPiece(piece: GalleryPiece): boolean {
    return piece.size.columns > 1 || piece.size.rows > 1;
  }

  private drawConduit(
    gridArea: GridArea,
    conduit: ConstructionGridConduit,
  ): void {
    const center = this.getCellCenter(gridArea, conduit.position);
    const radius = gridArea.cellSize * 0.34;

    this.graphics.fillStyle(constructionGridPalette.conduitFill, 0.95);
    this.graphics.fillCircle(center.x, center.y, radius);
    this.graphics.lineStyle(3, constructionGridPalette.conduitBorder, 0.76);
    this.graphics.strokeCircle(center.x, center.y, radius);
    this.graphics.fillStyle(constructionGridPalette.conduitInner, 0.95);
    this.graphics.fillCircle(center.x, center.y, radius * 0.55);
    this.drawConduitDirection(
      center.x,
      center.y,
      radius,
      conduit.direction,
      constructionGridPalette.conduitBorder,
    );
  }

  private getCellCenter(
    gridArea: GridArea,
    position: { readonly column: number; readonly row: number },
  ): { readonly x: number; readonly y: number } {
    return {
      x: gridArea.x + (position.column + 0.5) * gridArea.cellSize,
      y: gridArea.y + (position.row + 0.5) * gridArea.cellSize,
    };
  }

  private drawConduitDirection(
    x: number,
    y: number,
    radius: number,
    direction: GridDirection,
    color: number,
  ): void {
    const angle = this.getDirectionAngle(direction);
    const arrowLength = radius * 0.85;
    const endX = x + Math.cos(angle) * arrowLength;
    const endY = y + Math.sin(angle) * arrowLength;

    this.graphics.lineStyle(2, color, 0.85);
    this.graphics.lineBetween(x, y, endX, endY);
  }

  private getDirectionAngle(direction: GridDirection): number {
    switch (direction) {
      case GridDirection.Down:
        return this.Phaser.Math.DegToRad(90);
      case GridDirection.Left:
        return this.Phaser.Math.DegToRad(180);
      case GridDirection.Right:
        return this.Phaser.Math.DegToRad(0);
      case GridDirection.Up:
        return this.Phaser.Math.DegToRad(270);
    }
  }
}

