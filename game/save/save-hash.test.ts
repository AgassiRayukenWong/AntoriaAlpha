import { describe, expect, it } from 'vitest';

import { createCanonicalSha256Hash } from '@/game/save/save-hash';

describe('createCanonicalSha256Hash', () => {
  it('creates a stable hash from canonical JSON', async () => {
    const firstHash = await createCanonicalSha256Hash({
      saveVersion: 1,
      playerId: 'player-1',
    });
    const secondHash = await createCanonicalSha256Hash({
      playerId: 'player-1',
      saveVersion: 1,
    });

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toBe(
      '3350c198e176b050bc5b384062487d7ebf961aa02221d4867e2f95cfc23c6238',
    );
  });

  it('creates different hashes for different canonical values', async () => {
    const firstHash = await createCanonicalSha256Hash({
      playerId: 'player-1',
      saveVersion: 1,
    });
    const secondHash = await createCanonicalSha256Hash({
      playerId: 'player-1',
      saveVersion: 2,
    });

    expect(firstHash).not.toBe(secondHash);
  });

  it('rejects unsupported canonical JSON values', async () => {
    await expect(createCanonicalSha256Hash(undefined)).rejects.toThrow(
      TypeError,
    );
  });
});
