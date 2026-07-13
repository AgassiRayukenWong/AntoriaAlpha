import { describe, expect, it } from 'vitest';

import { createCanonicalJson } from '@/game/save/canonical-json';

describe('createCanonicalJson', () => {
  it('serializes object keys in a stable order', () => {
    const firstValue = {
      saveVersion: 1,
      playerId: 'player-1',
    };
    const secondValue = {
      playerId: 'player-1',
      saveVersion: 1,
    };

    expect(createCanonicalJson(firstValue)).toBe(
      createCanonicalJson(secondValue),
    );
    expect(createCanonicalJson(firstValue)).toBe(
      '{"playerId":"player-1","saveVersion":1}',
    );
  });

  it('keeps array order while sorting nested object keys', () => {
    const value = {
      actionLog: [
        {
          z: 1,
          a: 'first',
        },
        {
          b: 'second',
          a: 2,
        },
      ],
    };

    expect(createCanonicalJson(value)).toBe(
      '{"actionLog":[{"a":"first","z":1},{"a":2,"b":"second"}]}',
    );
  });

  it('supports primitive JSON values', () => {
    expect(createCanonicalJson(null)).toBe('null');
    expect(createCanonicalJson(true)).toBe('true');
    expect(createCanonicalJson(12)).toBe('12');
    expect(createCanonicalJson('antoria')).toBe('"antoria"');
  });

  it('rejects unsupported values', () => {
    expect(() => createCanonicalJson(undefined)).toThrow(TypeError);
    expect(() => createCanonicalJson(() => 'invalid')).toThrow(TypeError);
    expect(() => createCanonicalJson(Symbol('invalid'))).toThrow(TypeError);
    expect(() => createCanonicalJson(Number.NaN)).toThrow(TypeError);
    expect(() => createCanonicalJson(Number.POSITIVE_INFINITY)).toThrow(
      TypeError,
    );
  });
});
