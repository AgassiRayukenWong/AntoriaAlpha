import { BrowserRuntimeLifecycle } from '@/game/engine/browser-runtime-lifecycle';
import { GameRuntime } from '@/game/engine/game-runtime';
import type { ConstructionGridPosition } from '@/game/simulation/construction-grid';

import {
  ConstructionGridRenderer,
  type ConstructionGridPointer,
} from './construction-grid-renderer';

import type PhaserType from 'phaser';

export const MAIN_SCENE_KEY = 'main';

export const createMainScene = (
  Phaser: typeof PhaserType,
): typeof PhaserType.Scene => {
  class MainScene extends Phaser.Scene {
    private constructionGridRenderer?: ConstructionGridRenderer;
    private browserRuntimeLifecycle?: BrowserRuntimeLifecycle;
    private constructionRevision = 0;
    private gameRuntime?: GameRuntime;
    private pointer?: ConstructionGridPointer;
    private renderedHeight = 0;
    private renderedConstructionRevision = 0;
    private renderedPointer?: ConstructionGridPointer;
    private renderedSelectedPosition?: ConstructionGridPosition;
    private renderedWidth = 0;
    private selectedPosition?: ConstructionGridPosition;

    public constructor() {
      super(MAIN_SCENE_KEY);
    }

    public create(): void {
      this.gameRuntime = new GameRuntime();
      this.browserRuntimeLifecycle = new BrowserRuntimeLifecycle({
        document,
        runtime: this.gameRuntime,
      });
      this.browserRuntimeLifecycle.start();
      this.constructionGridRenderer = new ConstructionGridRenderer(
        this.add.graphics(),
        Phaser,
      );
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
      this.drawScene();
      this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.events.once(
        Phaser.Scenes.Events.SHUTDOWN,
        this.handleShutdown,
        this,
      );
    }

    private handleResize(): void {
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
      this.browserRuntimeLifecycle?.stop();
      this.browserRuntimeLifecycle = undefined;
      this.gameRuntime?.dispose();
      this.gameRuntime = undefined;
    }

    public update(_time: number, deltaTimeMs: number): void {
      this.gameRuntime?.update(deltaTimeMs);
    }

    private handlePointerMove(pointer: PhaserType.Input.Pointer): void {
      this.pointer = {
        x: pointer.x,
        y: pointer.y,
      };
      this.drawScene();
    }

    private handlePointerDown(pointer: PhaserType.Input.Pointer): void {
      if (!this.constructionGridRenderer) {
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
        );

      if (
        this.selectedPosition !== undefined &&
        this.constructionGridRenderer.placeGalleryAtPosition(
          this.selectedPosition,
        )
      ) {
        this.constructionRevision += 1;
      }

      this.drawScene();
    }

    private handlePointerOut(): void {
      this.pointer = undefined;
      this.drawScene();
    }

    private drawScene(): void {
      if (!this.constructionGridRenderer) {
        return;
      }

      const width = this.scale.width;
      const height = this.scale.height;

      if (
        width === this.renderedWidth &&
        height === this.renderedHeight &&
        this.constructionRevision === this.renderedConstructionRevision &&
        this.isRenderedPointerCurrent() &&
        this.isRenderedSelectedPositionCurrent()
      ) {
        return;
      }

      this.renderedWidth = width;
      this.renderedHeight = height;
      this.renderedConstructionRevision = this.constructionRevision;
      this.renderedPointer = this.pointer;
      this.renderedSelectedPosition = this.selectedPosition;
      this.constructionGridRenderer.render(
        width,
        height,
        this.pointer,
        this.selectedPosition,
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
