import type { SimulationSystem } from '@/game/simulation/simulation-engine';

export const DEFAULT_GAME_RUNTIME_CONFIG = {
  maximumDeltaTimeMs: 1_000,
  simulationTickDurationMs: 100,
} as const;

export interface GameRuntimeOptions {
  readonly maximumDeltaTimeMs?: number;
  readonly simulationTickDurationMs?: number;
  readonly systems?: readonly SimulationSystem[];
}
