import { describe, expect, it } from 'vitest';

import { OfflineActionKind } from '@/game/save/offline-save-contracts';
import {
  offlineSaveMetadataSchema,
  offlineSaveSchema,
  offlineSimulationStepActionSchema,
} from '@/game/save/offline-save-schemas';

const createValidOfflineSave = (): unknown => ({
  metadata: {
    playerId: 'player-1',
    saveVersion: 1,
    createdAtLocalMs: 1_000,
    updatedAtLocalMs: 1_500,
  },
  lastServerSyncToken: {
    payload: {
      playerId: 'player-1',
      issuedAtServerMs: 900,
      saveVersion: 1,
      validatedStateHash: 'state-hash-1',
      nonce: 'nonce-1',
    },
    signature: 'server-signature-1',
  },
  baseStateHash: 'state-hash-1',
  actionLog: [
    {
      id: 'action-1',
      kind: OfflineActionKind.SimulationStep,
      createdAtLocalMs: 1_100,
      previousActionHash: 'state-hash-1',
      actionHash: 'action-hash-1',
      deltaTimeMs: 100,
    },
  ],
  actionChainHash: 'action-hash-1',
  localSignature: 'local-signature-1',
});

describe('offline save schemas', () => {
  it('accepts a valid offline save', () => {
    const parsedOfflineSave = offlineSaveSchema.parse(createValidOfflineSave());

    expect(parsedOfflineSave.metadata.playerId).toBe('player-1');
    expect(parsedOfflineSave.actionLog).toHaveLength(1);
  });

  it('rejects empty signatures', () => {
    const offlineSave = createValidOfflineSave();

    if (typeof offlineSave !== 'object' || offlineSave === null) {
      throw new Error('Expected offline save object.');
    }

    const invalidOfflineSave = {
      ...offlineSave,
      localSignature: '',
    };

    expect(() => offlineSaveSchema.parse(invalidOfflineSave)).toThrow();
  });

  it('rejects metadata updated before creation', () => {
    expect(() =>
      offlineSaveMetadataSchema.parse({
        playerId: 'player-1',
        saveVersion: 1,
        createdAtLocalMs: 1_500,
        updatedAtLocalMs: 1_000,
      }),
    ).toThrow();
  });

  it('rejects simulation steps without positive duration', () => {
    expect(() =>
      offlineSimulationStepActionSchema.parse({
        id: 'action-1',
        kind: OfflineActionKind.SimulationStep,
        createdAtLocalMs: 1_100,
        previousActionHash: 'state-hash-1',
        actionHash: 'action-hash-1',
        deltaTimeMs: 0,
      }),
    ).toThrow();
  });
});
