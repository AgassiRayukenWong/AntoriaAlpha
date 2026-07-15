import { describe, expect, it } from 'vitest';

import { ColonyEconomySystem } from '@/game/simulation/colony-economy';

describe('ColonyEconomySystem', () => {
  it('derives food capacity from storage rooms', () => {
    const system = new ColonyEconomySystem();

    system.setRoomCounts({
      broodChamberCount: 0,
      fungusFarmCount: 0,
      queenChamberCount: 1,
      storageCount: 2,
    });

    expect(system.getSnapshot().foodCapacity).toBe(100);
  });

  it('produces food from fungus farms over time', () => {
    const system = new ColonyEconomySystem({ initialFood: 0 });

    system.setRoomCounts({
      broodChamberCount: 0,
      fungusFarmCount: 2,
      queenChamberCount: 0,
      storageCount: 0,
    });

    system.update({
      simulationTimeMs: 1_000,
      tickDurationMs: 1_000,
      tickIndex: 1,
    });

    expect(system.getSnapshot().food).toBe(1.6);
  });

  it('lets the queen consume food to create larvae', () => {
    const system = new ColonyEconomySystem({ initialFood: 12 });

    system.setRoomCounts({
      broodChamberCount: 0,
      fungusFarmCount: 0,
      queenChamberCount: 1,
      storageCount: 0,
    });

    for (let tickIndex = 1; tickIndex <= 100; tickIndex += 1) {
      system.update({
        simulationTimeMs: tickIndex * 100,
        tickDurationMs: 100,
        tickIndex,
      });
    }

    expect(system.getSnapshot()).toMatchObject({
      food: 9,
      larvae: 1,
    });
  });

  it('converts larvae into workers through brood chambers', () => {
    const system = new ColonyEconomySystem({
      initialFood: 12,
      initialLarvae: 2,
      initialWorkers: 0,
    });

    system.setRoomCounts({
      broodChamberCount: 1,
      fungusFarmCount: 0,
      queenChamberCount: 0,
      storageCount: 0,
    });

    for (let tickIndex = 1; tickIndex <= 120; tickIndex += 1) {
      system.update({
        simulationTimeMs: tickIndex * 100,
        tickDurationMs: 100,
        tickIndex,
      });
    }

    expect(system.getSnapshot()).toMatchObject({
      larvae: 1,
      workers: 1,
    });
  });
});
