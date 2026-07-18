import {
  DEFAULT_GAME_RUNTIME_CONFIG,
  type GameRuntimeOptions,
} from '@/game/engine/game-runtime-config';
import {
  ColonyEconomySystem,
  type ColonyEconomySnapshot,
  type ColonyRoomCounts,
  type ColonyRoomUpgradeTotals,
} from '@/game/simulation/colony-economy';
import {
  GameClock,
  type GameClockSnapshot,
} from '@/game/simulation/game-clock';
import { getRoomUpgradeRequirement } from '@/game/simulation/room-upgrades';
import {
  SurfaceDefenseSystem,
  type SurfaceDefenseSnapshot,
} from '@/game/simulation/surface-defense';
import {
  SimulationEngine,
  type SimulationEngineStepResult,
} from '@/game/simulation/simulation-engine';

export interface GameRuntimeSnapshot {
  readonly colony: ColonyEconomySnapshot;
  readonly isGameOver: boolean;
  readonly isPaused: boolean;
  readonly maximumDeltaTimeMs: number;
  readonly simulation: GameClockSnapshot;
  readonly surfaceDefense: SurfaceDefenseSnapshot;
}

export type GameRuntimeSnapshotListener = (
  snapshot: GameRuntimeSnapshot,
) => void;

export type GameRuntimeSnapshotUnsubscribe = () => void;

export class GameRuntime {
  private readonly colonyEconomySystem: ColonyEconomySystem;
  private isPaused = false;
  private readonly maximumDeltaTimeMs: number;
  private readonly simulationEngine: SimulationEngine;
  private readonly snapshotListeners = new Set<GameRuntimeSnapshotListener>();
  private readonly surfaceDefenseSystem: SurfaceDefenseSystem;

  public constructor(options: GameRuntimeOptions = {}) {
    this.maximumDeltaTimeMs =
      options.maximumDeltaTimeMs ??
      DEFAULT_GAME_RUNTIME_CONFIG.maximumDeltaTimeMs;
    this.colonyEconomySystem = new ColonyEconomySystem();
    this.surfaceDefenseSystem = new SurfaceDefenseSystem();
    this.simulationEngine = new SimulationEngine({
      clock: new GameClock({
        tickDurationMs:
          options.simulationTickDurationMs ??
          DEFAULT_GAME_RUNTIME_CONFIG.simulationTickDurationMs,
      }),
      systems: options.systems,
    });
  }

  public update(deltaTimeMs: number): SimulationEngineStepResult {
    if (this.isPaused) {
      const snapshot = this.simulationEngine.getSnapshot();

      return {
        executedSystemUpdateCount: 0,
        processedTickCount: 0,
        remainingAccumulatedTimeMs: snapshot.remainingAccumulatedTimeMs,
        simulationTimeMs: snapshot.simulationTimeMs,
        totalTickCount: snapshot.totalTickCount,
      };
    }

    const stepResult = this.simulationEngine.step(
      this.clampDeltaTime(deltaTimeMs),
    );
    const tickDurationMs = this.simulationEngine.getSnapshot().tickDurationMs;

    for (
      let processedTickIndex = 0;
      processedTickIndex < stepResult.processedTickCount;
      processedTickIndex += 1
    ) {
      const tickIndex =
        stepResult.totalTickCount - stepResult.processedTickCount + processedTickIndex + 1;

      this.colonyEconomySystem.update({
        simulationTimeMs: tickIndex * tickDurationMs,
        tickDurationMs,
        tickIndex,
      });
      const surfaceDefenseResult = this.surfaceDefenseSystem.update(
        {
          simulationTimeMs: tickIndex * tickDurationMs,
          tickDurationMs,
          tickIndex,
        },
        this.colonyEconomySystem.getSnapshot(),
      );

      if (surfaceDefenseResult.earnedGold > 0) {
        this.colonyEconomySystem.addGold(surfaceDefenseResult.earnedGold);
      }

      if (surfaceDefenseResult.lostWorkers > 0) {
        this.colonyEconomySystem.removeWorkers(surfaceDefenseResult.lostWorkers);
      }
    }

    if (
      this.surfaceDefenseSystem.getSnapshot(this.colonyEconomySystem.getSnapshot())
        .isColonyDefeated
    ) {
      this.isPaused = true;
    }

    this.notifySnapshotListeners();

    return stepResult;
  }

  public pause(): void {
    this.isPaused = true;
    this.notifySnapshotListeners();
  }

  public resume(): void {
    this.isPaused = false;
    this.notifySnapshotListeners();
  }

  public reset(): void {
    this.simulationEngine.reset();
    this.colonyEconomySystem.reset();
    this.surfaceDefenseSystem.reset();
    this.notifySnapshotListeners();
  }

  public dispose(): void {
    this.isPaused = true;
    this.snapshotListeners.clear();
  }

  public getSnapshot(): GameRuntimeSnapshot {
    return {
      colony: this.colonyEconomySystem.getSnapshot(),
      isGameOver: this.surfaceDefenseSystem.getSnapshot(
        this.colonyEconomySystem.getSnapshot(),
      ).isColonyDefeated,
      isPaused: this.isPaused,
      maximumDeltaTimeMs: this.maximumDeltaTimeMs,
      simulation: this.simulationEngine.getSnapshot(),
      surfaceDefense: this.surfaceDefenseSystem.getSnapshot(
        this.colonyEconomySystem.getSnapshot(),
      ),
    };
  }

  public setColonyInfrastructure(
    roomCounts: ColonyRoomCounts,
    roomUpgradeTotals: ColonyRoomUpgradeTotals,
  ): void {
    this.colonyEconomySystem.setInfrastructure(roomCounts, roomUpgradeTotals);
    this.notifySnapshotListeners();
  }

  public tryUpgradeRoom(
    definitionId: string | undefined,
    currentLevel: number,
  ): boolean {
    const requirement = getRoomUpgradeRequirement(definitionId, currentLevel);

    if (requirement === undefined) {
      return false;
    }

    const didPurchase =
      this.colonyEconomySystem.tryPurchaseRoomUpgrade(requirement);

    if (didPurchase) {
      this.notifySnapshotListeners();
    }

    return didPurchase;
  }

  public tryPurchaseConstruction(costGold: number): boolean {
    const didPurchase = this.colonyEconomySystem.trySpendGold(costGold);

    if (didPurchase) {
      this.notifySnapshotListeners();
    }

    return didPurchase;
  }

  public setColonyRoomCounts(roomCounts: ColonyRoomCounts): void {
    this.colonyEconomySystem.setInfrastructure(roomCounts, {
      barracksLevelTotal: roomCounts.barracksCount,
      broodChamberLevelTotal: roomCounts.broodChamberCount,
      fungusFarmLevelTotal: roomCounts.fungusFarmCount,
      queenChamberLevelTotal: roomCounts.queenChamberCount,
      storageLevelTotal: roomCounts.storageCount,
    });
    this.notifySnapshotListeners();
  }

  public subscribeToSnapshots(
    listener: GameRuntimeSnapshotListener,
  ): GameRuntimeSnapshotUnsubscribe {
    this.snapshotListeners.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  private clampDeltaTime(deltaTimeMs: number): number {
    return Math.min(deltaTimeMs, this.maximumDeltaTimeMs);
  }

  private notifySnapshotListeners(): void {
    const snapshot = this.getSnapshot();

    for (const listener of this.snapshotListeners) {
      listener(snapshot);
    }
  }
}
