import { describe, expect, it } from 'vitest';

import {
  createOfflineActionChainHash,
  createOfflineActionHash,
  verifyOfflineActionChain,
} from '@/game/save/offline-action-chain';
import {
  OfflineActionKind,
  type OfflineAction,
} from '@/game/save/offline-save-contracts';

const baseStateHash = 'base-state-hash-1';

const createSimulationStepAction = async (
  id: string,
  previousActionHash: string,
  deltaTimeMs: number,
): Promise<OfflineAction> => {
  const actionWithoutHashes = {
    id,
    kind: OfflineActionKind.SimulationStep,
    createdAtLocalMs: 1_000,
    deltaTimeMs,
  };
  const actionHash = await createOfflineActionHash({
    action: actionWithoutHashes,
    previousActionHash,
  });

  return {
    ...actionWithoutHashes,
    previousActionHash,
    actionHash,
  };
};

describe('offline action chain', () => {
  it('creates the base state hash for an empty action log', async () => {
    await expect(createOfflineActionChainHash(baseStateHash, [])).resolves.toBe(
      baseStateHash,
    );
  });

  it('verifies a valid chained action log', async () => {
    const firstAction = await createSimulationStepAction(
      'action-1',
      baseStateHash,
      100,
    );
    const secondAction = await createSimulationStepAction(
      'action-2',
      firstAction.actionHash,
      150,
    );
    const actionLog = [firstAction, secondAction];
    const actionChainHash = await createOfflineActionChainHash(
      baseStateHash,
      actionLog,
    );

    await expect(
      verifyOfflineActionChain(baseStateHash, actionLog, actionChainHash),
    ).resolves.toEqual({
      isValid: true,
      verifiedActionCount: 2,
      expectedActionChainHash: actionChainHash,
      receivedActionChainHash: actionChainHash,
    });
  });

  it('rejects a modified action', async () => {
    const action = await createSimulationStepAction(
      'action-1',
      baseStateHash,
      100,
    );
    const modifiedAction = {
      ...action,
      deltaTimeMs: 500,
    };

    await expect(
      verifyOfflineActionChain(
        baseStateHash,
        [modifiedAction],
        action.actionHash,
      ),
    ).resolves.toMatchObject({
      isValid: false,
      verifiedActionCount: 0,
      receivedActionChainHash: action.actionHash,
    });
  });

  it('rejects a broken previous hash link', async () => {
    const firstAction = await createSimulationStepAction(
      'action-1',
      baseStateHash,
      100,
    );
    const secondAction = await createSimulationStepAction(
      'action-2',
      firstAction.actionHash,
      150,
    );
    const actionLog = [
      firstAction,
      {
        ...secondAction,
        previousActionHash: 'invalid-previous-hash',
      },
    ];

    await expect(
      verifyOfflineActionChain(
        baseStateHash,
        actionLog,
        secondAction.actionHash,
      ),
    ).resolves.toMatchObject({
      isValid: false,
      verifiedActionCount: 1,
    });
  });
});
