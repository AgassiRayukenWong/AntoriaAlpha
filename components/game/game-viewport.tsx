'use client';

import { useEffect, useRef } from 'react';

import { createGame } from '@/game/engine/create-game';
import { gameViewportLabels } from '@/lib/labels';

export function GameViewport() {
  const containerRef = useRef<HTMLElement>(null);

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

  return (
    <section
      ref={containerRef}
      className="game-viewport"
      aria-label={gameViewportLabels.viewport}
    />
  );
}
