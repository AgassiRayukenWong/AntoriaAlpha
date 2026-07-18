import type { ColonyEconomySnapshot } from './colony-economy';
import type { SimulationTickContext } from './simulation-engine';

export type SurfaceEnemyKind = 'bee' | 'cockroach';

export interface SurfaceRoundEnemySnapshot {
  readonly hitPoints: number;
  readonly kind: SurfaceEnemyKind;
  readonly label: string;
  readonly level: number;
  readonly quantity: number;
}

export interface SurfaceThreatSnapshot {
  readonly currentHitPoints: number;
  readonly direction: 'left-to-right' | 'right-to-left';
  readonly kind: SurfaceEnemyKind;
  readonly label: string;
  readonly level: number;
  readonly maxHitPoints: number;
  readonly progress: number;
  readonly speed: number;
  readonly wave: number;
}

export interface SurfaceDefenseSnapshot {
  readonly activeThreat: SurfaceThreatSnapshot | null;
  readonly availableSoldierCount: number;
  readonly colonyIntegrity: number;
  readonly colonyIntegrityMax: number;
  readonly currentRoundEnemies: readonly SurfaceRoundEnemySnapshot[];
  readonly defeatedThreatCount: number;
  readonly engagedSoldierCount: number;
  readonly escapedThreatCount: number;
  readonly isColonyDefeated: boolean;
  readonly nextThreatLevelAtSurvivalTimeMs: number;
  readonly rewardFeedback: SurfaceRewardFeedbackSnapshot | null;
  readonly score: number;
  readonly soldierCapacityMax: number;
  readonly survivalTimeMs: number;
  readonly threatLevel: number;
  readonly wave: number;
}

export interface SurfaceDefenseUpdateResult {
  readonly earnedGold: number;
  readonly lostWorkers: number;
}

export interface SurfaceRewardFeedbackSnapshot {
  readonly direction: 'left-to-right' | 'right-to-left';
  readonly elapsedMs: number;
  readonly gold: number;
  readonly progress: number;
}

interface SurfaceEnemyDefinition {
  readonly baseHitPoints: number;
  readonly baseSpeed: number;
  readonly goldRewardBonus: number;
  readonly kind: SurfaceEnemyKind;
  readonly label: string;
  readonly workerLossBonus: number;
}

interface SurfaceThreatState {
  currentHitPoints: number;
  direction: 'left-to-right' | 'right-to-left';
  kind: SurfaceEnemyKind;
  label: string;
  level: number;
  maxHitPoints: number;
  progress: number;
  speed: number;
  wave: number;
}

interface SurfaceDefenseState {
  activeThreat: SurfaceThreatState | null;
  colonyIntegrity: number;
  currentRoundWave: number;
  defeatedThreatCount: number;
  escapedThreatCount: number;
  nextSpawnDelayMs: number;
  pendingThreats: SurfaceThreatState[];
  rewardFeedback: SurfaceRewardFeedbackSnapshot | null;
  survivalTimeMs: number;
}

const BASE_SPAWN_DELAY_MS = 7_000;
const COLONY_INTEGRITY_MAX = 3;
const ESCAPE_RESET_DELAY_MS = 4_500;
const INITIAL_ROUND_DELAY_MS = 3_500;
const INTRA_ROUND_DELAY_MS = 1_800;
const MIN_SPAWN_DELAY_MS = 2_500;
const REWARD_FEEDBACK_DURATION_MS = 950;
const THREAT_LEVEL_INTERVAL_MS = 30_000;
const SOLDIERS_PER_BARRACKS = 4;
const SOLDIER_DAMAGE_PER_SECOND = 1.35;
const BEE_HIT_POINTS_PER_LEVEL = 5;
const COCKROACH_HIT_POINTS_PER_LEVEL = 8;
const WAVE_HIT_POINTS_BONUS = 1.5;

const SURFACE_ENEMY_DEFINITIONS: Record<
  SurfaceEnemyKind,
  SurfaceEnemyDefinition
> = {
  bee: {
    baseHitPoints: 16,
    baseSpeed: 0.027,
    goldRewardBonus: 1,
    kind: 'bee',
    label: 'Abeille',
    workerLossBonus: 1,
  },
  cockroach: {
    baseHitPoints: 20,
    baseSpeed: 0.022,
    goldRewardBonus: 0,
    kind: 'cockroach',
    label: 'Blatte',
    workerLossBonus: 0,
  },
};

export class SurfaceDefenseSystem {
  private state: SurfaceDefenseState = this.createInitialState();

  public reset(): void {
    this.state = this.createInitialState();
  }

