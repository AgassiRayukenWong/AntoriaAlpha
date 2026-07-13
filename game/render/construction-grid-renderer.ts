import {
  areGalleryPiecesConnected,
  createConstructionGrid,
  getDirectionBetweenAdjacentPositions,
  getGalleryPieceOccupiedPositions,
  GridDirection,
  isGridPositionOccupied,
  placeGalleryPiece,
  removeGalleryPiece,
  type ConstructionGridPosition,
  type ConstructionGrid,
  type ConstructionGridConduit,
  type GalleryPiece,
} from '@/game/simulation/construction-grid';
import { createGalleryPieceFromDefinition } from '@/game/simulation/gallery-piece-catalog';

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

export interface ConstructionGridPointer {
  readonly x: number;
  readonly y: number;
}

const constructionGridPalette = {
  base: 0x100f0b,
  conduitBorder: 0x8f7a55,
  conduitFill: 0x242017,
  conduitInner: 0x0b0a08,
  depthBands: [0x17130f, 0x1d1711, 0x241b13, 0x1b1510, 0x120f0c],
  gridBorder: 0x5f5440,
  gridBlockedHover: 0xb85b4b,
  gridLine: 0x6d6048,
  gridHover: 0xd0b071,
  gridBlockedSelection: 0xd46a56,
  gridSelection: 0xf0c76a,
  galleryBorder: 0xb2874c,
  galleryFill: 0x6b4424,
  galleryHighlight: 0xd0b071,
  galleryShadow: 0x0a0705,
  moss: 0x64734b,
  roomFill: 0x50341f,
  roomHighlight: 0xe0c08a,
  roomInnerShadow: 0x24160d,
  soilLine: 0x78644a,
  softLight: 0x93a66f,
  surface: 0x0d160f,
} as const;

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
  rows: 9,
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
      definitionId: 'small-room',
      pieceId: 'sample-gallery-6',
      position: { column: 14, row: 2 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'straight-horizontal',
      pieceId: 'sample-gallery-7',
      position: { column: 11, row: 3 },
    }),
    createGalleryPieceFromDefinition({
      definitionId: 'small-room',
      pieceId: 'sample-gallery-8',
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
};

export class ConstructionGridRenderer {
  private constructionGrid: ConstructionGrid;
  private placedGalleryIndex = 1;

  public constructor(
    private readonly graphics: PhaserType.GameObjects.Graphics,
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
  ): void {
    const gridArea = this.createGridArea(width, height);

    this.graphics.clear();
    this.drawBackground(width, height);
    this.drawSurface(width, height, gridArea);
    this.drawSoilTexture(width, height);
    this.drawSoftLight(width, height, gridArea);
    this.drawGrid(gridArea);
    this.drawSelectedGridCell(gridArea, selectedPosition);
    this.drawHoveredGridCell(gridArea, pointer);
    this.drawGalleryPieces(gridArea, this.constructionGrid.pieces);
    this.drawConduit(gridArea, constructionGridLayout.conduit);
  }

  public getGridPositionAtPointer(
    width: number,
    height: number,
    pointer: ConstructionGridPointer,
  ): ConstructionGridPosition | undefined {
    const gridArea = this.createGridArea(width, height);
    const position = this.getGridPositionAtPoint(gridArea, pointer);

    if (position === undefined) {
      return undefined;
    }

    return position;
  }

  public placeGalleryAtPosition(position: ConstructionGridPosition): boolean {
    if (isGridPositionOccupied(this.constructionGrid, position)) {
      return false;
    }

    const definitionId = this.getGalleryDefinitionIdForPosition(position);
    const piece = createGalleryPieceFromDefinition({
      definitionId,
      pieceId: `placed-gallery-${this.placedGalleryIndex}`,
      position,
    });

    this.constructionGrid = placeGalleryPiece(this.constructionGrid, piece);
    this.refreshGalleryPiecesAroundPosition(position);
    this.placedGalleryIndex += 1;

    return true;
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
    return this.constructionGrid.pieces.find(
      (piece) =>
        piece.size.columns === 1 &&
        piece.size.rows === 1 &&
        piece.position.column === position.column &&
        piece.position.row === position.row,
    );
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

  private createGridArea(width: number, height: number): GridArea {
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
        (constructionGridLayout.rows + constructionGridLayout.reservedTopRows),
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
        reservedTopHeight,
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

  private drawHoveredGridCell(
    gridArea: GridArea,
    pointer: ConstructionGridPointer | undefined,
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
    const isOccupied = isGridPositionOccupied(this.constructionGrid, {
      column: position.column,
      row: position.row,
    });
    const hoverColor = isOccupied
      ? constructionGridPalette.gridBlockedHover
      : constructionGridPalette.gridHover;
    const fillAlpha = isOccupied ? 0.1 : 0.08;
    const strokeAlpha = isOccupied ? 0.55 : 0.42;

    this.graphics.fillStyle(hoverColor, fillAlpha);
    this.graphics.fillRect(x, y, gridArea.cellSize, gridArea.cellSize);
    this.graphics.lineStyle(2, hoverColor, strokeAlpha);
    this.graphics.strokeRect(x, y, gridArea.cellSize, gridArea.cellSize);
  }

  private drawSelectedGridCell(
    gridArea: GridArea,
    selectedPosition: ConstructionGridPosition | undefined,
  ): void {
    if (selectedPosition === undefined) {
      return;
    }

    const x = gridArea.x + selectedPosition.column * gridArea.cellSize;
    const y = gridArea.y + selectedPosition.row * gridArea.cellSize;
    const isOccupied = isGridPositionOccupied(
      this.constructionGrid,
      selectedPosition,
    );
    const selectionColor = isOccupied
      ? constructionGridPalette.gridBlockedSelection
      : constructionGridPalette.gridSelection;

    this.graphics.fillStyle(selectionColor, 0.14);
    this.graphics.fillRect(x, y, gridArea.cellSize, gridArea.cellSize);
    this.graphics.lineStyle(3, selectionColor, 0.78);
    this.graphics.strokeRect(x, y, gridArea.cellSize, gridArea.cellSize);
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

      this.graphics.fillStyle(constructionGridPalette.roomFill, 0.9);
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
    });
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
    this.drawConduitDirection(center.x, center.y, radius, conduit.direction);
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
  ): void {
    const angle = this.getDirectionAngle(direction);
    const arrowLength = radius * 0.85;
    const endX = x + Math.cos(angle) * arrowLength;
    const endY = y + Math.sin(angle) * arrowLength;

    this.graphics.lineStyle(2, constructionGridPalette.conduitBorder, 0.85);
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
