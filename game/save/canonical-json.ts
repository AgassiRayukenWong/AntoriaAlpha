type CanonicalJsonPrimitive = boolean | null | number | string;
type CanonicalJsonValue =
  | CanonicalJsonPrimitive
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

export const createCanonicalJson = (value: unknown): string => {
  return JSON.stringify(normalizeCanonicalJsonValue(value));
};

const normalizeCanonicalJsonValue = (value: unknown): CanonicalJsonValue => {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    assertFiniteNumber(value);

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeCanonicalJsonValue(item));
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, CanonicalJsonValue>>((normalizedValue, key) => {
        normalizedValue[key] = normalizeCanonicalJsonValue(value[key]);

        return normalizedValue;
      }, {});
  }

  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}.`);
};

const assertFiniteNumber = (value: number): void => {
  if (!Number.isFinite(value)) {
    throw new TypeError('Canonical JSON numbers must be finite.');
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};
