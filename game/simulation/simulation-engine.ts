import type {
  GameClock,
  GameClockAdvanceResult,
  GameClockSnapshot,
} from './game-clock';

export interface SimulationTickContext {
  readonly simulationTimeMs: number;
  readonly tickDurationMs: number;
  readonly tickIndex: number;
}

export interface SimulationSystem {
  update(context: SimulationTickContext): void;
}

export interface SimulationEngineOptions {
  readonly clock: GameClock;
  readonly systems?: readonly SimulationSystem[];
}

export interface SimulationEngineStepResult extends GameClockAdvanceResult {
  readonly executedSystemUpdateCount: number;
}

export class SimulationEngine {
  private readonly clock: GameClock;
  private readonly systems: readonly SimulationSystem[];

  public constructor(options: SimulationEngineOptions) {
    this.clock = options.clock;
    this.systems = [...(options.systems ?? [])];
  }

  public step(deltaTimeMs: number): SimulationEngineStepResult {
    const clockAdvanceResult = this.clock.advance(deltaTimeMs);

    for (
      let processedTickIndex = 0;
      processedTickIndex < clockAdvanceResult.processedTickCount;
      processedTickIndex += 1
    ) {
      const tickIndex =
        clockAdvanceResult.totalTickCount -
        clockAdvanceResult.processedTickCount +
        processedTickIndex +
        1;

      this.updateSystems({
        simulationTimeMs: tickIndex * this.clock.tickDurationMs,
        tickDurationMs: this.clock.tickDurationMs,
        tickIndex,
      });
    }

    return {
      ...clockAdvanceResult,
      executedSystemUpdateCount:
        clockAdvanceResult.processedTickCount * this.systems.length,
    };
  }

  public reset(): void {
    this.clock.reset();
  }

  public getSnapshot(): GameClockSnapshot {
    return this.clock.getSnapshot();
  }

  private updateSystems(context: SimulationTickContext): void {
    for (const system of this.systems) {
      system.update(context);
    }
  }
}
