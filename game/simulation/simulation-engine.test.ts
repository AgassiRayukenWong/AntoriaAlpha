import { describe, expect, it } from 'vitest';

import { GameClock } from '@/game/simulation/game-clock';
import {
  SimulationEngine,
  type SimulationTickContext,
} from '@/game/simulation/simulation-engine';

describe('SimulationEngine', () => {
  it('does not update systems before a full tick is available', () => {
    const receivedContexts: SimulationTickContext[] = [];
    const simulationEngine = new SimulationEngine({
      clock: new GameClock({ tickDurationMs: 100 }),
      systems: [
        {
          update: (context) => {
            receivedContexts.push(context);
          },
        },
      ],
    });

    const result = simulationEngine.step(40);

    expect(result.executedSystemUpdateCount).toBe(0);
    expect(receivedContexts).toEqual([]);
  });

  it('updates each system once per processed tick in order', () => {
    const updateOrder: string[] = [];
    const receivedContexts: SimulationTickContext[] = [];
    const simulationEngine = new SimulationEngine({
      clock: new GameClock({ tickDurationMs: 100 }),
      systems: [
        {
          update: (context) => {
            updateOrder.push('first');
            receivedContexts.push(context);
          },
        },
        {
          update: () => {
            updateOrder.push('second');
          },
        },
      ],
    });

    const result = simulationEngine.step(250);

    expect(result.executedSystemUpdateCount).toBe(4);
    expect(updateOrder).toEqual(['first', 'second', 'first', 'second']);
    expect(receivedContexts).toEqual([
      {
        simulationTimeMs: 100,
        tickDurationMs: 100,
        tickIndex: 1,
      },
      {
        simulationTimeMs: 200,
        tickDurationMs: 100,
        tickIndex: 2,
      },
    ]);
  });

  it('keeps its own system list when the source list changes', () => {
    const updateOrder: string[] = [];
    const systems = [
      {
        update: () => {
          updateOrder.push('first');
        },
      },
    ];
    const simulationEngine = new SimulationEngine({
      clock: new GameClock({ tickDurationMs: 100 }),
      systems,
    });

    systems.push({
      update: () => {
        updateOrder.push('second');
      },
    });

    const result = simulationEngine.step(100);

    expect(result.executedSystemUpdateCount).toBe(1);
    expect(updateOrder).toEqual(['first']);
  });

  it('continues tick indexes across multiple steps', () => {
    const receivedContexts: SimulationTickContext[] = [];
    const simulationEngine = new SimulationEngine({
      clock: new GameClock({ tickDurationMs: 50 }),
      systems: [
        {
          update: (context) => {
            receivedContexts.push(context);
          },
        },
      ],
    });

    simulationEngine.step(125);
    simulationEngine.step(75);

    expect(receivedContexts).toEqual([
      {
        simulationTimeMs: 50,
        tickDurationMs: 50,
        tickIndex: 1,
      },
      {
        simulationTimeMs: 100,
        tickDurationMs: 50,
        tickIndex: 2,
      },
      {
        simulationTimeMs: 150,
        tickDurationMs: 50,
        tickIndex: 3,
      },
      {
        simulationTimeMs: 200,
        tickDurationMs: 50,
        tickIndex: 4,
      },
    ]);
  });

  it('can step without registered systems', () => {
    const simulationEngine = new SimulationEngine({
      clock: new GameClock({ tickDurationMs: 100 }),
    });

    const result = simulationEngine.step(250);

    expect(result).toEqual({
      executedSystemUpdateCount: 0,
      processedTickCount: 2,
      remainingAccumulatedTimeMs: 50,
      simulationTimeMs: 200,
      totalTickCount: 2,
    });
  });

  it('resets the underlying clock', () => {
    const simulationEngine = new SimulationEngine({
      clock: new GameClock({ tickDurationMs: 100 }),
    });

    simulationEngine.step(250);
    simulationEngine.reset();

    expect(simulationEngine.step(100)).toEqual({
      executedSystemUpdateCount: 0,
      processedTickCount: 1,
      remainingAccumulatedTimeMs: 0,
      simulationTimeMs: 100,
      totalTickCount: 1,
    });
  });

  it('exposes the underlying clock snapshot', () => {
    const simulationEngine = new SimulationEngine({
      clock: new GameClock({ tickDurationMs: 100 }),
    });

    simulationEngine.step(250);

    expect(simulationEngine.getSnapshot()).toEqual({
      remainingAccumulatedTimeMs: 50,
      simulationTimeMs: 200,
      tickDurationMs: 100,
      totalTickCount: 2,
    });
  });
});
