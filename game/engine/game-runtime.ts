import {
  DEFAULT_GAME_RUNTIME_CONFIG,
  type GameRuntimeOptions,
} from '@/game/engine/game-runtime-config';
import {
  GameClock,
  type GameClockSnapshot,
} from '@/game/simulation/game-clock';
import {
  SimulationEngine,
  type SimulationEngineStepResult,
} from '@/game/simulation/simulation-engine';

export interface GameRuntimeSnapshot {
  readonly isPaused: boolean;
  readonly maximumDeltaTimeMs: number;
  readonly simulation: GameClockSnapshot;
}

export type GameRuntimeSnapshotListener = (
  snapshot: GameRuntimeSnapshot,
) => void;

export type GameRuntimeSnapshotUnsubscribe = () => void;

export class GameRuntime {
  private isPaused = false;
  private readonly maximumDeltaTimeMs: number;
  private readonly simulationEngine: SimulationEngine;
  private readonly snapshotListeners = new Set<GameRuntimeSnapshotListener>();

  public constructor(options: GameRuntimeOptions = {}) {
    this.maximumDeltaTimeMs =
      options.maximumDeltaTimeMs ??
      DEFAULT_GAME_RUNTIME_CONFIG.maximumDeltaTimeMs;
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
    this.notifySnapshotListeners();
  }

  public dispose(): void {
    this.isPaused = true;
    this.snapshotListeners.clear();
  }

  public getSnapshot(): GameRuntimeSnapshot {
    return {
      isPaused: this.isPaused,
      maximumDeltaTimeMs: this.maximumDeltaTimeMs,
      simulation: this.simulationEngine.getSnapshot(),
    };
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
