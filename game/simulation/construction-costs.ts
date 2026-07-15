export type BuildableStructureType =
  | 'barracks'
  | 'brood-chamber'
  | 'fungus-farm'
  | 'gallery'
  | 'storage';

const constructionCosts = {
  barracks: 6,
  'brood-chamber': 4,
  'fungus-farm': 5,
  gallery: 1,
  storage: 5,
} as const satisfies Record<BuildableStructureType, number>;

export function getConstructionCost(
  structureType: BuildableStructureType,
): number {
  return constructionCosts[structureType];
}
