import type { GameRuntimeSnapshot } from '@/game/engine/game-runtime';

export const GAME_RUNTIME_SNAPSHOT_EVENT =
  'antoria:game-runtime-snapshot' as const;

export const emitGameRuntimeSnapshotEvent = (
  target: Window,
  snapshot: GameRuntimeSnapshot,
): void => {
  target.dispatchEvent(
    new CustomEvent<GameRuntimeSnapshot>(GAME_RUNTIME_SNAPSHOT_EVENT, {
      detail: snapshot,
    }),
  );
};
