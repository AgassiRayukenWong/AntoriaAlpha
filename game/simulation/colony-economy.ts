import type { RoomUpgradeRequirement } from './room-upgrades';
import type { SimulationSystem, SimulationTickContext } from './simulation-engine';

export interface ColonyRoomCounts {
  readonly broodChamberCount: number;
  readonly fungusFarmCount: number;
  readonly queenChamberCount: number;
  readonly storageCount: number;
}

export interface ColonyRoomUpgradeTotals {
  readonly broodChamberLevelTotal: number;
  readonly fungusFarmLevelTotal: number;
  readonly queenChamberLevelTotal: number;
  readonly storageLevelTotal: number;
}

export interface ColonyEconomySnapshot {
  readonly colonyExperience: number;
  readonly colonyExperienceProgress: number;
  readonly colonyExperienceToNextLevel: number;
  readonly colonyLevel: number;
  readonly food: number;
  readonly foodCapacity: number;
  readonly gold: number;
  readonly larvae: number;
  readonly roomCounts: ColonyRoomCounts;
  readonly roomUpgradeTotals: ColonyRoomUpgradeTotals;
  readonly workers: number;
}

interface ColonyEconomyState {
  food: number;
  gold: number;
  incubationProgress: number;
  larvae: number;
  queenProgress: number;
  roomCounts: ColonyRoomCounts;
  roomUpgradeTotals: ColonyRoomUpgradeTotals;
  totalExperience: number;
  workers: number;
}

export interface ColonyEconomySystemOptions {
  readonly initialFood?: number;
  readonly initialLarvae?: number;
  readonly initialWorkers?: number;
}

const BASE_FOOD_CAPACITY = 20;
const STORAGE_CAPACITY_BONUS = 40;
const FUNGUS_FARM_FOOD_PER_SECOND = 0.8;
const QUEEN_FOOD_COST_PER_LARVA = 3;
const QUEEN_LARVA_SECONDS = 10;
const BROOD_CHAMBER_WORKER_SECONDS = 12;
const COLONY_EXPERIENCE_PER_LEVEL = 5;
const PROGRESS_EPSILON = 1e-9;

const EMPTY_ROOM_COUNTS: ColonyRoomCounts = {
  broodChamberCount: 0,
  fungusFarmCount: 0,
  queenChamberCount: 0,
  storageCount: 0,
};

const EMPTY_ROOM_UPGRADE_TOTALS: ColonyRoomUpgradeTotals = {
  broodChamberLevelTotal: 0,
  fungusFarmLevelTotal: 0,
  queenChamberLevelTotal: 0,
  storageLevelTotal: 0,
};

export class ColonyEconomySystem implements SimulationSystem {
  private readonly initialWorkers: number;
  private state: ColonyEconomyState;

  public constructor(options: ColonyEconomySystemOptions = {}) {
    this.initialWorkers = options.initialWorkers ?? 4;
    this.state = {
      food: options.initialFood ?? 12,
      gold: 80,
      incubationProgress: 0,
      larvae: options.initialLarvae ?? 0,
      queenProgress: 0,
      roomCounts: EMPTY_ROOM_COUNTS,
      roomUpgradeTotals: EMPTY_ROOM_UPGRADE_TOTALS,
      totalExperience: this.initialWorkers,
      workers: this.initialWorkers,
    };
  }

