import { describe, expect, it } from 'vitest';

import {
  OfflineActionKind,
  OfflineSaveVerificationStatus,
  type OfflineSave,
  type OfflineSaveVerificationResult,
} from '@/game/save/offline-save-contracts';

describe('offline save contracts', () => {
  it('supports a signed offline save shape', () => {
    const offlineSave = {
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
    } satisfies OfflineSave;

    expect(offlineSave.actionLog[0]?.kind).toBe(
      OfflineActionKind.SimulationStep,
    );
  });

  it('supports an offline save verification result shape', () => {
    const verificationResult = {
      status: OfflineSaveVerificationStatus.Accepted,
      acceptedActionCount: 1,
      rejectedActionCount: 0,
      validatedStateHash: 'state-hash-2',
    } satisfies OfflineSaveVerificationResult;

    expect(verificationResult.status).toBe(
      OfflineSaveVerificationStatus.Accepted,
    );
  });
});
