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
      barracksLevelTotal: 0,
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

  it('exposes the current round enemy list', () => {
    const system = new SurfaceDefenseSystem();
    const snapshot = system.getSnapshot(createColony(1, 6));

    expect(snapshot.currentRoundEnemies).toEqual([
      {
        hitPoints: 28,
        kind: 'cockroach',
        label: 'Blatte',
        level: 1,
        quantity: 1,
      },
    ]);
  });

  it('raises the threat level over survival time', () => {
    const system = new SurfaceDefenseSystem();
    const colony = createColony(1, 6);

    system.update(
      {
        simulationTimeMs: 30_000,
        tickDurationMs: 30_000,
        tickIndex: 300,
      },
      colony,
    );

    expect(system.getSnapshot(colony).threatLevel).toBe(2);
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

  it('returns a gold reward when a threat is defeated', () => {
    const system = new SurfaceDefenseSystem();
    const colony = createColony(3, 12);
    let earnedGold = 0;

    system.update(
      {
        simulationTimeMs: 3_500,
        tickDurationMs: 3_500,
        tickIndex: 35,
      },
      colony,
    );

    for (let tickIndex = 36; tickIndex <= 120; tickIndex += 1) {
      earnedGold += system.update(
        {
          simulationTimeMs: tickIndex * 250,
          tickDurationMs: 250,
          tickIndex,
        },
        colony,
      ).earnedGold;
    }

    expect(earnedGold).toBeGreaterThan(0);
  });

  it('returns worker losses when a defended threat is resolved', () => {
    const system = new SurfaceDefenseSystem();
    const colony = createColony(3, 12);
    let lostWorkers = 0;

    system.update(
      {
        simulationTimeMs: 3_500,
        tickDurationMs: 3_500,
        tickIndex: 35,
      },
      colony,
    );

    for (let tickIndex = 36; tickIndex <= 120; tickIndex += 1) {
      lostWorkers += system.update(
        {
          simulationTimeMs: tickIndex * 250,
          tickDurationMs: 250,
          tickIndex,
        },
        colony,
      ).lostWorkers;
    }

    expect(lostWorkers).toBeGreaterThan(0);
  });

  it('keeps a short-lived reward feedback after a kill', () => {
    const system = new SurfaceDefenseSystem();
    const colony = createColony(3, 12);
    let rewardFeedbackFound = false;

    system.update(
      {
        simulationTimeMs: 3_500,
        tickDurationMs: 3_500,
        tickIndex: 35,
      },
      colony,
    );

    for (let tickIndex = 36; tickIndex <= 120; tickIndex += 1) {
      const updateResult = system.update(
        {
          simulationTimeMs: tickIndex * 250,
          tickDurationMs: 250,
          tickIndex,
        },
        colony,
      );

      if (updateResult.earnedGold > 0) {
        rewardFeedbackFound =
          system.getSnapshot(colony).rewardFeedback !== null;
        break;
      }
    }

    expect(rewardFeedbackFound).toBe(true);
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

  it('reduces colony integrity when threats break through', () => {
    const system = new SurfaceDefenseSystem();
    const colony = createColony(0, 12);

    for (let tickIndex = 1; tickIndex <= 260; tickIndex += 1) {
      system.update(
        {
          simulationTimeMs: tickIndex * 250,
          tickDurationMs: 250,
          tickIndex,
        },
        colony,
      );
    }

    const snapshot = system.getSnapshot(colony);

    expect(snapshot.escapedThreatCount).toBeGreaterThan(0);
    expect(snapshot.colonyIntegrity).toBeLessThan(snapshot.colonyIntegrityMax);
    expect(snapshot.colonyIntegrityMax).toBe(3);
    expect(snapshot.isColonyDefeated).toBe(false);
  });

  it('marks the colony as defeated when integrity reaches zero', () => {
    const system = new SurfaceDefenseSystem();
    const colony = createColony(0, 12);

    for (let tickIndex = 1; tickIndex <= 1_500; tickIndex += 1) {
      system.update(
        {
          simulationTimeMs: tickIndex * 250,
          tickDurationMs: 250,
          tickIndex,
        },
        colony,
      );

      if (system.getSnapshot(colony).isColonyDefeated) {
        break;
      }
    }

    const snapshot = system.getSnapshot(colony);

    expect(snapshot.colonyIntegrity).toBe(0);
    expect(snapshot.isColonyDefeated).toBe(true);
  });

  it('builds score from survival time and defeated threats', () => {
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

    const snapshot = system.getSnapshot(colony);

    expect(snapshot.defeatedThreatCount).toBeGreaterThan(0);
    expect(snapshot.score).toBeGreaterThan(snapshot.defeatedThreatCount * 100 - 1);
  });
});
