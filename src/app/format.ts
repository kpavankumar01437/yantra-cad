export function fmt(value: number | undefined, digits = 2): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  const rounded = Number(value.toFixed(digits));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function toNumber(text: string, fallback: number): number {
  const parsed = Number(text.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}
