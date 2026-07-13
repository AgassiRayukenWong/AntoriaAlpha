import { createCanonicalJson } from './canonical-json';

export const createCanonicalSha256Hash = async (
  value: unknown,
): Promise<string> => {
  const canonicalJson = createCanonicalJson(value);
  const encodedValue = new TextEncoder().encode(canonicalJson);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedValue);

  return createHexadecimalHash(hashBuffer);
};

const createHexadecimalHash = (hashBuffer: ArrayBuffer): string => {
  return [...new Uint8Array(hashBuffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};
