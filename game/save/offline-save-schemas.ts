import { z } from 'zod';

import {
  OfflineActionKind,
  OfflineSaveVerificationStatus,
} from './offline-save-contracts';

const nonEmptyStringSchema = z.string().trim().min(1);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const positiveIntegerSchema = z.number().int().positive();

export const syncTokenPayloadSchema = z.object({
  playerId: nonEmptyStringSchema,
  issuedAtServerMs: nonNegativeIntegerSchema,
  saveVersion: positiveIntegerSchema,
  validatedStateHash: nonEmptyStringSchema,
  nonce: nonEmptyStringSchema,
});

export const signedSyncTokenSchema = z.object({
  payload: syncTokenPayloadSchema,
  signature: nonEmptyStringSchema,
});

export const offlineSimulationStepActionSchema = z.object({
  id: nonEmptyStringSchema,
  kind: z.literal(OfflineActionKind.SimulationStep),
  createdAtLocalMs: nonNegativeIntegerSchema,
  previousActionHash: nonEmptyStringSchema,
  actionHash: nonEmptyStringSchema,
  deltaTimeMs: positiveIntegerSchema,
});

export const offlineActionSchema = offlineSimulationStepActionSchema;

export const offlineSaveMetadataSchema = z
  .object({
    playerId: nonEmptyStringSchema,
    saveVersion: positiveIntegerSchema,
    createdAtLocalMs: nonNegativeIntegerSchema,
    updatedAtLocalMs: nonNegativeIntegerSchema,
  })
  .refine(
    (metadata) => metadata.updatedAtLocalMs >= metadata.createdAtLocalMs,
    {
      message:
        'updatedAtLocalMs must be greater than or equal to createdAtLocalMs.',
      path: ['updatedAtLocalMs'],
    },
  );

export const offlineSaveSchema = z.object({
  metadata: offlineSaveMetadataSchema,
  lastServerSyncToken: signedSyncTokenSchema,
  baseStateHash: nonEmptyStringSchema,
  actionLog: z.array(offlineActionSchema),
  actionChainHash: nonEmptyStringSchema,
  localSignature: nonEmptyStringSchema,
});

export const offlineSaveVerificationResultSchema = z.object({
  status: z.enum(OfflineSaveVerificationStatus),
  acceptedActionCount: nonNegativeIntegerSchema,
  rejectedActionCount: nonNegativeIntegerSchema,
  validatedStateHash: nonEmptyStringSchema,
});
