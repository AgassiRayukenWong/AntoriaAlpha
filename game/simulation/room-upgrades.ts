export type UpgradeableRoomDefinitionId =
  | 'brood-chamber'
  | 'fungus-farm'
  | 'queen-chamber'
  | 'storage';

export interface RoomUpgradeRequirement {
  readonly costGold: number;
  readonly currentLevel: number;
  readonly maxLevel: number;
  readonly nextLevel: number;
  readonly requiredColonyLevel: number;
}

const ROOM_MAX_LEVEL = 5;

const upgradeableRoomDefinitionIds = new Set<UpgradeableRoomDefinitionId>([
  'brood-chamber',
  'fungus-farm',
  'queen-chamber',
  'storage',
]);

export const isRoomUpgradeable = (
  definitionId: string | undefined,
): definitionId is UpgradeableRoomDefinitionId => {
  return (
    definitionId !== undefined &&
    upgradeableRoomDefinitionIds.has(definitionId as UpgradeableRoomDefinitionId)
  );
};

export const getRoomUpgradeRequirement = (
  definitionId: string | undefined,
  currentLevel: number,
): RoomUpgradeRequirement | undefined => {
  if (!isRoomUpgradeable(definitionId) || currentLevel >= ROOM_MAX_LEVEL) {
    return undefined;
  }

  const nextLevel = currentLevel + 1;

  switch (definitionId) {
    case 'queen-chamber':
      return {
        costGold: 14 + nextLevel * 8,
        currentLevel,
        maxLevel: ROOM_MAX_LEVEL,
        nextLevel,
        requiredColonyLevel: nextLevel - 1,
      };
    case 'brood-chamber':
      return {
        costGold: 12 + nextLevel * 7,
        currentLevel,
        maxLevel: ROOM_MAX_LEVEL,
        nextLevel,
        requiredColonyLevel: nextLevel - 1,
      };
    case 'storage':
      return {
        costGold: 10 + nextLevel * 6,
        currentLevel,
        maxLevel: ROOM_MAX_LEVEL,
        nextLevel,
        requiredColonyLevel: Math.max(1, nextLevel - 1),
      };
    case 'fungus-farm':
      return {
        costGold: 12 + nextLevel * 7,
        currentLevel,
        maxLevel: ROOM_MAX_LEVEL,
        nextLevel,
        requiredColonyLevel: Math.max(1, nextLevel - 1),
      };
  }
};
