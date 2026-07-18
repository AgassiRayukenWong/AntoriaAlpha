import type {
  ColonyEconomySnapshot,
  ColonyRoomCounts,
  ColonyRoomUpgradeTotals,
} from '@/game/simulation/colony-economy';
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
import {
  getRoomUpgradeRequirement,
  isRoomUpgradeable,
} from '@/game/simulation/room-upgrades';
import type {
  SurfaceDefenseSnapshot,
  SurfaceThreatSnapshot,
} from '@/game/simulation/surface-defense';
import { getConstructionCost } from '@/game/simulation/construction-costs';

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

export interface PieceUpgradeRequest {
  readonly currentLevel: number;
  readonly definitionId: string;
}

export interface ConstructionGridPointer {
  readonly x: number;
  readonly y: number;
}

export enum ConstructionToolMode {
  Build = 'build',
  Destroy = 'destroy',
  Improve = 'improve',
}

export enum ConstructionPieceType {
  Barracks = 'barracks',
  BroodChamber = 'brood-chamber',
  FungusFarm = 'fungus-farm',
  Gallery = 'gallery',
  Storage = 'storage',
}

const constructionGridPalette = {
  antBody: 0x1f140d,
  antHighlight: 0x8f6a3d,
  egg: 0xf1dfb4,
  fungusGlow: 0x93b85d,
  storageCrate: 0xc49a57,
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
  improveAvailable: 0xf0c76a,
  improveBlocked: 0x7b6c57,
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
  [ConstructionToolMode.Improve]: 'Am\u00e9liorer',
} as const satisfies Record<ConstructionToolMode, string>;

const constructionTextResolution = 2;

