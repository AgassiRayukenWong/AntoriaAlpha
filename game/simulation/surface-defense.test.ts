import { describe, expect, it } from 'vitest';

import { ColonyEconomySystem } from '@/game/simulation/colony-economy';
import { SurfaceDefenseSystem } from '@/game/simulation/surface-defense';

const createColony = (barracksCount: number, workers: number) => {
  const colony = new ColonyEconomySystem({ initialWorkers: workers });

  colony.setInfrastructure(
    {
      barracksCount,
      broodChamberCount: 0,
      fungusFarmCount: 0,
      queenChamberCount: 1,
      storageCount: 0,
    },
    {
      broodChamberLevelTotal: 0,
      fungusFarmLevelTotal: 0,
      queenChamberLevelTotal: 1,
      storageLevelTotal: 0,
    },
  );

  return colony.getSnapshot();
};

describe('SurfaceDefenseSystem', () => {
  it('spawns a surface threat after the initial delay', () => {
    const system = new SurfaceDefenseSystem();

    system.update(
      {
        simulationTimeMs: 3_500,
        tickDurationMs: 3_500,
        tickIndex: 35,
      },
      createColony(1, 6),
    );

    expect(system.getSnapshot(createColony(1, 6)).activeThreat).not.toBeNull();
  });

  it('derives available soldiers from barracks and workers', () => {
    const system = new SurfaceDefenseSystem();

    const snapshot = system.getSnapshot(createColony(2, 5));

    expect(snapshot.availableSoldierCount).toBe(5);
  });

  it('defeats insects when enough soldiers are available', () => {
    const system = new SurfaceDefenseSystem();
    const colony = createColony(3, 12);

    system.update(
      {
        simulationTimeMs: 3_500,
        tickDurationMs: 3_500,
        tickIndex: 35,
      },
      colony,
    );

    for (let tickIndex = 36; tickIndex <= 120; tickIndex += 1) {
      system.update(
        {
          simulationTimeMs: tickIndex * 250,
          tickDurationMs: 250,
          tickIndex,
        },
        colony,
      );
    }

    expect(system.getSnapshot(colony).defeatedThreatCount).toBeGreaterThan(0);
  });

  it('lets insects escape when no barracks are available', () => {
    const system = new SurfaceDefenseSystem();
    const colony = createColony(0, 12);

    system.update(
      {
        simulationTimeMs: 3_500,
        tickDurationMs: 3_500,
        tickIndex: 35,
      },
      colony,
    );

    for (let tickIndex = 36; tickIndex <= 260; tickIndex += 1) {
      system.update(
        {
          simulationTimeMs: tickIndex * 250,
          tickDurationMs: 250,
          tickIndex,
        },
        colony,
      );
    }

    expect(system.getSnapshot(colony).escapedThreatCount).toBeGreaterThan(0);
  });
});
