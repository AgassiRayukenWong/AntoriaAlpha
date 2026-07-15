import { describe, expect, it } from 'vitest';

import {
  getRoomUpgradeRequirement,
  isRoomUpgradeable,
} from '@/game/simulation/room-upgrades';

describe('room upgrades', () => {
  it('marks active economy rooms as upgradeable', () => {
    expect(isRoomUpgradeable('queen-chamber')).toBe(true);
    expect(isRoomUpgradeable('brood-chamber')).toBe(true);
    expect(isRoomUpgradeable('storage')).toBe(true);
    expect(isRoomUpgradeable('fungus-farm')).toBe(true);
    expect(isRoomUpgradeable('barracks')).toBe(false);
    expect(isRoomUpgradeable(undefined)).toBe(false);
  });

  it('returns the next upgrade requirement for an upgradeable room', () => {
    expect(getRoomUpgradeRequirement('queen-chamber', 1)).toEqual({
      costGold: 30,
      currentLevel: 1,
      maxLevel: 5,
      nextLevel: 2,
      requiredColonyLevel: 1,
    });
  });

  it('stops offering upgrades once max level is reached', () => {
    expect(getRoomUpgradeRequirement('storage', 5)).toBeUndefined();
  });
});
