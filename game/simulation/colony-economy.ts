import type { SimulationSystem, SimulationTickContext } from './simulation-engine';

export interface ColonyRoomCounts {
  readonly broodChamberCount: number;
  readonly fungusFarmCount: number;
  readonly queenChamberCount: number;
  readonly storageCount: number;
}

export interface ColonyEconomySnapshot {
  readonly food: number;
  readonly foodCapacity: number;
  readonly larvae: number;
  readonly roomCounts: ColonyRoomCounts;
  readonly workers: number;
}

interface ColonyEconomyState {
  food: number;
  incubationProgress: number;
  larvae: number;
  queenProgress: number;
  roomCounts: ColonyRoomCounts;
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
const PROGRESS_EPSILON = 1e-9;

const EMPTY_ROOM_COUNTS: ColonyRoomCounts = {
  broodChamberCount: 0,
  fungusFarmCount: 0,
  queenChamberCount: 0,
  storageCount: 0,
};

export class ColonyEconomySystem implements SimulationSystem {
  private state: ColonyEconomyState;

  public constructor(options: ColonyEconomySystemOptions = {}) {
    this.state = {
      food: options.initialFood ?? 12,
      incubationProgress: 0,
      larvae: options.initialLarvae ?? 0,
      queenProgress: 0,
      roomCounts: EMPTY_ROOM_COUNTS,
      workers: options.initialWorkers ?? 4,
    };
  }

  public update(context: SimulationTickContext): void {
    const tickDurationSeconds = context.tickDurationMs / 1_000;
    const foodCapacity = this.getFoodCapacity();

    this.state.food = Math.min(
      foodCapacity,
      this.state.food +
        this.state.roomCounts.fungusFarmCount *
          FUNGUS_FARM_FOOD_PER_SECOND *
          tickDurationSeconds,
    );

    if (
      this.state.roomCounts.queenChamberCount > 0 &&
      this.state.food >= QUEEN_FOOD_COST_PER_LARVA
    ) {
      this.state.queenProgress +=
        (this.state.roomCounts.queenChamberCount * tickDurationSeconds) /
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
        (this.state.roomCounts.broodChamberCount * tickDurationSeconds) /
        BROOD_CHAMBER_WORKER_SECONDS;

      while (
        this.state.incubationProgress + PROGRESS_EPSILON >= 1 &&
        this.state.larvae > 0
      ) {
        this.state.incubationProgress -= 1;
        this.state.larvae -= 1;
        this.state.workers += 1;
      }
    }
  }

  public reset(): void {
    this.state.food = 12;
    this.state.incubationProgress = 0;
    this.state.larvae = 0;
    this.state.queenProgress = 0;
    this.state.workers = 4;
  }

  public setRoomCounts(roomCounts: ColonyRoomCounts): void {
    this.state.roomCounts = { ...roomCounts };
    this.state.food = Math.min(this.state.food, this.getFoodCapacity());
  }

  public getSnapshot(): ColonyEconomySnapshot {
    return {
      food: Number(this.state.food.toFixed(1)),
      foodCapacity: this.getFoodCapacity(),
      larvae: this.state.larvae,
      roomCounts: { ...this.state.roomCounts },
      workers: this.state.workers,
    };
  }

  private getFoodCapacity(): number {
    return (
      BASE_FOOD_CAPACITY +
      this.state.roomCounts.storageCount * STORAGE_CAPACITY_BONUS
    );
  }
}
