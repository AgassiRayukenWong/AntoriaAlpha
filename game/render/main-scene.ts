import { BrowserRuntimeLifecycle } from '@/game/engine/browser-runtime-lifecycle';
import { GameRuntime } from '@/game/engine/game-runtime';
import { emitGameRuntimeSnapshotEvent } from '@/game/engine/runtime-snapshot-event';
import type { ConstructionGridPosition } from '@/game/simulation/construction-grid';

import {
  ConstructionGridRenderer,
  ConstructionPieceType,
  ConstructionToolMode,
  type ConstructionGridPointer,
} from './construction-grid-renderer';

import type PhaserType from 'phaser';

export const MAIN_SCENE_KEY = 'main';

export const createMainScene = (
  Phaser: typeof PhaserType,
): typeof PhaserType.Scene => {
  class MainScene extends Phaser.Scene {
    private antAnimationTimeMs = 0;
    private constructionGridRenderer?: ConstructionGridRenderer;
    private browserRuntimeLifecycle?: BrowserRuntimeLifecycle;
    private constructionRevision = 0;
    private gameRuntime?: GameRuntime;
    private gameRuntimeSnapshotUnsubscribe?: () => void;
    private floatingMenuSlideProgress = 0;
    private gridScrollY = 0;
    private isFloatingMenuCollapsed = false;
    private pointer?: ConstructionGridPointer;
    private renderedHeight = 0;
    private renderedConstructionRevision = 0;
    private renderedAntAnimationFrame = -1;
    private renderedGridScrollY = 0;
    private renderedFloatingMenuSlideProgress = 0;
    private renderedIsFloatingMenuCollapsed = false;
    private renderedPointer?: ConstructionGridPointer;
    private renderedSelectedPieceType = ConstructionPieceType.Gallery;
    private renderedSelectedPosition?: ConstructionGridPosition;
    private renderedToolMode = ConstructionToolMode.Build;
    private renderedWidth = 0;
    private selectedPieceType = ConstructionPieceType.Gallery;
    private selectedPosition?: ConstructionGridPosition;
    private toolMode = ConstructionToolMode.Build;
    private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
      this.handleKeyDown(event);
    };

    public constructor() {
      super(MAIN_SCENE_KEY);
    }

    public create(): void {
      this.gameRuntime = new GameRuntime();
      this.gameRuntimeSnapshotUnsubscribe =
        this.gameRuntime.subscribeToSnapshots((snapshot) => {
          emitGameRuntimeSnapshotEvent(window, snapshot);
        });
      this.browserRuntimeLifecycle = new BrowserRuntimeLifecycle({
        document,
        runtime: this.gameRuntime,
      });
      this.browserRuntimeLifecycle.start();
      this.constructionGridRenderer = new ConstructionGridRenderer(
        this.add.graphics(),
        this.add,
        Phaser,
      );
      this.syncColonyInfrastructure();
      this.input.mouse?.disableContextMenu();
      this.input.on(
        Phaser.Input.Events.POINTER_MOVE,
        this.handlePointerMove,
        this,
      );
      this.input.on(
        Phaser.Input.Events.POINTER_DOWN,
        this.handlePointerDown,
        this,
      );
      this.input.on(
        Phaser.Input.Events.POINTER_OUT,
        this.handlePointerOut,
        this,
      );
      this.input.on(
        Phaser.Input.Events.POINTER_WHEEL,
        this.handlePointerWheel,
        this,
      );
      document.addEventListener('keydown', this.handleDocumentKeyDown);
      this.drawScene();
      this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.events.once(
        Phaser.Scenes.Events.SHUTDOWN,
        this.handleShutdown,
        this,
      );
    }

    private handleResize(): void {
      this.clampGridScrollY();
      this.drawScene();
    }

    private handleShutdown(): void {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.input.off(
        Phaser.Input.Events.POINTER_MOVE,
        this.handlePointerMove,
        this,
      );
      this.input.off(
        Phaser.Input.Events.POINTER_DOWN,
        this.handlePointerDown,
        this,
      );
      this.input.off(
        Phaser.Input.Events.POINTER_OUT,
        this.handlePointerOut,
        this,
      );
      this.input.off(
        Phaser.Input.Events.POINTER_WHEEL,
        this.handlePointerWheel,
        this,
      );
      document.removeEventListener('keydown', this.handleDocumentKeyDown);
      this.browserRuntimeLifecycle?.stop();
      this.browserRuntimeLifecycle = undefined;
      this.gameRuntimeSnapshotUnsubscribe?.();
      this.gameRuntimeSnapshotUnsubscribe = undefined;
      this.constructionGridRenderer?.destroy();
      this.constructionGridRenderer = undefined;
      this.gameRuntime?.dispose();
      this.gameRuntime = undefined;
    }

    public update(_time: number, deltaTimeMs: number): void {
      this.gameRuntime?.update(deltaTimeMs);
      this.antAnimationTimeMs += deltaTimeMs;

      if (this.updateFloatingMenuTransition(deltaTimeMs)) {
        this.drawScene();
        return;
      }

      this.drawScene();
    }

    private handlePointerMove(pointer: PhaserType.Input.Pointer): void {
      this.pointer = {
        x: pointer.x,
        y: pointer.y,
      };
      this.drawScene();
    }

    private handlePointerDown(pointer: PhaserType.Input.Pointer): void {
      if (
        !this.constructionGridRenderer ||
        this.gameRuntime?.getSnapshot().isGameOver
      ) {
        return;
      }

      const toolMode = this.constructionGridRenderer.getToolModeAtPointer(
        this.scale.width,
        this.scale.height,
        {
          x: pointer.x,
          y: pointer.y,
        },
        this.isFloatingMenuCollapsed,
      );

      if (toolMode !== undefined) {
        this.setToolMode(toolMode);
        return;
      }

      const selectedPieceType =
        this.constructionGridRenderer.getConstructionPieceTypeAtPointer(
          this.scale.width,
          this.scale.height,
          {
            x: pointer.x,
            y: pointer.y,
          },
          this.isFloatingMenuCollapsed,
        );

      if (selectedPieceType !== undefined) {
        this.setSelectedPieceType(selectedPieceType);
        return;
      }

      if (
        this.constructionGridRenderer.isFloatingMenuToggleAtPointer(
          this.scale.width,
          this.scale.height,
          {
            x: pointer.x,
            y: pointer.y,
          },
        )
      ) {
        this.toggleFloatingMenu();
        return;
      }

      if (
        this.constructionGridRenderer.isFloatingMenuPanelAtPointer(
          this.scale.width,
          this.scale.height,
          {
            x: pointer.x,
            y: pointer.y,
          },
          this.floatingMenuSlideProgress,
        )
      ) {
        this.drawScene();
        return;
      }

      this.selectedPosition =
        this.constructionGridRenderer.getGridPositionAtPointer(
          this.scale.width,
          this.scale.height,
          {
            x: pointer.x,
            y: pointer.y,
          },
          this.gridScrollY,
        );

      if (this.selectedPosition === undefined) {
        this.drawScene();
        return;
      }

      if (
        pointer.rightButtonDown() &&
        this.removeGalleryAtSelectedPosition()
      ) {
        this.syncColonyInfrastructure();
        this.constructionRevision += 1;
        this.drawScene();
        return;
      }

      if (
        pointer.leftButtonDown() &&
        this.applyActiveToolAtSelectedPosition()
      ) {
        this.syncColonyInfrastructure();
        this.constructionRevision += 1;
      }

      this.drawScene();
    }

    private handleKeyDown(event: KeyboardEvent): void {
      if (event.code === 'Tab') {
        event.preventDefault();
        this.toggleFloatingMenu();
        return;
      }

      if (event.code === 'Digit1' || event.code === 'Numpad1') {
        this.setSelectedPieceType(ConstructionPieceType.Gallery);
        return;
      }

      if (event.code === 'Digit2' || event.code === 'Numpad2') {
        this.setSelectedPieceType(ConstructionPieceType.BroodChamber);
        return;
      }

      if (event.code === 'Digit3' || event.code === 'Numpad3') {
        this.setSelectedPieceType(ConstructionPieceType.Barracks);
        return;
      }

      if (event.code === 'Digit4' || event.code === 'Numpad4') {
        this.setSelectedPieceType(ConstructionPieceType.Storage);
        return;
      }

      if (event.code === 'Digit5' || event.code === 'Numpad5') {
        this.setSelectedPieceType(ConstructionPieceType.FungusFarm);
        return;
      }

      if (event.code === 'KeyB') {
        this.setToolMode(ConstructionToolMode.Build);
        return;
      }

      if (event.code === 'KeyD') {
        this.setToolMode(ConstructionToolMode.Destroy);
        return;
      }

      if (event.code === 'KeyE') {
        this.setToolMode(ConstructionToolMode.Improve);
      }
    }

    private setToolMode(toolMode: ConstructionToolMode): void {
      if (this.toolMode === toolMode) {
        this.drawScene();
        return;
      }

      this.toolMode = toolMode;
      this.drawScene();
    }

    private setSelectedPieceType(pieceType: ConstructionPieceType): void {
      if (this.selectedPieceType === pieceType) {
        this.drawScene();
        return;
      }

      this.selectedPieceType = pieceType;
      this.toolMode = ConstructionToolMode.Build;
      this.drawScene();
    }

    private toggleFloatingMenu(): void {
      this.isFloatingMenuCollapsed = !this.isFloatingMenuCollapsed;
      this.drawScene();
    }

    private updateFloatingMenuTransition(deltaTimeMs: number): boolean {
      const targetProgress = this.isFloatingMenuCollapsed ? 1 : 0;

      if (this.floatingMenuSlideProgress === targetProgress) {
        return false;
      }

      const previousProgress = this.floatingMenuSlideProgress;
      const transitionDurationMs = 180;
      const progressDelta = deltaTimeMs / transitionDurationMs;

      if (this.floatingMenuSlideProgress < targetProgress) {
        this.floatingMenuSlideProgress = Math.min(
          targetProgress,
          this.floatingMenuSlideProgress + progressDelta,
        );
      } else {
        this.floatingMenuSlideProgress = Math.max(
          targetProgress,
          this.floatingMenuSlideProgress - progressDelta,
        );
      }

      return this.floatingMenuSlideProgress !== previousProgress;
    }

    private applyActiveToolAtSelectedPosition(): boolean {
      if (
        !this.constructionGridRenderer ||
        this.selectedPosition === undefined
      ) {
        return false;
      }

      if (this.toolMode === ConstructionToolMode.Destroy) {
        return this.removeGalleryAtSelectedPosition();
      }

      if (this.toolMode === ConstructionToolMode.Improve) {
        const upgradeRequest =
          this.constructionGridRenderer.getPieceUpgradeRequestAtPosition(
            this.selectedPosition,
          );

        if (
          upgradeRequest === undefined ||
          !this.gameRuntime?.tryUpgradeRoom(
            upgradeRequest.definitionId,
            upgradeRequest.currentLevel,
          )
        ) {
          return false;
        }

        const didUpgrade = this.constructionGridRenderer.tryUpgradePieceAtPosition(
          this.selectedPosition,
        );

        if (!didUpgrade) {
          return false;
        }

        return true;
      }

      const constructionCost = this.constructionGridRenderer.getConstructionPieceCost(
        this.selectedPieceType,
      );

      if (!this.gameRuntime?.tryPurchaseConstruction(constructionCost)) {
        return false;
      }

      return this.constructionGridRenderer.placeConstructionPieceAtPosition(
        this.selectedPosition,
        this.selectedPieceType,
      );
    }

    private removeGalleryAtSelectedPosition(): boolean {
      if (
        !this.constructionGridRenderer ||
        this.selectedPosition === undefined
      ) {
        return false;
      }

      return this.constructionGridRenderer.removeGalleryAtPosition(
        this.selectedPosition,
      );
    }

    private handlePointerOut(): void {
      this.pointer = undefined;
      this.drawScene();
    }

    private handlePointerWheel(
      _pointer: PhaserType.Input.Pointer,
      _currentlyOver: readonly PhaserType.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ): void {
      this.gridScrollY += deltaY * 0.65;
      this.clampGridScrollY();
      this.drawScene();
    }

    private clampGridScrollY(): void {
      if (!this.constructionGridRenderer) {
        this.gridScrollY = 0;
        return;
      }

      const maximumGridScrollY =
        this.constructionGridRenderer.getMaximumGridScrollY(
          this.scale.width,
          this.scale.height,
        );

      this.gridScrollY = Phaser.Math.Clamp(
        this.gridScrollY,
        0,
        maximumGridScrollY,
      );
    }

    private syncColonyInfrastructure(): void {
      if (!this.gameRuntime || !this.constructionGridRenderer) {
        return;
      }

      this.gameRuntime.setColonyInfrastructure(
        this.constructionGridRenderer.getColonyRoomCounts(),
        this.constructionGridRenderer.getColonyRoomUpgradeTotals(),
      );
    }

    private drawScene(): void {
      if (!this.constructionGridRenderer) {
        return;
      }

      const width = this.scale.width;
      const height = this.scale.height;
      const antAnimationFrame = Math.floor(this.antAnimationTimeMs / 40);

      if (
        width === this.renderedWidth &&
        height === this.renderedHeight &&
        antAnimationFrame === this.renderedAntAnimationFrame &&
        this.constructionRevision === this.renderedConstructionRevision &&
        this.gridScrollY === this.renderedGridScrollY &&
        this.floatingMenuSlideProgress ===
          this.renderedFloatingMenuSlideProgress &&
        this.isFloatingMenuCollapsed ===
          this.renderedIsFloatingMenuCollapsed &&
        this.toolMode === this.renderedToolMode &&
        this.selectedPieceType === this.renderedSelectedPieceType &&
        this.isRenderedPointerCurrent() &&
        this.isRenderedSelectedPositionCurrent()
      ) {
        return;
      }

      this.renderedWidth = width;
      this.renderedHeight = height;
      this.renderedAntAnimationFrame = antAnimationFrame;
      this.renderedConstructionRevision = this.constructionRevision;
      this.renderedGridScrollY = this.gridScrollY;
      this.renderedFloatingMenuSlideProgress = this.floatingMenuSlideProgress;
      this.renderedIsFloatingMenuCollapsed = this.isFloatingMenuCollapsed;
      this.renderedPointer = this.pointer;
      this.renderedSelectedPieceType = this.selectedPieceType;
      this.renderedSelectedPosition = this.selectedPosition;
      this.renderedToolMode = this.toolMode;
      this.constructionGridRenderer.render(
        width,
        height,
        this.pointer,
        this.selectedPosition,
        this.toolMode,
        this.selectedPieceType,
        this.gridScrollY,
        this.isFloatingMenuCollapsed,
        this.floatingMenuSlideProgress,
        this.antAnimationTimeMs,
        this.gameRuntime?.getSnapshot().colony,
        this.gameRuntime?.getSnapshot().surfaceDefense,
      );
    }

    private isRenderedPointerCurrent(): boolean {
      if (this.pointer === undefined || this.renderedPointer === undefined) {
        return this.pointer === this.renderedPointer;
      }

      return (
        this.pointer.x === this.renderedPointer.x &&
        this.pointer.y === this.renderedPointer.y
      );
    }

    private isRenderedSelectedPositionCurrent(): boolean {
      if (
        this.selectedPosition === undefined ||
        this.renderedSelectedPosition === undefined
      ) {
        return this.selectedPosition === this.renderedSelectedPosition;
      }

      return (
        this.selectedPosition.column === this.renderedSelectedPosition.column &&
        this.selectedPosition.row === this.renderedSelectedPosition.row
      );
    }
  }

  return MainScene;
};
