export interface GameClockOptions {
  tickDurationMs: number;
}

export interface GameClockAdvanceResult {
  processedTickCount: number;
  remainingAccumulatedTimeMs: number;
  simulationTimeMs: number;
  totalTickCount: number;
}

export interface GameClockSnapshot {
  remainingAccumulatedTimeMs: number;
  simulationTimeMs: number;
  tickDurationMs: number;
  totalTickCount: number;
}

const assertFinitePositiveNumber = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
};

const assertFiniteNonNegativeNumber = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
};

export class GameClock {
  private remainingAccumulatedTimeMs = 0;
  private totalTickCount = 0;

  public readonly tickDurationMs: number;

  public constructor(options: GameClockOptions) {
    assertFinitePositiveNumber(options.tickDurationMs, 'tickDurationMs');

    this.tickDurationMs = options.tickDurationMs;
  }

  public advance(deltaTimeMs: number): GameClockAdvanceResult {
    assertFiniteNonNegativeNumber(deltaTimeMs, 'deltaTimeMs');

    this.remainingAccumulatedTimeMs += deltaTimeMs;

    const processedTickCount = Math.floor(
      this.remainingAccumulatedTimeMs / this.tickDurationMs,
    );

    this.remainingAccumulatedTimeMs -= processedTickCount * this.tickDurationMs;
    this.totalTickCount += processedTickCount;

    return this.createAdvanceResult(processedTickCount);
  }

  public reset(): void {
    this.remainingAccumulatedTimeMs = 0;
    this.totalTickCount = 0;
  }

  public getSnapshot(): GameClockSnapshot {
    return {
      remainingAccumulatedTimeMs: this.remainingAccumulatedTimeMs,
      simulationTimeMs: this.simulationTimeMs,
      tickDurationMs: this.tickDurationMs,
      totalTickCount: this.totalTickCount,
    };
  }

  private get simulationTimeMs(): number {
    return this.totalTickCount * this.tickDurationMs;
  }

  private createAdvanceResult(
    processedTickCount: number,
  ): GameClockAdvanceResult {
    return {
      processedTickCount,
      remainingAccumulatedTimeMs: this.remainingAccumulatedTimeMs,
      simulationTimeMs: this.simulationTimeMs,
      totalTickCount: this.totalTickCount,
    };
  }
}
