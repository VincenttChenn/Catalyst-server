// Small, dependency-free validation helpers shared by controllers.

export const isNonEmptyString = (value: unknown, maxLength = 500): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;

export const isPositiveInt = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= max;

export const isNonNegativeInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

// Parse a query-string value into a positive integer, clamped to `max`.
export const parsePositiveInt = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

// Parse a query-string value into a finite number, or undefined if absent/invalid.
export const parseNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

// Avoid floating point drift when summing prices (e.g. 0.1 + 0.2).
export const roundMoney = (value: number): number => Math.round(value * 100) / 100;