  public update(context: SimulationTickContext): void {
    const tickDurationSeconds = context.tickDurationMs / 1_000;
    const foodCapacity = this.getFoodCapacity();

    this.state.food = Math.min(
      foodCapacity,
      this.state.food +
        this.getFungusFarmProductivity() *
          FUNGUS_FARM_FOOD_PER_SECOND *
          tickDurationSeconds,
    );

    if (
      this.state.roomCounts.queenChamberCount > 0 &&
      this.state.food >= QUEEN_FOOD_COST_PER_LARVA
    ) {
      this.state.queenProgress +=
        (this.getQueenChamberProductivity() * tickDurationSeconds) /
        QUEEN_LARVA_SECONDS;

      while (
        this.state.queenProgress + PROGRESS_EPSILON >= 1 &&
        this.state.food >= QUEEN_FOOD_COST_PER_LARVA
      ) {
        this.state.queenProgress -= 1;
        this.state.food -= QUEEN_FOOD_COST_PER_LARVA;
        this.state.larvae += 1;
      }
    }

    if (this.state.roomCounts.broodChamberCount > 0 && this.state.larvae > 0) {
      this.state.incubationProgress +=
        (this.getBroodChamberProductivity() * tickDurationSeconds) /
        BROOD_CHAMBER_WORKER_SECONDS;

      while (
        this.state.incubationProgress + PROGRESS_EPSILON >= 1 &&
        this.state.larvae > 0
      ) {
        this.state.incubationProgress -= 1;
        this.state.larvae -= 1;
        this.state.totalExperience += 1;
        this.state.workers += 1;
      }
    }
  }

  public reset(): void {
    this.state.food = 12;
    this.state.gold = 80;
    this.state.incubationProgress = 0;
    this.state.larvae = 0;
    this.state.queenProgress = 0;
    this.state.totalExperience = this.initialWorkers;
    this.state.workers = this.initialWorkers;
  }

  public setInfrastructure(
    roomCounts: ColonyRoomCounts,
    roomUpgradeTotals: ColonyRoomUpgradeTotals,
  ): void {
    this.state.roomCounts = { ...roomCounts };
    this.state.roomUpgradeTotals = { ...roomUpgradeTotals };
    this.state.food = Math.min(this.state.food, this.getFoodCapacity());
  }

  public tryPurchaseRoomUpgrade(
    requirement: RoomUpgradeRequirement,
  ): boolean {
    if (
      this.getColonyLevel() < requirement.requiredColonyLevel ||
      this.state.gold < requirement.costGold
    ) {
      return false;
    }

    this.state.gold -= requirement.costGold;

    return true;
  }

  public trySpendGold(amount: number): boolean {
    if (amount <= 0 || this.state.gold < amount) {
      return false;
    }

    this.state.gold -= amount;

    return true;
  }

  public getSnapshot(): ColonyEconomySnapshot {
    const colonyLevel = this.getColonyLevel();

    return {
      colonyExperience: this.getColonyExperience(),
      colonyExperienceProgress: this.getColonyExperienceProgress(),
      colonyExperienceToNextLevel: this.getColonyExperienceToNextLevel(),
      colonyLevel,
      food: Number(this.state.food.toFixed(1)),
      foodCapacity: this.getFoodCapacity(),
      gold: this.state.gold,
      larvae: this.state.larvae,
      roomCounts: { ...this.state.roomCounts },
      roomUpgradeTotals: { ...this.state.roomUpgradeTotals },
      workers: this.state.workers,
    };
  }

  private getFoodCapacity(): number {
    return (
      BASE_FOOD_CAPACITY +
      this.state.roomUpgradeTotals.storageLevelTotal * STORAGE_CAPACITY_BONUS
    );
  }

  private getColonyLevel(): number {
    return 1 + Math.floor(this.state.totalExperience / COLONY_EXPERIENCE_PER_LEVEL);
  }

  private getColonyExperience(): number {
    return this.state.totalExperience;
  }

  private getColonyExperienceProgress(): number {
    return this.state.totalExperience % this.getColonyExperienceToNextLevel();
  }

  private getColonyExperienceToNextLevel(): number {
    return COLONY_EXPERIENCE_PER_LEVEL;
  }

  private getBroodChamberProductivity(): number {
    return Math.max(
      this.state.roomCounts.broodChamberCount,
      this.state.roomUpgradeTotals.broodChamberLevelTotal,
    );
  }

  private getFungusFarmProductivity(): number {
    return Math.max(
      this.state.roomCounts.fungusFarmCount,
      this.state.roomUpgradeTotals.fungusFarmLevelTotal,
    );
  }

  private getQueenChamberProductivity(): number {
    return Math.max(
      this.state.roomCounts.queenChamberCount,
      this.state.roomUpgradeTotals.queenChamberLevelTotal,
    );
  }
}
