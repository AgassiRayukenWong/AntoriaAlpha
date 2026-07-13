import { describe, expect, it } from 'vitest';

import { GameClock } from '@/game/simulation/game-clock';

describe('GameClock', () => {
  it('keeps partial elapsed time until a full tick is available', () => {
    const gameClock = new GameClock({ tickDurationMs: 100 });

    const result = gameClock.advance(40);

    expect(result).toEqual({
      processedTickCount: 0,
      remainingAccumulatedTimeMs: 40,
      simulationTimeMs: 0,
      totalTickCount: 0,
    });
  });

  it('processes fixed ticks and carries the remaining time', () => {
    const gameClock = new GameClock({ tickDurationMs: 100 });

    gameClock.advance(70);
    const result = gameClock.advance(250);

    expect(result).toEqual({
      processedTickCount: 3,
      remainingAccumulatedTimeMs: 20,
      simulationTimeMs: 300,
      totalTickCount: 3,
    });
  });

  it('exposes a snapshot without changing the clock', () => {
    const gameClock = new GameClock({ tickDurationMs: 50 });

    gameClock.advance(125);

    expect(gameClock.getSnapshot()).toEqual({
      remainingAccumulatedTimeMs: 25,
      simulationTimeMs: 100,
      tickDurationMs: 50,
      totalTickCount: 2,
    });
  });

  it('can be reset', () => {
    const gameClock = new GameClock({ tickDurationMs: 100 });

    gameClock.advance(250);
    gameClock.reset();

    expect(gameClock.getSnapshot()).toEqual({
      remainingAccumulatedTimeMs: 0,
      simulationTimeMs: 0,
      tickDurationMs: 100,
      totalTickCount: 0,
    });
  });

  it('rejects invalid time values', () => {
    expect(() => new GameClock({ tickDurationMs: 0 })).toThrow(RangeError);
    expect(() => new GameClock({ tickDurationMs: Number.NaN })).toThrow(
      RangeError,
    );

    const gameClock = new GameClock({ tickDurationMs: 100 });

    expect(() => gameClock.advance(-1)).toThrow(RangeError);
    expect(() => gameClock.advance(Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    );
  });
});
