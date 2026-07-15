import {
  DEFAULT_GAME_RUNTIME_CONFIG,
  type GameRuntimeOptions,
} from '@/game/engine/game-runtime-config';
import {
  ColonyEconomySystem,
  type ColonyEconomySnapshot,
  type ColonyRoomCounts,
} from '@/game/simulation/colony-economy';
import {
  GameClock,
  type GameClockSnapshot,
} from '@/game/simulation/game-clock';
import {
  SimulationEngine,
  type SimulationEngineStepResult,
} from '@/game/simulation/simulation-engine';

export interface GameRuntimeSnapshot {
  readonly colony: ColonyEconomySnapshot;
  readonly isPaused: boolean;
  readonly maximumDeltaTimeMs: number;
  readonly simulation: GameClockSnapshot;
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

  public constructor(options: GameRuntimeOptions = {}) {
    this.maximumDeltaTimeMs =
      options.maximumDeltaTimeMs ??
      DEFAULT_GAME_RUNTIME_CONFIG.maximumDeltaTimeMs;
    this.colonyEconomySystem = new ColonyEconomySystem();
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
    this.notifySnapshotListeners();
  }

  public dispose(): void {
    this.isPaused = true;
    this.snapshotListeners.clear();
  }

  public getSnapshot(): GameRuntimeSnapshot {
    return {
      colony: this.colonyEconomySystem.getSnapshot(),
      isPaused: this.isPaused,
      maximumDeltaTimeMs: this.maximumDeltaTimeMs,
      simulation: this.simulationEngine.getSnapshot(),
    };
  }

  public setColonyRoomCounts(roomCounts: ColonyRoomCounts): void {
    this.colonyEconomySystem.setRoomCounts(roomCounts);
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
