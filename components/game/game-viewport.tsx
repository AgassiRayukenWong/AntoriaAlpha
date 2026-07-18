'use client';

import { useEffect, useRef, useState } from 'react';

import { createGame } from '@/game/engine/create-game';
import type { GameRuntimeSnapshot } from '@/game/engine/game-runtime';
import { GAME_RUNTIME_SNAPSHOT_EVENT } from '@/game/engine/runtime-snapshot-event';
import { gameViewportLabels } from '@/lib/labels';

function formatSurvivalTime(survivalTimeMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(survivalTimeMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function GameViewport() {
  const containerRef = useRef<HTMLElement>(null);
  const [snapshot, setSnapshot] = useState<GameRuntimeSnapshot | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let isDisposed = false;
    let game: Awaited<ReturnType<typeof createGame>> | undefined;

    const mountGame = async () => {
      const createdGame = await createGame(container);

      if (isDisposed) {
        createdGame.destroy(true);
        return;
      }

      game = createdGame;
    };

    void mountGame();

    return () => {
      isDisposed = true;
      game?.destroy(true);
    };
  }, []);

  useEffect(() => {
    const handleSnapshot = (event: Event) => {
      setSnapshot((event as CustomEvent<GameRuntimeSnapshot>).detail);
    };

    window.addEventListener(GAME_RUNTIME_SNAPSHOT_EVENT, handleSnapshot);

    return () => {
      window.removeEventListener(GAME_RUNTIME_SNAPSHOT_EVENT, handleSnapshot);
    };
  }, []);

  const gameOverSnapshot = snapshot?.isGameOver ? snapshot : null;
  const currentRoundSnapshot = snapshot?.surfaceDefense ?? null;

  return (
    <section
      ref={containerRef}
      className="game-viewport"
      aria-label={gameViewportLabels.viewport}
    >
      {currentRoundSnapshot !== null ? (
        <aside className="game-viewport__round-panel" aria-label="Ennemis du round">
          <div className="game-viewport__round-panel-header">
            <span className="game-viewport__round-panel-eyebrow">Surface</span>
            <strong className="game-viewport__round-panel-title">
              Round {currentRoundSnapshot.wave}
            </strong>
          </div>
          <div className="game-viewport__round-panel-list">
            {currentRoundSnapshot.currentRoundEnemies.map((enemy) => (
              <div
                className="game-viewport__round-panel-item"
                key={`${enemy.kind}-${enemy.level}-${enemy.hitPoints}`}
              >
                <span className="game-viewport__round-panel-item-text">
                  x{enemy.quantity} {enemy.label} lvl {enemy.level}
                </span>
                <span className="game-viewport__round-panel-item-value">
                  ({enemy.hitPoints} PDV)
                </span>
              </div>
            ))}
          </div>
        </aside>
      ) : null}
      {gameOverSnapshot !== null ? (
        <div className="game-viewport__game-over" role="dialog" aria-modal="true">
          <div className="game-viewport__game-over-panel">
            <span className="game-viewport__game-over-eyebrow">Fin de partie</span>
            <h2 className="game-viewport__game-over-title">La colonie a cédé</h2>
            <div className="game-viewport__game-over-stats">
              <div className="game-viewport__game-over-stat">
                <span className="game-viewport__game-over-stat-label">Score</span>
                <strong className="game-viewport__game-over-stat-value">
                  {gameOverSnapshot.surfaceDefense.score}
                </strong>
              </div>
              <div className="game-viewport__game-over-stat">
                <span className="game-viewport__game-over-stat-label">Temps</span>
                <strong className="game-viewport__game-over-stat-value">
                  {formatSurvivalTime(gameOverSnapshot.surfaceDefense.survivalTimeMs)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
