/** Missing or invalid remote values must not be presented as zero earnings. */
export function readRemoteAmount(value: unknown): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) {
    return NaN;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
}

/** Backend amounts are already denominated in MAD; never convert them locally. */
export function formatMAD(amount: number | undefined | null): string {
  return typeof amount === 'number' && Number.isFinite(amount)
    ? `${amount.toFixed(2)} MAD`
    : 'Montant indisponible';
}