  public update(
    context: SimulationTickContext,
    colony: ColonyEconomySnapshot,
  ): SurfaceDefenseUpdateResult {
    if (this.state.colonyIntegrity <= 0) {
      return { earnedGold: 0, lostWorkers: 0 };
    }

    this.state.survivalTimeMs += context.tickDurationMs;
    this.updateRewardFeedback(context.tickDurationMs);

    const availableSoldierCount = this.getAvailableSoldierCount(colony);

    if (this.state.activeThreat === null) {
      this.state.nextSpawnDelayMs -= context.tickDurationMs;

      if (this.state.nextSpawnDelayMs <= 0) {
        this.ensureCurrentRoundHasThreats();
        this.state.activeThreat = this.state.pendingThreats.shift() ?? null;
      }

      return { earnedGold: 0, lostWorkers: 0 };
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
      const earnedGold = this.getThreatGoldReward(this.state.activeThreat);
      const lostWorkers = this.getThreatWorkerLoss(
        this.state.activeThreat,
        engagedSoldierCount,
        false,
      );

      this.state.rewardFeedback = {
        direction: this.state.activeThreat.direction,
        elapsedMs: 0,
        gold: earnedGold,
        progress: this.state.activeThreat.progress,
      };
      this.state.defeatedThreatCount += 1;
      this.finishCurrentThreat(this.getNextDelayAfterThreatResolution());

      return { earnedGold, lostWorkers };
    }

    if (this.state.activeThreat.progress >= 1) {
      const lostWorkers = this.getThreatWorkerLoss(
        this.state.activeThreat,
        engagedSoldierCount,
        true,
      );

      this.state.colonyIntegrity = Math.max(0, this.state.colonyIntegrity - 1);
      this.state.escapedThreatCount += 1;
      this.finishCurrentThreat(ESCAPE_RESET_DELAY_MS);

      return { earnedGold: 0, lostWorkers };
    }

    return { earnedGold: 0, lostWorkers: 0 };
  }

  public getSnapshot(colony: ColonyEconomySnapshot): SurfaceDefenseSnapshot {
    const soldierCapacityMax = this.getSoldierCapacityMax(colony);
    const availableSoldierCount = Math.min(colony.workers, soldierCapacityMax);
    const engagedSoldierCount =
      this.state.activeThreat !== null && this.state.activeThreat.progress >= 0.08
        ? availableSoldierCount
        : 0;

    return {
      activeThreat:
        this.state.activeThreat === null ? null : { ...this.state.activeThreat },
      availableSoldierCount,
      colonyIntegrity: this.state.colonyIntegrity,
      colonyIntegrityMax: COLONY_INTEGRITY_MAX,
      currentRoundEnemies: this.getCurrentRoundEnemies(),
      defeatedThreatCount: this.state.defeatedThreatCount,
      engagedSoldierCount,
      escapedThreatCount: this.state.escapedThreatCount,
      isColonyDefeated: this.state.colonyIntegrity <= 0,
      nextThreatLevelAtSurvivalTimeMs:
        this.getThreatLevel() * THREAT_LEVEL_INTERVAL_MS,
      rewardFeedback:
        this.state.rewardFeedback === null
          ? null
          : { ...this.state.rewardFeedback },
      score: this.getScore(),
      soldierCapacityMax,
      survivalTimeMs: this.state.survivalTimeMs,
      threatLevel: this.getThreatLevel(),
      wave: this.state.currentRoundWave,
    };
  }

  private createInitialState(): SurfaceDefenseState {
    const survivalTimeMs = 0;

    return {
      activeThreat: null,
      colonyIntegrity: COLONY_INTEGRITY_MAX,
      currentRoundWave: 1,
      defeatedThreatCount: 0,
      escapedThreatCount: 0,
      nextSpawnDelayMs: INITIAL_ROUND_DELAY_MS,
      pendingThreats: this.createRoundThreats(1, survivalTimeMs),
      rewardFeedback: null,
      survivalTimeMs,
    };
  }

  private getAvailableSoldierCount(colony: ColonyEconomySnapshot): number {
    return Math.min(colony.workers, this.getSoldierCapacityMax(colony));
  }

  private getSoldierCapacityMax(colony: ColonyEconomySnapshot): number {
    return (
      Math.max(
        colony.roomCounts.barracksCount,
        colony.roomUpgradeTotals.barracksLevelTotal,
      ) * SOLDIERS_PER_BARRACKS
    );
  }

  private ensureCurrentRoundHasThreats(): void {
    if (this.state.pendingThreats.length > 0) {
      return;
    }

      this.state.currentRoundWave += 1;
      this.state.pendingThreats = this.createRoundThreats(
        this.state.currentRoundWave,
        this.state.survivalTimeMs,
      );
  }

  private finishCurrentThreat(nextDelayMs: number): void {
    this.state.activeThreat = null;

    if (this.state.pendingThreats.length === 0) {
      this.state.currentRoundWave += 1;
      this.state.pendingThreats = this.createRoundThreats(
        this.state.currentRoundWave,
        this.state.survivalTimeMs,
      );
      this.state.nextSpawnDelayMs = this.getNextRoundDelayMs();
      return;
    }

    this.state.nextSpawnDelayMs = nextDelayMs;
  }

  private createRoundThreats(
    roundWave: number,
    survivalTimeMs: number,
  ): SurfaceThreatState[] {
    const threatLevel = this.getThreatLevelFromSurvivalTime(survivalTimeMs);
    const enemyCount = Math.min(3, 1 + Math.floor((roundWave - 1) / 3));

    return Array.from({ length: enemyCount }, (_, index) =>
      this.createRoundThreat(roundWave, threatLevel, index),
    );
  }

