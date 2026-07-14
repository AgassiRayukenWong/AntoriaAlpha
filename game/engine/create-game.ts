import { createMainScene } from '@/game/render/main-scene';

import type PhaserType from 'phaser';

const GAME_BACKGROUND_COLOR = '#211b15';

export async function createGame(
  parent: HTMLElement,
): Promise<PhaserType.Game> {
  const Phaser = await import('phaser');

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: GAME_BACKGROUND_COLOR,
    scene: [createMainScene(Phaser)],
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth,
      height: parent.clientHeight,
    },
  });
}
