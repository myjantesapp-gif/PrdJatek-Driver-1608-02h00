/** Do not display invented zero counts or ratings before a remote sync. */
export function formatRemoteNumber(value: number, decimals = 0): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : '—';
}