/** R225.00/hr — institution default when DB value is missing. */
export const DEFAULT_TUTOR_HOURLY_RATE_CENTS = 22_500;

export function formatZarFromCents(cents: number): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function computeAmountCents(
  hours: number,
  hourlyRateCents: number,
): number {
  return Math.round(hours * hourlyRateCents);
}

export function parseRateInputToCents(input: string): number | null {
  const trimmed = input.trim().replace(/^R\s*/i, "");
  if (!trimmed) return null;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export function formatRateFromCents(cents: number): string {
  return formatZarFromCents(cents).replace(/\.00$/, "");
}
