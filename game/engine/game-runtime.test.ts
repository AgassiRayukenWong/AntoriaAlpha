import { describe, expect, it, vi } from 'vitest';

import { GameRuntime } from '@/game/engine/game-runtime';

describe('GameRuntime', () => {
  it('advances the simulation with fixed ticks', () => {
    const gameRuntime = new GameRuntime({ simulationTickDurationMs: 100 });

    expect(gameRuntime.update(40)).toMatchObject({
      processedTickCount: 0,
      remainingAccumulatedTimeMs: 40,
      simulationTimeMs: 0,
      totalTickCount: 0,
    });

    expect(gameRuntime.update(80)).toMatchObject({
      processedTickCount: 1,
      remainingAccumulatedTimeMs: 20,
      simulationTimeMs: 100,
      totalTickCount: 1,
    });
  });

  it('can be reset', () => {
    const gameRuntime = new GameRuntime({ simulationTickDurationMs: 100 });

    gameRuntime.update(250);
    gameRuntime.reset();

    expect(gameRuntime.update(100)).toMatchObject({
      processedTickCount: 1,
      remainingAccumulatedTimeMs: 0,
      simulationTimeMs: 100,
      totalTickCount: 1,
    });
  });

  it('updates configured simulation systems', () => {
    const updateSystem = vi.fn();
    const gameRuntime = new GameRuntime({
      simulationTickDurationMs: 100,
      systems: [
        {
          update: updateSystem,
        },
      ],
    });

    const result = gameRuntime.update(250);

    expect(result.executedSystemUpdateCount).toBe(2);
    expect(updateSystem).toHaveBeenCalledTimes(2);
    expect(updateSystem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tickIndex: 1,
      }),
    );
    expect(updateSystem).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tickIndex: 2,
      }),
    );
  });

  it('clamps large delta times before advancing the simulation', () => {
    const gameRuntime = new GameRuntime({
      maximumDeltaTimeMs: 250,
      simulationTickDurationMs: 100,
    });

    expect(gameRuntime.update(1_000)).toMatchObject({
      processedTickCount: 2,
      remainingAccumulatedTimeMs: 50,
      simulationTimeMs: 200,
      totalTickCount: 2,
    });
  });

  it('does not advance while paused', () => {
    const gameRuntime = new GameRuntime({ simulationTickDurationMs: 100 });

    gameRuntime.update(250);
    gameRuntime.pause();

    expect(gameRuntime.update(1_000)).toEqual({
      executedSystemUpdateCount: 0,
      processedTickCount: 0,
      remainingAccumulatedTimeMs: 50,
      simulationTimeMs: 200,
      totalTickCount: 2,
    });
  });

  it('continues advancing after resume', () => {
    const gameRuntime = new GameRuntime({ simulationTickDurationMs: 100 });

    gameRuntime.pause();
    gameRuntime.update(1_000);
    gameRuntime.resume();

    expect(gameRuntime.update(100)).toMatchObject({
      processedTickCount: 1,
      remainingAccumulatedTimeMs: 0,
      simulationTimeMs: 100,
      totalTickCount: 1,
    });
  });

  it('exposes a runtime snapshot', () => {
    const gameRuntime = new GameRuntime({
      maximumDeltaTimeMs: 250,
      simulationTickDurationMs: 100,
    });

    gameRuntime.update(250);
    gameRuntime.pause();

    expect(gameRuntime.getSnapshot()).toEqual({
      isPaused: true,
      maximumDeltaTimeMs: 250,
      simulation: {
        remainingAccumulatedTimeMs: 50,
        simulationTimeMs: 200,
        tickDurationMs: 100,
        totalTickCount: 2,
      },
    });
  });

  it('notifies snapshot subscribers immediately and after runtime changes', () => {
    const gameRuntime = new GameRuntime({ simulationTickDurationMs: 100 });
    const listener = vi.fn();

    gameRuntime.subscribeToSnapshots(listener);
    gameRuntime.update(100);
    gameRuntime.pause();

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        isPaused: false,
      }),
    );
    expect(listener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        simulation: expect.objectContaining({
          totalTickCount: 1,
        }),
      }),
    );
    expect(listener).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        isPaused: true,
      }),
    );
  });

  it('stops notifying an unsubscribed snapshot listener', () => {
    const gameRuntime = new GameRuntime({ simulationTickDurationMs: 100 });
    const listener = vi.fn();
    const unsubscribe = gameRuntime.subscribeToSnapshots(listener);

    unsubscribe();
    gameRuntime.update(100);

    expect(listener).toHaveBeenCalledOnce();
  });

  it('clears snapshot listeners when disposed', () => {
    const gameRuntime = new GameRuntime({ simulationTickDurationMs: 100 });
    const listener = vi.fn();

    gameRuntime.subscribeToSnapshots(listener);
    gameRuntime.dispose();
    gameRuntime.update(100);
    gameRuntime.pause();

    expect(listener).toHaveBeenCalledOnce();
    expect(gameRuntime.getSnapshot().isPaused).toBe(true);
  });
});
