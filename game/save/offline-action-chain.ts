import { type OfflineAction } from './offline-save-contracts';
import { createCanonicalSha256Hash } from './save-hash';

type HashableOfflineAction = Omit<
  OfflineAction,
  'actionHash' | 'previousActionHash'
>;

export interface OfflineActionHashInput {
  readonly action: HashableOfflineAction;
  readonly previousActionHash: string;
}

export interface OfflineActionChainVerificationResult {
  readonly isValid: boolean;
  readonly verifiedActionCount: number;
  readonly expectedActionChainHash: string;
  readonly receivedActionChainHash: string;
}

export const createOfflineActionHash = async ({
  action,
  previousActionHash,
}: OfflineActionHashInput): Promise<string> => {
  return createCanonicalSha256Hash({
    action,
    previousActionHash,
  });
};

export const createOfflineActionChainHash = async (
  baseStateHash: string,
  actionLog: readonly OfflineAction[],
): Promise<string> => {
  let currentActionHash = baseStateHash;

  for (const action of actionLog) {
    currentActionHash = await createOfflineActionHash({
      action: removeStoredActionHashes(action),
      previousActionHash: currentActionHash,
    });
  }

  return currentActionHash;
};

export const verifyOfflineActionChain = async (
  baseStateHash: string,
  actionLog: readonly OfflineAction[],
  receivedActionChainHash: string,
): Promise<OfflineActionChainVerificationResult> => {
  let currentActionHash = baseStateHash;
  let verifiedActionCount = 0;

  for (const action of actionLog) {
    const expectedActionHash = await createOfflineActionHash({
      action: removeStoredActionHashes(action),
      previousActionHash: currentActionHash,
    });

    if (
      action.previousActionHash !== currentActionHash ||
      action.actionHash !== expectedActionHash
    ) {
      return {
        isValid: false,
        verifiedActionCount,
        expectedActionChainHash: expectedActionHash,
        receivedActionChainHash,
      };
    }

    currentActionHash = expectedActionHash;
    verifiedActionCount += 1;
  }

  return {
    isValid: currentActionHash === receivedActionChainHash,
    verifiedActionCount,
    expectedActionChainHash: currentActionHash,
    receivedActionChainHash,
  };
};

const removeStoredActionHashes = (
  action: OfflineAction,
): HashableOfflineAction => {
  return {
    id: action.id,
    kind: action.kind,
    createdAtLocalMs: action.createdAtLocalMs,
    deltaTimeMs: action.deltaTimeMs,
  };
};