const constructionPieceTypeLabels = {
  [ConstructionPieceType.Gallery]: {
    keyLabel: '1',
    nameLabel: 'Galerie',
  },
  [ConstructionPieceType.BroodChamber]: {
    keyLabel: '2',
    nameLabel: 'Ponte',
  },
  [ConstructionPieceType.Barracks]: {
    keyLabel: '3',
    nameLabel: 'Caserne',
  },
  [ConstructionPieceType.Storage]: {
    keyLabel: '4',
    nameLabel: 'Entrep\u00f4t',
  },
  [ConstructionPieceType.FungusFarm]: {
    keyLabel: '5',
    nameLabel: 'Champi',
  },
} as const satisfies Record<
  ConstructionPieceType,
  {
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
    position: { column: 8, row: -1 },
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
      position: { column: 8, row: 0 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-vertical',
      pieceId: 'sample-gallery-2',
      position: { column: 8, row: 1 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-vertical',
      pieceId: 'sample-gallery-3',
      position: { column: 8, row: 2 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'cross',
      pieceId: 'sample-gallery-4',
      position: { column: 8, row: 3 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-horizontal',
      pieceId: 'sample-gallery-5',
      position: { column: 7, row: 3 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'brood-chamber',
      pieceId: 'sample-brood-chamber',
      position: { column: 9, row: 2 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'queen-chamber',
      pieceId: queenChamberPieceId,
      position: { column: 5, row: 2 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-vertical',
      pieceId: 'sample-gallery-7',
      position: { column: 8, row: 4 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'cross',
      pieceId: 'sample-gallery-8',
      position: { column: 8, row: 5 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-vertical',
      pieceId: 'sample-gallery-9',
      position: { column: 8, row: 6 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-vertical',
      pieceId: 'sample-gallery-10',
      position: { column: 8, row: 7 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-horizontal',
      pieceId: 'sample-gallery-11',
      position: { column: 7, row: 5 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-horizontal',
      pieceId: 'sample-gallery-12',
      position: { column: 6, row: 5 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'storage',
      pieceId: 'sample-storage',
      position: { column: 4, row: 5 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-horizontal',
      pieceId: 'sample-gallery-13',
      position: { column: 9, row: 5 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'fungus-farm',
      pieceId: 'sample-fungus-farm',
      position: { column: 10, row: 5 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'barracks',
      pieceId: 'sample-barracks',
      position: { column: 7, row: 8 },
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
  private colonySnapshot?: ColonyEconomySnapshot;
  private constructionGrid: ConstructionGrid;
  private entranceCounterLabels: PhaserType.GameObjects.Text[] = [];
  private hoveredInfoLabel?: PhaserType.GameObjects.Text;
  private floatingMenuRect?: FloatingMenuRect;
  private floatingMenuToggleArea?: FloatingMenuToggleArea;
  private networkStatusLabel?: PhaserType.GameObjects.Text;
  private constructionPieceButtonAreas: readonly ConstructionPieceButtonArea[] =
    [];
  private queenStatusLabel?: PhaserType.GameObjects.Text;
  private selectedInfoLabel?: PhaserType.GameObjects.Text;
  private toolButtonAreas: readonly ToolButtonArea[] = [];
  private toolModeLabel?: PhaserType.GameObjects.Text;
  private readonly pieceLevels = new Map<string, number>();
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
    antAnimationTimeMs = 0,
    colonySnapshot?: ColonyEconomySnapshot,
    surfaceDefenseSnapshot?: SurfaceDefenseSnapshot,
  ): void {
    this.colonySnapshot = colonySnapshot;
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
    this.clearHoveredInfoLabel();
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
    this.drawSelectedGridCell(
      gridArea,
      selectedPosition,
      toolMode,
      selectedPieceType,
    );
    this.drawGalleryPieces(gridArea, this.constructionGrid.pieces);
    if (toolMode === ConstructionToolMode.Improve) {
      this.drawImproveModeRoomStates(gridArea, this.constructionGrid.pieces);
    }
    this.drawQueenAnchor(gridArea);
    this.drawRoomActivity(gridArea, antAnimationTimeMs);
    this.drawAntTraffic(gridArea, antAnimationTimeMs);
    this.drawSelectedPiece(gridArea, selectedPosition, toolMode);
    if (floatingMenuSlideProgress < 1) {
      this.drawFloatingMenuPanel(viewportGridArea, floatingMenuRect);
      this.drawToolModeLabel(viewportGridArea, toolMode, floatingMenuOffsetX);
      this.drawToolButtons(viewportGridArea, toolMode);
      this.drawConstructionPiecePanel(viewportGridArea, selectedPieceType);
      this.drawNetworkStatusLabel(viewportGridArea, floatingMenuOffsetX);
    }
    this.drawSelectedInfoLabel(gridArea, selectedPosition);
    this.drawHoveredInfoLabel(gridArea, pointer);
    this.drawToolPreview(gridArea, pointer, toolMode, selectedPieceType);
    this.drawActionHintLabel(gridArea, pointer, toolMode, selectedPieceType);
    this.drawConduit(gridArea, constructionGridLayout.conduit);
    this.drawSurfaceDefense(gridArea, surfaceDefenseSnapshot, antAnimationTimeMs);
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
    if (this.isPointInsideFloatingMenuInteractionArea(pointer)) {
      return undefined;
    }

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

  public getColonyRoomCounts(): ColonyRoomCounts {
    return {
      barracksCount: this.countPiecesByDefinitionId('barracks'),
      broodChamberCount: this.countPiecesByDefinitionId('brood-chamber'),
      fungusFarmCount: this.countPiecesByDefinitionId('fungus-farm'),
      queenChamberCount: this.findQueenChamber() === undefined ? 0 : 1,
      storageCount: this.countPiecesByDefinitionId('storage'),
    };
  }

  public getColonyRoomUpgradeTotals(): ColonyRoomUpgradeTotals {
    return {
      barracksLevelTotal: this.getTotalLevelForDefinitionId('barracks'),
      broodChamberLevelTotal: this.getTotalLevelForDefinitionId('brood-chamber'),
      fungusFarmLevelTotal: this.getTotalLevelForDefinitionId('fungus-farm'),
      queenChamberLevelTotal: this.getTotalLevelForDefinitionId('queen-chamber'),
      storageLevelTotal: this.getTotalLevelForDefinitionId('storage'),
    };
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
    if (!this.canAffordConstructionPiece(pieceType)) {
      return false;
    }

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
    this.pieceLevels.delete(piece.id);
    occupiedPositions.forEach((occupiedPosition) => {
      this.refreshGalleryPiecesAroundPosition(occupiedPosition);
    });

    return true;
  }

  public tryUpgradePieceAtPosition(
    position: ConstructionGridPosition,
  ): boolean {
    const piece = this.findPieceAtPosition(position);

    if (piece === undefined) {
      return false;
    }

    const requirement = this.getPieceUpgradeRequirement(piece);

    if (requirement === undefined) {
      return false;
    }

    this.pieceLevels.set(piece.id, requirement.nextLevel);

    return true;
  }

  public getPieceUpgradeRequestAtPosition(
    position: ConstructionGridPosition,
  ): PieceUpgradeRequest | undefined {
    const piece = this.findPieceAtPosition(position);

    if (piece?.definitionId === undefined) {
      return undefined;
    }

    return {
      currentLevel: this.getPieceLevel(piece),
      definitionId: piece.definitionId,
    };
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
    const toolButtonsWidth = toolButtonWidth * 3 + rowGap * 2;
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

    this.graphics.fillStyle(constructionGridPalette.panelFill, 1);
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
      1,
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

    this.graphics.fillStyle(constructionGridPalette.panelFill, 1);
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
      {
        height: buttonHeight,
        mode: ConstructionToolMode.Improve,
        width: buttonWidth,
        x: x + (buttonWidth + gap) * 2,
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
        `${this.getToolModeKeyLabel(area.mode)} ${
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

  private getToolModeKeyLabel(mode: ConstructionToolMode): 'B' | 'D' | 'E' {
    switch (mode) {
      case ConstructionToolMode.Build:
        return 'B';
      case ConstructionToolMode.Destroy:
        return 'D';
      case ConstructionToolMode.Improve:
        return 'E';
    }
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
    const canAfford = this.canAffordConstructionPiece(area.pieceType);
    const cornerRadius = Math.max(6, gridArea.cellSize * 0.1);
    const fillColor = !canAfford
      ? constructionGridPalette.base
      : isActive
        ? constructionGridPalette.toolButtonActiveFill
        : constructionGridPalette.toolButtonInactiveFill;
    const borderColor = !canAfford
      ? constructionGridPalette.improveBlocked
      : isActive
        ? constructionGridPalette.ghostStroke
        : constructionGridPalette.gridBorder;

    this.graphics.fillStyle(fillColor, !canAfford ? 0.7 : isActive ? 0.95 : 0.86);
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
    const textColor = !canAfford
      ? '#736e63'
      : isActive
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
      `Co\u00fbt ${this.getConstructionPieceCost(area.pieceType)}`,
      {
        color: !canAfford ? '#736e63' : isActive ? '#f6d98a' : '#8f927f',
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

  public getConstructionPieceCost(pieceType: ConstructionPieceType): number {
    return getConstructionCost(this.getBuildableStructureType(pieceType));
  }

  private getBuildableStructureType(pieceType: ConstructionPieceType) {
    if (pieceType === ConstructionPieceType.Gallery) {
      return 'gallery' as const;
    }

    const definitionId = constructionPieceDefinitionIds[pieceType];

    if (
      definitionId === 'barracks' ||
      definitionId === 'brood-chamber' ||
      definitionId === 'fungus-farm' ||
      definitionId === 'storage'
    ) {
      return definitionId;
    }

    return 'gallery' as const;
  }

  private canAffordConstructionPiece(pieceType: ConstructionPieceType): boolean {
    if (this.colonySnapshot === undefined) {
      return false;
    }

    return this.colonySnapshot.gold >= this.getConstructionPieceCost(pieceType);
  }

  private getPieceLevel(piece: GalleryPiece): number {
    return this.pieceLevels.get(piece.id) ?? 1;
  }

  private getPieceUpgradeRequirement(piece: GalleryPiece) {
    return getRoomUpgradeRequirement(
      piece.definitionId,
      this.getPieceLevel(piece),
    );
  }

  private canUpgradePiece(piece: GalleryPiece): boolean {
    if (this.colonySnapshot === undefined) {
      return false;
    }

    const requirement = this.getPieceUpgradeRequirement(piece);

    return (
      requirement !== undefined &&
      this.colonySnapshot.gold >= requirement.costGold &&
      this.colonySnapshot.colonyLevel >= requirement.requiredColonyLevel
    );
  }

  private getTotalLevelForDefinitionId(definitionId: string): number {
    return this.constructionGrid.pieces
      .filter((piece) => piece.definitionId === definitionId)
      .reduce((totalLevel, piece) => totalLevel + this.getPieceLevel(piece), 0);
  }

  private drawHoveredGridCell(
    gridArea: GridArea,
    pointer: ConstructionGridPointer | undefined,
    toolMode: ConstructionToolMode,
    selectedPieceType: ConstructionPieceType,
  ): void {
    if (
      pointer === undefined ||
      this.isPointInsideFloatingMenuInteractionArea(pointer)
    ) {
      return;
    }

    const position = this.getGridPositionAtPoint(gridArea, pointer);

    if (position === undefined) {
      return;
    }

    const x = gridArea.x + position.column * gridArea.cellSize;
    const y = gridArea.y + position.row * gridArea.cellSize;
    const isBlocked =
      toolMode === ConstructionToolMode.Improve
        ? !this.canUpgradePieceAtPosition(position)
        : !this.canPlaceConstructionPieceAtPosition(position, selectedPieceType);
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
    if (
      pointer === undefined ||
      this.isPointInsideFloatingMenuInteractionArea(pointer)
    ) {
      return;
    }

    const position = this.getGridPositionAtPoint(gridArea, pointer);

    if (position === undefined) {
      return;
    }

    this.drawHoveredGridCell(gridArea, pointer, toolMode, selectedPieceType);

    if (toolMode === ConstructionToolMode.Destroy) {
      this.drawRemovalPreview(gridArea, position);
      return;
    }

    if (toolMode === ConstructionToolMode.Improve) {
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
    if (
      pointer === undefined ||
      this.isPointInsideFloatingMenuInteractionArea(pointer)
    ) {
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

    if (toolMode === ConstructionToolMode.Improve) {
      return this.getImproveActionHintText(position);
    }

    return this.getBuildActionHintText(position, selectedPieceType);
  }

  private getBuildActionHintText(
    position: ConstructionGridPosition,
    selectedPieceType: ConstructionPieceType,
  ): string {
    if (!this.canAffordConstructionPiece(selectedPieceType)) {
      return `${this.getConstructionPieceCost(selectedPieceType)} gold requis`;
    }

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

  private getImproveActionHintText(position: ConstructionGridPosition): string {
    const piece = this.findPieceAtPosition(position);

    if (piece === undefined) {
      return 'Aucune pi\u00e8ce \u00e0 am\u00e9liorer';
    }

    if (!isRoomUpgradeable(piece.definitionId)) {
      return 'Cette pi\u00e8ce ne s\u2019am\u00e9liore pas';
    }

    const requirement = this.getPieceUpgradeRequirement(piece);

    if (requirement === undefined) {
      return 'Niveau maximum atteint';
    }

    if (this.colonySnapshot === undefined) {
      return 'Donn\u00e9es d\u2019am\u00e9lioration indisponibles';
    }

    if (this.colonySnapshot.colonyLevel < requirement.requiredColonyLevel) {
      return `Niveau colonie ${requirement.requiredColonyLevel} requis`;
    }

    if (this.colonySnapshot.gold < requirement.costGold) {
      return `${requirement.costGold} gold requis`;
    }

    return `Am\u00e9liorer vers niveau ${requirement.nextLevel}`;
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
    toolMode: ConstructionToolMode,
    selectedPieceType: ConstructionPieceType,
  ): void {
    if (selectedPosition === undefined) {
      return;
    }

    const x = gridArea.x + selectedPosition.column * gridArea.cellSize;
    const y = gridArea.y + selectedPosition.row * gridArea.cellSize;
    const isBlocked =
      toolMode === ConstructionToolMode.Improve
        ? !this.canUpgradePieceAtPosition(selectedPosition)
        : !this.canPlaceConstructionPieceAtPosition(
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
    toolMode: ConstructionToolMode,
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
    const selectionColor =
      toolMode === ConstructionToolMode.Improve
        ? this.canUpgradePiece(piece)
          ? constructionGridPalette.improveAvailable
          : constructionGridPalette.gridBlockedSelection
        : constructionGridPalette.pieceSelection;

    this.graphics.lineStyle(3, selectionColor, 0.94);
    this.graphics.strokeRoundedRect(
      rect.x + padding,
      rect.y + padding,
      rect.width - padding * 2,
      rect.height - padding * 2,
      cornerRadius,
    );
    this.graphics.lineStyle(1, selectionColor, 0.42);
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
    this.drawInfoTooltipPanel(gridArea, label, 1);
    this.selectedInfoLabel = label;
  }

  private drawHoveredInfoLabel(
    gridArea: GridArea,
    pointer: ConstructionGridPointer | undefined,
  ): void {
    if (
      pointer === undefined ||
      this.isPointInsideFloatingMenuInteractionArea(pointer)
    ) {
      return;
    }

    const hoveredPosition = this.getGridPositionAtPoint(gridArea, pointer);

    if (hoveredPosition === undefined) {
      return;
    }

    const piece = this.findPieceAtPosition(hoveredPosition);

    if (piece === undefined) {
      return;
    }

    const label = this.gameObjects.text(
      pointer.x + Math.max(14, gridArea.cellSize * 0.2),
      pointer.y - Math.max(14, gridArea.cellSize * 0.2),
      this.getPieceStatusLabel('Survol', piece),
      {
        color: constructionGridPalette.textWarning,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(11, Math.round(gridArea.cellSize * 0.17))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    label.setOrigin(0, 1);
    label.setShadow(
      1,
      1,
      constructionGridPalette.textShadow,
      2,
      true,
      true,
    );
    label.setDepth(3);
    this.drawInfoTooltipPanel(gridArea, label, 3);
    this.hoveredInfoLabel = label;
  }

  private drawInfoTooltipPanel(
    gridArea: GridArea,
    label: PhaserType.GameObjects.Text,
    depth: number,
  ): void {
    const bounds = label.getBounds();
    const paddingX = Math.max(8, gridArea.cellSize * 0.14);
    const paddingY = Math.max(5, gridArea.cellSize * 0.09);
    const cornerRadius = Math.max(8, gridArea.cellSize * 0.16);

    this.graphics.fillStyle(constructionGridPalette.panelFill, 0.94);
    this.graphics.fillRoundedRect(
      bounds.x - paddingX,
      bounds.y - paddingY,
      bounds.width + paddingX * 2,
      bounds.height + paddingY * 2,
      cornerRadius,
    );
    this.graphics.lineStyle(1.5, constructionGridPalette.gridBorder, 0.62);
    this.graphics.strokeRoundedRect(
      bounds.x - paddingX,
      bounds.y - paddingY,
      bounds.width + paddingX * 2,
      bounds.height + paddingY * 2,
      cornerRadius,
    );
    label.setDepth(depth + 1);
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
    return this.getPieceStatusLabel('S\u00e9lection', piece);
  }

  private getPieceStatusLabel(
    prefix: 'Survol' | 'S\u00e9lection',
    piece: GalleryPiece,
  ): string {
    if (!this.isRoomPiece(piece)) {
      return `${prefix} : Galerie`;
    }

    const definition = piece.definitionId
      ? findGalleryPieceDefinition(piece.definitionId)
      : undefined;
    const pieceLabel = definition?.label ?? 'Pi\u00e8ce';

    const entranceCount = countGalleryPieceEntrances(
      this.constructionGrid,
      piece,
    );
    const level = this.getPieceLevel(piece);
    const requirement = this.getPieceUpgradeRequirement(piece);
    const baseLabel =
      piece.entranceLimit === undefined
        ? `${prefix} : ${pieceLabel}`
        : `${prefix} : ${pieceLabel} - niv. ${level} - ${entranceCount}/${piece.entranceLimit} entr\u00e9es`;

    if (!isRoomUpgradeable(piece.definitionId)) {
      return baseLabel;
    }

    const localMetricDetail = this.getPieceLocalMetricDetail(piece);

    if (requirement === undefined) {
      return localMetricDetail === null
        ? `${baseLabel}\nNiveau maximum`
        : `${baseLabel}\n${localMetricDetail}\nNiveau maximum`;
    }

    return localMetricDetail === null
      ? `${baseLabel}\nAm\u00e9lioration : ${requirement.costGold} gold - colonie niv. ${requirement.requiredColonyLevel}`
      : `${baseLabel}\n${localMetricDetail}\nAm\u00e9lioration : ${requirement.costGold} gold - colonie niv. ${requirement.requiredColonyLevel}`;
  }

  private getPieceLocalMetricDetail(piece: GalleryPiece): string | null {
    const level = this.getPieceLevel(piece);

    switch (piece.definitionId) {
      case 'barracks':
        return `Local : +${level * 4} armée max`;
      case 'brood-chamber':
        return `Local : +${level * 300} ouvrières/h`;
      case 'queen-chamber':
        return `Local : +${level * 360} larves/h`;
      case 'storage':
        return `Local : +${level * 40} capacité`;
      case 'fungus-farm':
        return `Local : +${(level * 2880).toFixed(0)} nourriture/h`;
      default:
        return null;
    }
  }

  private canUpgradePieceAtPosition(position: ConstructionGridPosition): boolean {
    const piece = this.findPieceAtPosition(position);

    if (piece === undefined) {
      return false;
    }

    return this.canUpgradePiece(piece);
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
    this.drawRoomLevelBadges(gridArea, pieces);
    this.drawRoomLocalMetricBadges(gridArea, pieces);
  }

  private drawAntTraffic(gridArea: GridArea, animationTimeMs: number): void {
    const route = this.getAntTrafficRoute(gridArea);

    if (route.length < 2) {
      return;
    }

    const totalLength = this.getRouteLength(route);

    if (totalLength <= 0) {
      return;
    }

    const antCount = Math.min(14, Math.max(6, route.length));
    const antSpeed = gridArea.cellSize * 0.0014;

    for (let antIndex = 0; antIndex < antCount; antIndex += 1) {
      const offset = (totalLength / antCount) * antIndex;
      const distance = (animationTimeMs * antSpeed + offset) % totalLength;
      const position = this.getPointAlongRoute(route, distance);

      if (position === undefined) {
        continue;
      }

      this.drawAntSprite(gridArea, position.x, position.y, position.angle, antIndex);
    }
  }

  private drawRoomActivity(gridArea: GridArea, animationTimeMs: number): void {
    const queenChamber = this.findQueenChamber();

    if (queenChamber !== undefined) {
      this.drawQueenEggLayingActivity(gridArea, queenChamber, animationTimeMs);
    }

    const broodChamber = this.findPieceByDefinitionId('brood-chamber');

    if (broodChamber !== undefined) {
      this.drawBroodChamberActivity(gridArea, broodChamber, animationTimeMs);
    }

    const barracks = this.findPieceByDefinitionId('barracks');

    if (barracks !== undefined) {
      this.drawBarracksActivity(gridArea, barracks, animationTimeMs);
    }

    const storage = this.findPieceByDefinitionId('storage');

    if (storage !== undefined) {
      this.drawStorageActivity(gridArea, storage, animationTimeMs);
    }

    const fungusFarm = this.findPieceByDefinitionId('fungus-farm');

    if (fungusFarm !== undefined) {
      this.drawFungusFarmActivity(gridArea, fungusFarm, animationTimeMs);
    }

    if (queenChamber !== undefined && broodChamber !== undefined) {
      this.drawCarrierRouteActivity(
        gridArea,
        queenChamber.id,
        broodChamber.id,
        animationTimeMs,
        constructionGridPalette.egg,
        0,
      );
    }

    if (fungusFarm !== undefined && storage !== undefined) {
      this.drawCarrierRouteActivity(
        gridArea,
        fungusFarm.id,
        storage.id,
        animationTimeMs,
        constructionGridPalette.fungusGlow,
        1400,
      );
    }
  }

  private drawQueenEggLayingActivity(
    gridArea: GridArea,
    queenChamber: GalleryPiece,
    animationTimeMs: number,
  ): void {
    const rect = this.getGalleryRect(gridArea, queenChamber);
    const pulse = (Math.sin(animationTimeMs * 0.004) + 1) / 2;
    const eggBaseX = rect.x + rect.width * 0.34;
    const eggBaseY = rect.y + rect.height * 0.68;
    const eggSpacing = gridArea.cellSize * 0.16;

    this.graphics.fillStyle(constructionGridPalette.egg, 0.74 + pulse * 0.18);

    for (let index = 0; index < 4; index += 1) {
      const offsetX = (index % 2) * eggSpacing;
      const offsetY = Math.floor(index / 2) * eggSpacing * 0.9;

      this.graphics.fillEllipse(
        eggBaseX + offsetX,
        eggBaseY + offsetY,
        gridArea.cellSize * 0.12,
        gridArea.cellSize * 0.17,
      );
    }

    const queenWorkerX = rect.x + rect.width * 0.7 + Math.sin(animationTimeMs * 0.0032) * gridArea.cellSize * 0.12;
    const queenWorkerY = rect.y + rect.height * 0.66;
    this.drawAntSprite(gridArea, queenWorkerX, queenWorkerY, Math.PI, 101);
  }

  private drawBroodChamberActivity(
    gridArea: GridArea,
    broodChamber: GalleryPiece,
    animationTimeMs: number,
  ): void {
    const rect = this.getGalleryRect(gridArea, broodChamber);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height * 0.56;
    const glowWidth = rect.width * 0.48;
    const glowHeight = rect.height * 0.22;

    this.graphics.fillStyle(constructionGridPalette.egg, 0.12);
    this.graphics.fillEllipse(centerX, centerY, glowWidth, glowHeight);

    for (let index = 0; index < 3; index += 1) {
      const phase = animationTimeMs * 0.004 + index * 1.8;
      this.graphics.fillStyle(constructionGridPalette.egg, 0.76);
      this.graphics.fillEllipse(
        centerX - gridArea.cellSize * 0.18 + index * gridArea.cellSize * 0.18,
        centerY + Math.sin(phase) * gridArea.cellSize * 0.03,
        gridArea.cellSize * 0.11,
        gridArea.cellSize * 0.15,
      );
    }

    this.drawAntSprite(
      gridArea,
      centerX + Math.sin(animationTimeMs * 0.003) * gridArea.cellSize * 0.22,
      rect.y + rect.height * 0.34,
      0,
      111,
    );
  }

  private drawBarracksActivity(
    gridArea: GridArea,
    barracks: GalleryPiece,
    animationTimeMs: number,
  ): void {
    const rect = this.getGalleryRect(gridArea, barracks);
    const leftX = rect.x + rect.width * 0.36;
    const rightX = rect.x + rect.width * 0.64;
    const centerY = rect.y + rect.height * 0.62;
    const sparY = rect.y + rect.height * 0.34;
    const march = Math.sin(animationTimeMs * 0.006) * gridArea.cellSize * 0.08;

    this.drawAntSprite(gridArea, leftX, centerY + march, 0.2, 121);
    this.drawAntSprite(gridArea, rightX, centerY - march, Math.PI - 0.2, 122);

    this.graphics.lineStyle(2, roomVisualStyles.barracks.accentColor, 0.48);
    this.graphics.lineBetween(
      rect.x + rect.width * 0.42,
      sparY,
      rect.x + rect.width * 0.58,
      sparY + Math.sin(animationTimeMs * 0.01) * gridArea.cellSize * 0.06,
    );
  }

  private drawStorageActivity(
    gridArea: GridArea,
    storage: GalleryPiece,
    animationTimeMs: number,
  ): void {
    const rect = this.getGalleryRect(gridArea, storage);
    const laneY = rect.y + rect.height * 0.62;
    const travel = (Math.sin(animationTimeMs * 0.0042) + 1) / 2;
    const antX = this.Phaser.Math.Linear(
      rect.x + rect.width * 0.3,
      rect.x + rect.width * 0.7,
      travel,
    );

    this.drawAntSprite(gridArea, antX, laneY, 0, 131);
    this.graphics.fillStyle(constructionGridPalette.storageCrate, 0.9);
    this.graphics.fillRoundedRect(
      antX + gridArea.cellSize * 0.05,
      laneY - gridArea.cellSize * 0.08,
      gridArea.cellSize * 0.09,
      gridArea.cellSize * 0.09,
      gridArea.cellSize * 0.015,
    );
    this.graphics.fillRoundedRect(
      rect.x + rect.width * 0.32,
      rect.y + rect.height * 0.34,
      gridArea.cellSize * 0.12,
      gridArea.cellSize * 0.12,
      gridArea.cellSize * 0.02,
    );
    this.graphics.fillRoundedRect(
      rect.x + rect.width * 0.56,
      rect.y + rect.height * 0.33,
      gridArea.cellSize * 0.1,
      gridArea.cellSize * 0.1,
      gridArea.cellSize * 0.02,
    );
  }

  private drawFungusFarmActivity(
    gridArea: GridArea,
    fungusFarm: GalleryPiece,
    animationTimeMs: number,
  ): void {
    const rect = this.getGalleryRect(gridArea, fungusFarm);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height * 0.58;

    this.graphics.fillStyle(constructionGridPalette.fungusGlow, 0.14);
    this.graphics.fillEllipse(
      centerX,
      centerY,
      rect.width * 0.5,
      rect.height * 0.24,
    );

    for (let index = 0; index < 3; index += 1) {
      const offsetX = (index - 1) * gridArea.cellSize * 0.16;
      const bob = Math.sin(animationTimeMs * 0.0048 + index * 1.7) * gridArea.cellSize * 0.04;

      this.graphics.fillStyle(constructionGridPalette.fungusGlow, 0.82);
      this.graphics.fillEllipse(
        centerX + offsetX,
        centerY + bob,
        gridArea.cellSize * 0.16,
        gridArea.cellSize * 0.12,
      );
    }

    this.drawAntSprite(
      gridArea,
      centerX + Math.cos(animationTimeMs * 0.0038) * gridArea.cellSize * 0.18,
      rect.y + rect.height * 0.38,
      Math.PI * 0.1,
      141,
    );
  }

  private drawCarrierRouteActivity(
    gridArea: GridArea,
    startPieceId: string,
    targetPieceId: string,
    animationTimeMs: number,
    cargoColor: number,
    timeOffsetMs: number,
  ): void {
    const route = this.getPieceToPieceRoute(gridArea, startPieceId, targetPieceId);

    if (route.length < 2) {
      return;
    }

    const totalLength = this.getRouteLength(route);

    if (totalLength <= 0) {
      return;
    }

    const distance =
      ((animationTimeMs + timeOffsetMs) * gridArea.cellSize * 0.0011) %
      totalLength;
    const position = this.getPointAlongRoute(route, distance);

    if (position === undefined) {
      return;
    }

    this.drawCarrierAntSprite(
      gridArea,
      position.x,
      position.y,
      position.angle,
      cargoColor,
      201 + timeOffsetMs,
    );
  }

  private getPieceToPieceRoute(
    gridArea: GridArea,
    startPieceId: string,
    targetPieceId: string,
  ): readonly { readonly x: number; readonly y: number }[] {
    const connectedPieceIds = this.getQueenNetworkPieceIds();
    const connectedPieces = this.constructionGrid.pieces.filter((piece) =>
      connectedPieceIds.has(piece.id),
    );
    const piecePath = this.findShortestPiecePath(
      connectedPieces,
      startPieceId,
      targetPieceId,
    );

    if (piecePath.length < 2) {
      return [];
    }

    return piecePath
      .map((pieceId) => connectedPieces.find((piece) => piece.id === pieceId))
      .filter((piece): piece is GalleryPiece => piece !== undefined)
      .map((piece) => {
        const rect = this.getGalleryRect(gridArea, piece);

        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        };
      });
  }

  private findPieceByDefinitionId(definitionId: string): GalleryPiece | undefined {
    return this.constructionGrid.pieces.find(
      (piece) => piece.definitionId === definitionId,
    );
  }

  private countPiecesByDefinitionId(definitionId: string): number {
    return this.constructionGrid.pieces.filter(
      (piece) => piece.definitionId === definitionId,
    ).length;
  }

  private getAntTrafficRoute(
    gridArea: GridArea,
  ): readonly { readonly x: number; readonly y: number }[] {
    const queenChamber = this.findQueenChamber();

    if (queenChamber === undefined) {
      return [];
    }

    const connectedPieceIds = this.getQueenNetworkPieceIds();
    const connectedPieces = this.constructionGrid.pieces.filter((piece) =>
      connectedPieceIds.has(piece.id),
    );

    if (connectedPieces.length === 0) {
      return [];
    }

    const roomPieces = connectedPieces
      .filter((piece) => this.isRoomPiece(piece))
      .sort((firstPiece, secondPiece) => {
        if (firstPiece.id === queenChamber.id) {
          return -1;
        }

        if (secondPiece.id === queenChamber.id) {
          return 1;
        }

        return (
          firstPiece.position.row - secondPiece.position.row ||
          firstPiece.position.column - secondPiece.position.column
        );
      });
    const conduitPiece = connectedPieces.find((piece) =>
      this.isPieceTouchingConduit(piece),
    );
    const pieceRouteIds: string[] = [];
    let currentPieceId = queenChamber.id;

    pieceRouteIds.push(currentPieceId);

    roomPieces.forEach((piece) => {
      if (piece.id === currentPieceId) {
        return;
      }

      this.appendPiecePath(pieceRouteIds, connectedPieces, currentPieceId, piece.id);
      currentPieceId = piece.id;
    });

    if (conduitPiece !== undefined && conduitPiece.id !== currentPieceId) {
      this.appendPiecePath(
        pieceRouteIds,
        connectedPieces,
        currentPieceId,
        conduitPiece.id,
      );
      currentPieceId = conduitPiece.id;
    }

    const routePoints = pieceRouteIds
      .map((pieceId) => connectedPieces.find((piece) => piece.id === pieceId))
      .filter((piece): piece is GalleryPiece => piece !== undefined)
      .map((piece) => {
        const rect = this.getGalleryRect(gridArea, piece);

        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        };
      });

    if (routePoints.length === 0) {
      return [];
    }

    if (conduitPiece !== undefined) {
      const conduitCenter = this.getCellCenter(
        gridArea,
        constructionGridLayout.conduit.position,
      );
      const surfaceExitPoint = {
        x: conduitCenter.x,
        y: gridArea.y - gridArea.cellSize * 1.15,
      };

      routePoints.push(conduitCenter, surfaceExitPoint, conduitCenter);
    }

    const returnPoints = [...routePoints].slice(0, -1).reverse();

    return [...routePoints, ...returnPoints];
  }

  private appendPiecePath(
    pieceRouteIds: string[],
    connectedPieces: readonly GalleryPiece[],
    startPieceId: string,
    targetPieceId: string,
  ): void {
    const path = this.findShortestPiecePath(
      connectedPieces,
      startPieceId,
      targetPieceId,
    );

    path.slice(1).forEach((pieceId) => {
      pieceRouteIds.push(pieceId);
    });
  }

  private findShortestPiecePath(
    connectedPieces: readonly GalleryPiece[],
    startPieceId: string,
    targetPieceId: string,
  ): readonly string[] {
    if (startPieceId === targetPieceId) {
      return [startPieceId];
    }

    const queue: string[] = [startPieceId];
    const previousPieceIds = new Map<string, string | undefined>([
      [startPieceId, undefined],
    ]);

    while (queue.length > 0) {
      const currentPieceId = queue.shift();

      if (currentPieceId === undefined) {
        break;
      }

      if (currentPieceId === targetPieceId) {
        break;
      }

      const currentPiece = connectedPieces.find((piece) => piece.id === currentPieceId);

      if (currentPiece === undefined) {
        continue;
      }

      connectedPieces.forEach((candidate) => {
        if (
          candidate.id === currentPiece.id ||
          previousPieceIds.has(candidate.id) ||
          !areGalleryPiecesConnected(currentPiece, candidate)
        ) {
          return;
        }

        previousPieceIds.set(candidate.id, currentPiece.id);
        queue.push(candidate.id);
      });
    }

    if (!previousPieceIds.has(targetPieceId)) {
      return [startPieceId];
    }

    const reversedPath: string[] = [];
    let currentPieceId: string | undefined = targetPieceId;

    while (currentPieceId !== undefined) {
      reversedPath.push(currentPieceId);
      currentPieceId = previousPieceIds.get(currentPieceId);
    }

    return reversedPath.reverse();
  }

  private isPieceTouchingConduit(piece: GalleryPiece): boolean {
    return getGalleryPieceOccupiedPositions(piece).some(
      (position) => this.getConduitConnectionDirection(position) !== undefined,
    );
  }

  private getRouteLength(
    route: readonly { readonly x: number; readonly y: number }[],
  ): number {
    return route.slice(1).reduce((totalLength, point, index) => {
      const previousPoint = route[index];

      return totalLength + this.Phaser.Math.Distance.Between(
        previousPoint.x,
        previousPoint.y,
        point.x,
        point.y,
      );
    }, 0);
  }

  private getPointAlongRoute(
    route: readonly { readonly x: number; readonly y: number }[],
    distance: number,
  ):
    | {
        readonly angle: number;
        readonly x: number;
        readonly y: number;
      }
    | undefined {
    let remainingDistance = distance;

    for (let index = 1; index < route.length; index += 1) {
      const previousPoint = route[index - 1];
      const point = route[index];
      const segmentLength = this.Phaser.Math.Distance.Between(
        previousPoint.x,
        previousPoint.y,
        point.x,
        point.y,
      );

      if (segmentLength === 0) {
        continue;
      }

      if (remainingDistance <= segmentLength) {
        const progress = remainingDistance / segmentLength;

        return {
          angle: Math.atan2(point.y - previousPoint.y, point.x - previousPoint.x),
          x: this.Phaser.Math.Linear(previousPoint.x, point.x, progress),
          y: this.Phaser.Math.Linear(previousPoint.y, point.y, progress),
        };
      }

      remainingDistance -= segmentLength;
    }

    return undefined;
  }

  private drawAntSprite(
    gridArea: GridArea,
    x: number,
    y: number,
    angle: number,
    antIndex: number,
  ): void {
    const bodyRadius = Math.max(1.8, gridArea.cellSize * 0.055);
    const headRadius = bodyRadius * 0.72;
    const abdomenRadius = bodyRadius * 0.95;
    const spacing = bodyRadius * 1.55;
    const wingX = Math.cos(angle);
    const wingY = Math.sin(angle);
    const bob = Math.sin((x + y + antIndex * 13) * 0.08) * bodyRadius * 0.16;
    const centerX = x;
    const centerY = y + bob;

    const abdomenX = centerX - wingX * spacing;
    const abdomenY = centerY - wingY * spacing;
    const headX = centerX + wingX * spacing;
    const headY = centerY + wingY * spacing;

    this.graphics.fillStyle(constructionGridPalette.antBody, 0.95);
    this.graphics.fillCircle(abdomenX, abdomenY, abdomenRadius);
    this.graphics.fillCircle(centerX, centerY, bodyRadius);
    this.graphics.fillCircle(headX, headY, headRadius);

    this.graphics.fillStyle(constructionGridPalette.antHighlight, 0.26);
    this.graphics.fillCircle(
      centerX + wingX * bodyRadius * 0.2,
      centerY - wingY * bodyRadius * 0.2,
      bodyRadius * 0.42,
    );
  }

  private drawCarrierAntSprite(
    gridArea: GridArea,
    x: number,
    y: number,
    angle: number,
    cargoColor: number,
    antIndex: number,
  ): void {
    this.drawAntSprite(gridArea, x, y, angle, antIndex);

    const cargoDistance = Math.max(3, gridArea.cellSize * 0.12);
    const cargoX = x + Math.cos(angle + Math.PI / 2) * cargoDistance;
    const cargoY = y + Math.sin(angle + Math.PI / 2) * cargoDistance;

    this.graphics.fillStyle(cargoColor, 0.94);
    this.graphics.fillCircle(
      cargoX,
      cargoY,
      Math.max(2, gridArea.cellSize * 0.04),
    );
  }

  public destroy(): void {
    this.clearActionHintLabel();
    this.clearEntranceCounterLabels();
    this.clearHoveredInfoLabel();
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
      this.drawBarracksMarker(gridArea, piece, rect, visualStyle);
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
    piece: GalleryPiece,
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

    const capacity = this.getPieceLevel(piece) * 4;
    const badgeWidth = Math.max(
      gridArea.cellSize * 0.58,
      Math.min(rect.width * 0.34, gridArea.cellSize * 0.94),
    );
    const badgeHeight = gridArea.cellSize * 0.26;
    const badgeX = rect.x + rect.width - badgeWidth - gridArea.cellSize * 0.12;
    const badgeY = rect.y + rect.height - badgeHeight - gridArea.cellSize * 0.12;

    this.graphics.fillStyle(constructionGridPalette.panelFill, 0.92);
    this.graphics.fillRoundedRect(
      badgeX,
      badgeY,
      badgeWidth,
      badgeHeight,
      gridArea.cellSize * 0.1,
    );
    this.graphics.lineStyle(1.2, visualStyle.accentColor, 0.68);
    this.graphics.strokeRoundedRect(
      badgeX,
      badgeY,
      badgeWidth,
      badgeHeight,
      gridArea.cellSize * 0.1,
    );

    const label = this.gameObjects.text(
      badgeX + badgeWidth / 2,
      badgeY + badgeHeight / 2,
      `⚔ ${capacity}`,
      {
        color: constructionGridPalette.textWarning,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(9, Math.round(gridArea.cellSize * 0.145))}px`,
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
    const centerY = rect.y + rect.height * 0.54;
    const abdomenWidth = rect.width * 0.52;
    const abdomenHeight = rect.height * 0.32;
    const thoraxWidth = rect.width * 0.26;
    const thoraxHeight = rect.height * 0.18;
    const headRadius = Math.max(6, gridArea.cellSize * 0.16);
    const antennaLength = rect.width * 0.12;
    const legLength = rect.width * 0.16;
    const abdomenY = centerY + abdomenHeight * 0.08;
    const thoraxY = centerY - thoraxHeight * 0.08;
    const headY = centerY - thoraxHeight * 0.58;

    this.graphics.lineStyle(2, constructionGridPalette.queenBody, 0.52);
    [-1, 1].forEach((direction) => {
      this.graphics.lineBetween(
        centerX + direction * thoraxWidth * 0.3,
        thoraxY - thoraxHeight * 0.18,
        centerX + direction * legLength,
        thoraxY - thoraxHeight * 0.8,
      );
      this.graphics.lineBetween(
        centerX + direction * thoraxWidth * 0.34,
        thoraxY + thoraxHeight * 0.05,
        centerX + direction * legLength * 1.08,
        thoraxY,
      );
      this.graphics.lineBetween(
        centerX + direction * thoraxWidth * 0.28,
        thoraxY + thoraxHeight * 0.22,
        centerX + direction * legLength,
        thoraxY + thoraxHeight * 0.78,
      );
    });

    this.graphics.fillStyle(constructionGridPalette.queenBody, 0.9);
    this.graphics.fillEllipse(
      centerX,
      abdomenY,
      abdomenWidth,
      abdomenHeight,
    );
    this.graphics.fillEllipse(
      centerX,
      thoraxY,
      thoraxWidth,
      thoraxHeight,
    );
    this.graphics.fillStyle(constructionGridPalette.queenAccent, 0.92);
    this.graphics.fillCircle(centerX, headY, headRadius);
    this.graphics.fillStyle(constructionGridPalette.galleryHighlight, 0.14);
    this.graphics.fillEllipse(
      centerX,
      abdomenY - abdomenHeight * 0.15,
      abdomenWidth * 0.58,
      abdomenHeight * 0.2,
    );
    this.graphics.fillStyle(constructionGridPalette.galleryHighlight, 0.12);
    this.graphics.fillEllipse(
      centerX,
      thoraxY - thoraxHeight * 0.12,
      thoraxWidth * 0.48,
      thoraxHeight * 0.18,
    );
    this.graphics.lineStyle(2, constructionGridPalette.queenAccent, 0.72);
    this.graphics.lineBetween(
      centerX - headRadius * 0.5,
      headY - headRadius * 0.2,
      centerX,
      headY - antennaLength,
    );
    this.graphics.lineBetween(
      centerX,
      headY - antennaLength,
      centerX + headRadius * 0.5,
      headY - headRadius * 0.2,
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

  private drawRoomLevelBadges(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
  ): void {
    pieces
      .filter((piece) => this.isRoomPiece(piece))
      .forEach((roomPiece) => {
        const rect = this.getGalleryRect(gridArea, roomPiece);
        const level = this.getPieceLevel(roomPiece);
        const badgeWidth = Math.max(
          gridArea.cellSize * 0.54,
          Math.min(rect.width * 0.34, gridArea.cellSize * 0.9),
        );
        const badgeHeight = gridArea.cellSize * 0.28;
        const badgeX = rect.x + gridArea.cellSize * 0.12;
        const badgeY = rect.y + gridArea.cellSize * 0.12;
        const visualStyle = this.getRoomVisualStyle(roomPiece);

        this.graphics.fillStyle(constructionGridPalette.panelFill, 0.92);
        this.graphics.fillRoundedRect(
          badgeX,
          badgeY,
          badgeWidth,
          badgeHeight,
          gridArea.cellSize * 0.12,
        );
        this.graphics.lineStyle(1.4, visualStyle.accentColor, 0.7);
        this.graphics.strokeRoundedRect(
          badgeX,
          badgeY,
          badgeWidth,
          badgeHeight,
          gridArea.cellSize * 0.12,
        );

        const label = this.gameObjects.text(
          badgeX + badgeWidth / 2,
          badgeY + badgeHeight / 2,
          `N${level}`,
          {
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
        this.entranceCounterLabels.push(label);
      });
  }

  private drawRoomLocalMetricBadges(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
  ): void {
    pieces
      .filter(
        (piece) =>
          this.isRoomPiece(piece) &&
          piece.definitionId !== 'barracks',
      )
      .forEach((roomPiece) => {
        const badgeLabel = this.getRoomLocalMetricBadgeLabel(roomPiece);

        if (badgeLabel === null) {
          return;
        }

        const rect = this.getGalleryRect(gridArea, roomPiece);
        const visualStyle = this.getRoomVisualStyle(roomPiece);
        const badgeWidth = Math.max(
          gridArea.cellSize * 0.72,
          Math.min(rect.width * 0.42, gridArea.cellSize * 1.24),
        );
        const badgeHeight = gridArea.cellSize * 0.28;
        const badgeX = rect.x + rect.width - badgeWidth - gridArea.cellSize * 0.12;
        const badgeY = rect.y + rect.height - badgeHeight - gridArea.cellSize * 0.12;

        this.graphics.fillStyle(constructionGridPalette.panelFill, 0.92);
        this.graphics.fillRoundedRect(
          badgeX,
          badgeY,
          badgeWidth,
          badgeHeight,
          gridArea.cellSize * 0.1,
        );
        this.graphics.lineStyle(1.2, visualStyle.accentColor, 0.68);
        this.graphics.strokeRoundedRect(
          badgeX,
          badgeY,
          badgeWidth,
          badgeHeight,
          gridArea.cellSize * 0.1,
        );

        const label = this.gameObjects.text(
          badgeX + badgeWidth / 2,
          badgeY + badgeHeight / 2,
          badgeLabel,
          {
            color: constructionGridPalette.textWarning,
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: `${Math.max(8, Math.round(gridArea.cellSize * 0.135))}px`,
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

  private getRoomLocalMetricBadgeLabel(piece: GalleryPiece): string | null {
    const level = this.getPieceLevel(piece);

    switch (piece.definitionId) {
      case 'brood-chamber':
        return `W+${level}`;
      case 'queen-chamber':
        return `L+${level}`;
      case 'storage':
        return `C+${level * 40}`;
      case 'fungus-farm':
        return `F+${(level * 0.8).toFixed(1)}`;
      default:
        return null;
    }
  }

  private drawImproveModeRoomStates(
    gridArea: GridArea,
    pieces: readonly GalleryPiece[],
  ): void {
    pieces
      .filter((piece) => this.isRoomPiece(piece))
      .forEach((roomPiece) => {
        const rect = this.getGalleryRect(gridArea, roomPiece);
        const padding = gridArea.cellSize * 0.06;
        const cornerRadius = gridArea.cellSize * 0.32;
        const canUpgrade = this.canUpgradePiece(roomPiece);

        if (!canUpgrade) {
          this.graphics.fillStyle(constructionGridPalette.base, 0.28);
          this.graphics.fillRoundedRect(
            rect.x + padding,
            rect.y + padding,
            rect.width - padding * 2,
            rect.height - padding * 2,
            cornerRadius,
          );
        }

        const outlineColor = canUpgrade
          ? constructionGridPalette.improveAvailable
          : constructionGridPalette.improveBlocked;

        this.graphics.lineStyle(2, outlineColor, canUpgrade ? 0.68 : 0.52);
        this.graphics.strokeRoundedRect(
          rect.x + padding,
          rect.y + padding,
          rect.width - padding * 2,
          rect.height - padding * 2,
          cornerRadius,
        );
        this.graphics.lineStyle(1, outlineColor, canUpgrade ? 0.3 : 0.24);
        this.graphics.strokeRoundedRect(
          rect.x + padding * 2,
          rect.y + padding * 2,
          rect.width - padding * 4,
          rect.height - padding * 4,
          cornerRadius * 0.84,
        );
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

  private clearHoveredInfoLabel(): void {
    this.hoveredInfoLabel?.destroy();
    this.hoveredInfoLabel = undefined;
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

  private isPointInsideFloatingMenuPanel(
    pointer: ConstructionGridPointer,
  ): boolean {
    return (
      this.floatingMenuRect !== undefined &&
      pointer.x >= this.floatingMenuRect.x &&
      pointer.x <= this.floatingMenuRect.x + this.floatingMenuRect.width &&
      pointer.y >= this.floatingMenuRect.y &&
      pointer.y <= this.floatingMenuRect.y + this.floatingMenuRect.height
    );
  }

  private isPointInsideFloatingMenuInteractionArea(
    pointer: ConstructionGridPointer,
  ): boolean {
    return (
      this.isPointInsideFloatingMenuPanel(pointer) ||
      this.isPointInsideFloatingMenuToggle(pointer)
    );
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
    const radius = gridArea.cellSize * 0.27;
    const moundBaseWidth = gridArea.cellSize * 1.75;
    const moundBaseHeight = gridArea.cellSize * 0.9;
    const moundMidWidth = gridArea.cellSize * 1.2;
    const moundMidHeight = gridArea.cellSize * 0.62;
    const moundTopWidth = gridArea.cellSize * 0.78;
    const moundTopHeight = gridArea.cellSize * 0.42;
    const moundBaseY = center.y + gridArea.cellSize * 0.12;
    const moundMidY = center.y + gridArea.cellSize * 0.05;
    const moundTopY = center.y - gridArea.cellSize * 0.02;
    const soilDark = 0x342317;
    const soilMid = 0x513722;
    const soilLight = 0x6a4a31;

    this.graphics.fillStyle(soilDark, 0.96);
    this.graphics.fillEllipse(
      center.x,
      moundBaseY,
      moundBaseWidth,
      moundBaseHeight,
    );
    this.graphics.fillStyle(soilMid, 0.94);
    this.graphics.fillEllipse(
      center.x,
      moundMidY,
      moundMidWidth,
      moundMidHeight,
    );
    this.graphics.fillStyle(soilLight, 0.84);
    this.graphics.fillEllipse(
      center.x,
      moundTopY,
      moundTopWidth,
      moundTopHeight,
    );
    this.graphics.fillStyle(constructionGridPalette.galleryHighlight, 0.1);
    this.graphics.fillEllipse(
      center.x,
      moundTopY - gridArea.cellSize * 0.08,
      moundTopWidth * 0.5,
      moundTopHeight * 0.18,
    );

    const grainRadius = Math.max(1.5, gridArea.cellSize * 0.028);
    const grainOffsets = [
      { x: -0.34, y: 0.12 },
      { x: -0.26, y: 0.02 },
      { x: -0.18, y: 0.18 },
      { x: -0.08, y: -0.02 },
      { x: 0.04, y: 0.12 },
      { x: 0.16, y: 0.04 },
      { x: 0.26, y: 0.18 },
      { x: 0.34, y: 0.08 },
      { x: -0.22, y: 0.28 },
      { x: 0.12, y: 0.26 },
    ] as const;

    grainOffsets.forEach((offset, index) => {
      const grainColor = index % 3 === 0 ? soilLight : soilMid;

      this.graphics.fillStyle(grainColor, 0.85);
      this.graphics.fillCircle(
        center.x + moundBaseWidth * offset.x * 0.5,
        moundBaseY + moundBaseHeight * offset.y * 0.5,
        grainRadius,
      );
    });

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

  private drawSurfaceDefense(
    gridArea: GridArea,
    surfaceDefenseSnapshot: SurfaceDefenseSnapshot | undefined,
    animationTimeMs: number,
  ): void {
    if (surfaceDefenseSnapshot === undefined) {
      return;
    }

    this.drawSurfaceRewardFeedback(gridArea, surfaceDefenseSnapshot);

    if (surfaceDefenseSnapshot.activeThreat === null) {
      return;
    }

    const threat = surfaceDefenseSnapshot.activeThreat;
    const surfaceY = gridArea.y - gridArea.cellSize * 0.52;
    const exitCenter = this.getCellCenter(
      gridArea,
      constructionGridLayout.conduit.position,
    );
    const leftEdge = gridArea.x + gridArea.cellSize * 0.75;
    const rightEdge = gridArea.x + gridArea.width - gridArea.cellSize * 0.75;
    const threatX =
      threat.direction === 'left-to-right'
        ? this.Phaser.Math.Linear(leftEdge, rightEdge, threat.progress)
        : this.Phaser.Math.Linear(rightEdge, leftEdge, threat.progress);
    const threatY =
      surfaceY - gridArea.cellSize * 0.02 +
      Math.sin(animationTimeMs * 0.003 + threat.progress * 12) *
        gridArea.cellSize *
        0.025;
    const threatAngle =
      threat.direction === 'left-to-right' ? 0 : Math.PI;

    this.drawSurfaceThreat(gridArea, threatX, threatY, threatAngle, threat);
    this.drawSurfaceSoldierResponse(
      gridArea,
      exitCenter.x,
      surfaceY + gridArea.cellSize * 0.04,
      threatX,
      threatY + gridArea.cellSize * 0.02,
      surfaceDefenseSnapshot.engagedSoldierCount,
      animationTimeMs,
    );
  }

  private drawSurfaceRewardFeedback(
    gridArea: GridArea,
    surfaceDefenseSnapshot: SurfaceDefenseSnapshot,
  ): void {
    const rewardFeedback = surfaceDefenseSnapshot.rewardFeedback;

    if (rewardFeedback === null) {
      return;
    }

    const leftEdge = gridArea.x + gridArea.cellSize * 0.75;
    const rightEdge = gridArea.x + gridArea.width - gridArea.cellSize * 0.75;
    const progressX =
      rewardFeedback.direction === 'left-to-right'
        ? this.Phaser.Math.Linear(leftEdge, rightEdge, rewardFeedback.progress)
        : this.Phaser.Math.Linear(rightEdge, leftEdge, rewardFeedback.progress);
    const riseProgress = Math.min(1, rewardFeedback.elapsedMs / 950);
    const label = this.gameObjects.text(
      progressX,
      gridArea.y -
        gridArea.cellSize * (0.62 + riseProgress * 0.45),
      `+${rewardFeedback.gold} gold`,
      {
        color: constructionGridPalette.textWarning,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.max(11, Math.round(gridArea.cellSize * 0.18))}px`,
        fontStyle: '700',
        resolution: constructionTextResolution,
      },
    );

    label.setOrigin(0.5);
    label.setAlpha(1 - riseProgress);
    label.setShadow(
      1,
      1,
      constructionGridPalette.textShadow,
      2,
      true,
      true,
    );
    label.setDepth(3);
    this.entranceCounterLabels.push(label);
  }

  private drawSurfaceThreat(
    gridArea: GridArea,
    x: number,
    y: number,
    angle: number,
    threat: SurfaceThreatSnapshot,
  ): void {
    const scale = 1 + Math.min(0.9, threat.wave * 0.12);
    const bodyRadius = gridArea.cellSize * 0.11 * scale;
    const shellRadius = bodyRadius * 1.35;
    const spacing = bodyRadius * 1.8;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const abdomenX = x - directionX * spacing;
    const abdomenY = y - directionY * spacing;
    const headX = x + directionX * spacing * 0.78;
    const headY = y + directionY * spacing * 0.78;

    this.graphics.fillStyle(0x20140d, 0.95);
    this.graphics.fillEllipse(abdomenX, abdomenY, shellRadius * 2, shellRadius * 1.5);
    this.graphics.fillStyle(0x5f3c20, 0.96);
    this.graphics.fillEllipse(x, y, bodyRadius * 2.8, bodyRadius * 1.95);
    this.graphics.fillStyle(0x8e6438, 0.36);
    this.graphics.fillEllipse(
      x + directionX * bodyRadius * 0.25,
      y - bodyRadius * 0.18,
      bodyRadius * 1.65,
      bodyRadius * 0.55,
    );
    this.graphics.fillStyle(0x170d08, 0.95);
    this.graphics.fillCircle(headX, headY, bodyRadius * 0.68);

    this.graphics.lineStyle(2, 0x140b07, 0.6);
    for (let index = -1; index <= 1; index += 1) {
      const legBaseY = y + index * bodyRadius * 0.34;

      this.graphics.lineBetween(
        x - bodyRadius * 0.4,
        legBaseY,
        x - bodyRadius * 1.15,
        legBaseY + bodyRadius * 0.5,
      );
      this.graphics.lineBetween(
        x + bodyRadius * 0.35,
        legBaseY,
        x + bodyRadius * 1.1,
        legBaseY + bodyRadius * 0.45,
      );
    }

    const hpWidth = gridArea.cellSize * 0.82;
    const hpHeight = Math.max(3, gridArea.cellSize * 0.06);
    const hpX = x - hpWidth / 2;
    const hpY = y - gridArea.cellSize * 0.34;
    const hpRatio = Math.max(0, threat.currentHitPoints / threat.maxHitPoints);

    this.graphics.fillStyle(0x120d09, 0.92);
    this.graphics.fillRoundedRect(hpX, hpY, hpWidth, hpHeight, hpHeight / 2);
    this.graphics.fillStyle(0xd46a56, 0.92);
    this.graphics.fillRoundedRect(
      hpX,
      hpY,
      hpWidth * hpRatio,
      hpHeight,
      hpHeight / 2,
    );
  }

  private drawSurfaceSoldierResponse(
    gridArea: GridArea,
    exitX: number,
    exitY: number,
    threatX: number,
    threatY: number,
    engagedSoldierCount: number,
    animationTimeMs: number,
  ): void {
    const visibleSoldierCount = Math.min(4, engagedSoldierCount);

    for (let index = 0; index < visibleSoldierCount; index += 1) {
      const travel =
        ((animationTimeMs * 0.0009 + index * 0.18) % 0.9) + 0.05;
      const x = this.Phaser.Math.Linear(exitX, threatX, travel);
      const y =
        this.Phaser.Math.Linear(exitY, threatY, travel) +
        (index % 2 === 0 ? -1 : 1) * gridArea.cellSize * 0.04;
      const angle = Math.atan2(threatY - exitY, threatX - exitX);

      this.drawSoldierAntSprite(gridArea, x, y, angle, 500 + index);
    }
  }

  private drawSoldierAntSprite(
    gridArea: GridArea,
    x: number,
    y: number,
    angle: number,
    antIndex: number,
  ): void {
    this.drawAntSprite(gridArea, x, y, angle, antIndex);
    const glowDistance = Math.max(2, gridArea.cellSize * 0.08);
    const glowX = x + Math.cos(angle) * glowDistance;
    const glowY = y + Math.sin(angle) * glowDistance;

    this.graphics.fillStyle(0xd46a56, 0.55);
    this.graphics.fillCircle(glowX, glowY, Math.max(1.4, gridArea.cellSize * 0.03));
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

