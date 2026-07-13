export enum OfflineActionKind {
  SimulationStep = 'simulation_step',
}

export enum OfflineSaveVerificationStatus {
  Accepted = 'accepted',
  PartiallyAccepted = 'partially_accepted',
  Rejected = 'rejected',
}

export interface SyncTokenPayload {
  readonly playerId: string;
  readonly issuedAtServerMs: number;
  readonly saveVersion: number;
  readonly validatedStateHash: string;
  readonly nonce: string;
}

export interface SignedSyncToken {
  readonly payload: SyncTokenPayload;
  readonly signature: string;
}

export interface OfflineActionBase {
  readonly id: string;
  readonly kind: OfflineActionKind;
  readonly createdAtLocalMs: number;
  readonly previousActionHash: string;
  readonly actionHash: string;
}

export interface OfflineSimulationStepAction extends OfflineActionBase {
  readonly kind: OfflineActionKind.SimulationStep;
  readonly deltaTimeMs: number;
}

export type OfflineAction = OfflineSimulationStepAction;

export interface OfflineSaveMetadata {
  readonly playerId: string;
  readonly saveVersion: number;
  readonly createdAtLocalMs: number;
  readonly updatedAtLocalMs: number;
}

export interface OfflineSave {
  readonly metadata: OfflineSaveMetadata;
  readonly lastServerSyncToken: SignedSyncToken;
  readonly baseStateHash: string;
  readonly actionLog: readonly OfflineAction[];
  readonly actionChainHash: string;
  readonly localSignature: string;
}

export interface OfflineSaveVerificationResult {
  readonly status: OfflineSaveVerificationStatus;
  readonly acceptedActionCount: number;
  readonly rejectedActionCount: number;
  readonly validatedStateHash: string;
}