  private createRoundThreat(
    roundWave: number,
    threatLevel: number,
    roundIndex: number,
  ): SurfaceThreatState {
    const definition = this.getRoundEnemyDefinition(
      roundWave,
      roundIndex,
      threatLevel,
    );
    const level = threatLevel + Math.floor((roundWave - 1 + roundIndex) / 2);
    const hitPointsPerLevel =
      definition.kind === 'cockroach'
        ? COCKROACH_HIT_POINTS_PER_LEVEL
        : BEE_HIT_POINTS_PER_LEVEL;
    const maxHitPoints =
      definition.baseHitPoints +
      level * hitPointsPerLevel +
      Math.floor((roundWave - 1) * WAVE_HIT_POINTS_BONUS);

    return {
      currentHitPoints: maxHitPoints,
      direction: (roundWave + roundIndex) % 2 === 0 ? 'right-to-left' : 'left-to-right',
      kind: definition.kind,
      label: definition.label,
      level,
      maxHitPoints,
      progress: 0,
      speed: Math.min(
        definition.baseSpeed + threatLevel * 0.0018 + roundWave * 0.00035,
        0.058,
      ),
      wave: roundWave,
    };
  }

  private getRoundEnemyDefinition(
    roundWave: number,
    roundIndex: number,
    threatLevel: number,
  ): SurfaceEnemyDefinition {
    const shouldUseBee =
      threatLevel >= 2 && (roundWave + roundIndex) % 2 === 0;

    return shouldUseBee
      ? SURFACE_ENEMY_DEFINITIONS.bee
      : SURFACE_ENEMY_DEFINITIONS.cockroach;
  }

  private getCurrentRoundEnemies(): readonly SurfaceRoundEnemySnapshot[] {
    const threats = [
      ...(this.state.activeThreat === null ? [] : [this.state.activeThreat]),
      ...this.state.pendingThreats,
    ];
    const aggregatedEnemies = new Map<string, SurfaceRoundEnemySnapshot>();

    for (const threat of threats) {
      const key = `${threat.kind}:${threat.level}:${threat.maxHitPoints}`;
      const currentEntry = aggregatedEnemies.get(key);

      if (currentEntry === undefined) {
        aggregatedEnemies.set(key, {
          hitPoints: threat.maxHitPoints,
          kind: threat.kind,
          label: threat.label,
          level: threat.level,
          quantity: 1,
        });
        continue;
      }

      aggregatedEnemies.set(key, {
        ...currentEntry,
        quantity: currentEntry.quantity + 1,
      });
    }

    return [...aggregatedEnemies.values()];
  }

  private getNextRoundDelayMs(): number {
    return Math.max(
      MIN_SPAWN_DELAY_MS,
      BASE_SPAWN_DELAY_MS - (this.getThreatLevel() - 1) * 450,
    );
  }

  private getNextDelayAfterThreatResolution(): number {
    return this.state.pendingThreats.length > 0
      ? INTRA_ROUND_DELAY_MS
      : this.getNextRoundDelayMs();
  }

  private getThreatGoldReward(threat: SurfaceThreatState): number {
    const definition = SURFACE_ENEMY_DEFINITIONS[threat.kind];

    return (
      3 +
      threat.level +
      Math.floor(threat.level / 3) +
      Math.floor((threat.wave - 1) / 4) +
      definition.goldRewardBonus
    );
  }

  private getThreatWorkerLoss(
    threat: SurfaceThreatState,
    engagedSoldierCount: number,
    escaped: boolean,
  ): number {
    if (engagedSoldierCount <= 0) {
      return 0;
    }

    const definition = SURFACE_ENEMY_DEFINITIONS[threat.kind];
    const baseLoss = escaped
      ? 2 + Math.floor(threat.level / 2) + definition.workerLossBonus
      : 1 + Math.floor((threat.level - 1) / 2);

    return Math.min(engagedSoldierCount, baseLoss);
  }

  private updateRewardFeedback(deltaTimeMs: number): void {
    if (this.state.rewardFeedback === null) {
      return;
    }

    this.state.rewardFeedback = {
      ...this.state.rewardFeedback,
      elapsedMs: this.state.rewardFeedback.elapsedMs + deltaTimeMs,
    };

    if (this.state.rewardFeedback.elapsedMs >= REWARD_FEEDBACK_DURATION_MS) {
      this.state.rewardFeedback = null;
    }
  }

  private getThreatLevel(): number {
    return this.getThreatLevelFromSurvivalTime(this.state.survivalTimeMs);
  }

  private getThreatLevelFromSurvivalTime(survivalTimeMs: number): number {
    return 1 + Math.floor(survivalTimeMs / THREAT_LEVEL_INTERVAL_MS);
  }

  private getScore(): number {
    const survivalScore = Math.floor(this.state.survivalTimeMs / 1_000) * 5;
    const defeatedThreatScore = this.state.defeatedThreatCount * 100;

    return survivalScore + defeatedThreatScore;
  }
}
