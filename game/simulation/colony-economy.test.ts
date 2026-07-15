import { describe, expect, it } from 'vitest';

import { ColonyEconomySystem } from '@/game/simulation/colony-economy';
import { getRoomUpgradeRequirement } from '@/game/simulation/room-upgrades';

const createUpgradeTotals = (overrides: Partial<{
  broodChamberLevelTotal: number;
  fungusFarmLevelTotal: number;
  queenChamberLevelTotal: number;
  storageLevelTotal: number;
}> = {}) => ({
  broodChamberLevelTotal: 0,
  fungusFarmLevelTotal: 0,
  queenChamberLevelTotal: 0,
  storageLevelTotal: 0,
  ...overrides,
});

describe('ColonyEconomySystem', () => {
  it('derives food capacity from storage rooms', () => {
    const system = new ColonyEconomySystem();

    system.setInfrastructure(
      {
        broodChamberCount: 0,
        fungusFarmCount: 0,
        queenChamberCount: 1,
        storageCount: 2,
      },
      createUpgradeTotals({ queenChamberLevelTotal: 1, storageLevelTotal: 2 }),
    );

    expect(system.getSnapshot().foodCapacity).toBe(100);
  });

  it('produces food from fungus farms over time', () => {
    const system = new ColonyEconomySystem({ initialFood: 0 });

    system.setInfrastructure(
      {
        broodChamberCount: 0,
        fungusFarmCount: 2,
        queenChamberCount: 0,
        storageCount: 0,
      },
      createUpgradeTotals({ fungusFarmLevelTotal: 2 }),
    );

    system.update({
      simulationTimeMs: 1_000,
      tickDurationMs: 1_000,
      tickIndex: 1,
    });

    expect(system.getSnapshot().food).toBe(1.6);
  });

  it('lets the queen consume food to create larvae', () => {
    const system = new ColonyEconomySystem({ initialFood: 12 });

    system.setInfrastructure(
      {
        broodChamberCount: 0,
        fungusFarmCount: 0,
        queenChamberCount: 1,
        storageCount: 0,
      },
      createUpgradeTotals({ queenChamberLevelTotal: 1 }),
    );

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

    system.setInfrastructure(
      {
        broodChamberCount: 1,
        fungusFarmCount: 0,
        queenChamberCount: 0,
        storageCount: 0,
      },
      createUpgradeTotals({ broodChamberLevelTotal: 1 }),
    );

    for (let tickIndex = 1; tickIndex <= 120; tickIndex += 1) {
      system.update({
        simulationTimeMs: tickIndex * 100,
        tickDurationMs: 100,
        tickIndex,
      });
    }

    expect(system.getSnapshot()).toMatchObject({
      colonyExperience: 1,
      colonyExperienceProgress: 1,
      larvae: 1,
      workers: 1,
    });
  });

  it('spends gold for a valid room upgrade purchase', () => {
    const system = new ColonyEconomySystem({ initialWorkers: 5 });
    const requirement = getRoomUpgradeRequirement('fungus-farm', 1);

    if (requirement === undefined) {
      throw new Error('Missing upgrade requirement for fungus farm.');
    }

    expect(system.tryPurchaseRoomUpgrade(requirement)).toBe(true);
    expect(system.getSnapshot()).toMatchObject({
      colonyLevel: 2,
      gold: 54,
    });
  });

  it('spends gold for construction purchases when enough is available', () => {
    const system = new ColonyEconomySystem();

    expect(system.trySpendGold(5)).toBe(true);
    expect(system.getSnapshot().gold).toBe(75);
  });

  it('refuses construction purchases when gold is insufficient', () => {
    const system = new ColonyEconomySystem();

    expect(system.trySpendGold(500)).toBe(false);
    expect(system.getSnapshot().gold).toBe(80);
  });

  it('exposes current colony experience progress toward next level', () => {
    const system = new ColonyEconomySystem({ initialWorkers: 9 });

    expect(system.getSnapshot()).toMatchObject({
      colonyExperience: 9,
      colonyExperienceProgress: 4,
      colonyExperienceToNextLevel: 5,
      colonyLevel: 2,
    });
  });
});
