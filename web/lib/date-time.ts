export function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function dateOnlyToUtcMs(value: string): number | null {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day);
}

export function formatDateOnlyLocal(value: string, locale = 'ko-KR'): string {
  const parsed = parseDateOnly(value);
  if (!parsed) return value;
  const localDate = new Date(parsed.year, parsed.month - 1, parsed.day);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(localDate);
}

export function formatDateTimeLocal(value: string | null | undefined, locale = 'ko-KR'): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function daysUntilDateOnly(endDate: string, now = new Date()): number | null {
  const endMs = dateOnlyToUtcMs(endDate);
  if (endMs === null) return null;
  const todayUtcMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((endMs - todayUtcMs) / (24 * 60 * 60 * 1000));
}
