import { describe, expect, it } from 'vitest';
import { formatMAD, readRemoteAmount } from '../lib/money';

describe('remote MAD amounts', () => {
  it('formats backend amounts without conversion', () => {
    expect(formatMAD(25)).toBe('25.00 MAD');
    expect(formatMAD(123.45)).toBe('123.45 MAD');
    expect(formatMAD(0)).toBe('0.00 MAD');
  });

  it('does not invent an amount when the backend omits it', () => {
    for (const amount of [undefined, null, NaN, Infinity]) {
      expect(formatMAD(amount)).toBe('Montant indisponible');
    }
  });

  it('preserves numeric strings from the backend and rejects fabricated zero values', () => {
    expect(readRemoteAmount('123.45')).toBe(123.45);
    expect(readRemoteAmount(0)).toBe(0);
    for (const value of [null, undefined, '', ' ', false, 'invalid']) {
      expect(formatMAD(readRemoteAmount(value))).toBe('Montant indisponible');
    }
  });
});