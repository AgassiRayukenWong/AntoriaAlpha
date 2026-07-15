import type { ColonyEconomySnapshot } from './colony-economy';
import type { SimulationTickContext } from './simulation-engine';

export interface SurfaceThreatSnapshot {
  readonly currentHitPoints: number;
  readonly direction: 'left-to-right' | 'right-to-left';
  readonly maxHitPoints: number;
  readonly progress: number;
  readonly speed: number;
  readonly wave: number;
}

export interface SurfaceDefenseSnapshot {
  readonly activeThreat: SurfaceThreatSnapshot | null;
  readonly availableSoldierCount: number;
  readonly defeatedThreatCount: number;
  readonly engagedSoldierCount: number;
  readonly escapedThreatCount: number;
  readonly survivalTimeMs: number;
  readonly wave: number;
}

interface SurfaceThreatState {
  currentHitPoints: number;
  direction: 'left-to-right' | 'right-to-left';
  maxHitPoints: number;
  progress: number;
  speed: number;
  wave: number;
}

interface SurfaceDefenseState {
  activeThreat: SurfaceThreatState | null;
  defeatedThreatCount: number;
  escapedThreatCount: number;
  nextSpawnDelayMs: number;
  survivalTimeMs: number;
}

const BASE_SPAWN_DELAY_MS = 7_000;
const ESCAPE_RESET_DELAY_MS = 4_500;
const MIN_SPAWN_DELAY_MS = 2_500;
const SOLDIERS_PER_BARRACKS = 4;
const SOLDIER_DAMAGE_PER_SECOND = 1.35;

export class SurfaceDefenseSystem {
  private state: SurfaceDefenseState = {
    activeThreat: null,
    defeatedThreatCount: 0,
    escapedThreatCount: 0,
    nextSpawnDelayMs: 3_500,
    survivalTimeMs: 0,
  };

  public reset(): void {
    this.state = {
      activeThreat: null,
      defeatedThreatCount: 0,
      escapedThreatCount: 0,
      nextSpawnDelayMs: 3_500,
      survivalTimeMs: 0,
    };
  }

  public update(
    context: SimulationTickContext,
    colony: ColonyEconomySnapshot,
  ): void {
    this.state.survivalTimeMs += context.tickDurationMs;

    const availableSoldierCount = this.getAvailableSoldierCount(colony);

    if (this.state.activeThreat === null) {
      this.state.nextSpawnDelayMs -= context.tickDurationMs;

      if (this.state.nextSpawnDelayMs <= 0) {
        this.state.activeThreat = this.createThreat();
      }

      return;
    }

    const tickDurationSeconds = context.tickDurationMs / 1_000;
    const engagedSoldierCount =
      this.state.activeThreat.progress >= 0.08 ? availableSoldierCount : 0;

    this.state.activeThreat.progress = Math.min(
      1,
      this.state.activeThreat.progress +
        this.state.activeThreat.speed * tickDurationSeconds,
    );

    if (engagedSoldierCount > 0) {
      this.state.activeThreat.currentHitPoints -=
        engagedSoldierCount * SOLDIER_DAMAGE_PER_SECOND * tickDurationSeconds;
    }

    if (this.state.activeThreat.currentHitPoints <= 0) {
      this.state.defeatedThreatCount += 1;
      this.state.activeThreat = null;
      this.state.nextSpawnDelayMs = this.getNextSpawnDelayMs();
      return;
    }

    if (this.state.activeThreat.progress >= 1) {
      this.state.escapedThreatCount += 1;
      this.state.activeThreat = null;
      this.state.nextSpawnDelayMs = ESCAPE_RESET_DELAY_MS;
    }
  }

  public getSnapshot(
    colony: ColonyEconomySnapshot,
  ): SurfaceDefenseSnapshot {
    const availableSoldierCount = this.getAvailableSoldierCount(colony);
    const engagedSoldierCount =
      this.state.activeThreat !== null && this.state.activeThreat.progress >= 0.08
        ? availableSoldierCount
        : 0;

    return {
      activeThreat:
        this.state.activeThreat === null
          ? null
          : { ...this.state.activeThreat },
      availableSoldierCount,
      defeatedThreatCount: this.state.defeatedThreatCount,
      engagedSoldierCount,
      escapedThreatCount: this.state.escapedThreatCount,
      survivalTimeMs: this.state.survivalTimeMs,
      wave:
        this.state.activeThreat?.wave ??
        this.state.defeatedThreatCount + this.state.escapedThreatCount + 1,
    };
  }

  private getAvailableSoldierCount(colony: ColonyEconomySnapshot): number {
    return Math.min(
      colony.workers,
      colony.roomCounts.barracksCount * SOLDIERS_PER_BARRACKS,
    );
  }

  private createThreat(): SurfaceThreatState {
    const wave = this.state.defeatedThreatCount + this.state.escapedThreatCount + 1;

    return {
      currentHitPoints: 8 + wave * 2,
      direction: wave % 2 === 0 ? 'right-to-left' : 'left-to-right',
      maxHitPoints: 8 + wave * 2,
      progress: 0,
      speed: Math.min(0.022 + wave * 0.0016, 0.045),
      wave,
    };
  }

  private getNextSpawnDelayMs(): number {
    const completedThreatCount =
      this.state.defeatedThreatCount + this.state.escapedThreatCount;

    return Math.max(
      MIN_SPAWN_DELAY_MS,
      BASE_SPAWN_DELAY_MS - completedThreatCount * 240,
    );
  }
}
