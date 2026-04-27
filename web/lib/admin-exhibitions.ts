type NullableString = string | null;

export type AdminExhibitionUpdatePayload = {
  title: string;
  subtitle: NullableString;
  startDate: string;
  endDate: string;
  operatingHours: NullableString;
  admissionFee: NullableString;
  summary: NullableString;
  description: NullableString;
  officialUrl: NullableString;
  bookingUrl: NullableString;
  posterImageUrl: NullableString;
};

export type AdminExhibitionEditableRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  status: string;
  start_date: string;
  end_date: string;
  operating_hours: string | null;
  admission_fee: string | null;
  summary: string | null;
  description: string | null;
  official_url: string | null;
  booking_url: string | null;
  poster_image_url: string | null;
  updated_at: string;
  published_at: string | null;
};

export type AdminExternalReviewRow = {
  id: string;
  exhibition_id: string;
  title: string;
  source_name: string;
  url: string;
  summary: string | null;
  sort_order: number;
  is_hidden: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminExternalReviewPayload = {
  title: string;
  sourceName: string;
  url: string;
  summary: NullableString;
  sortOrder: number;
  isHidden: boolean;
};

export function rowToUpdatePayload(row: AdminExhibitionEditableRow): AdminExhibitionUpdatePayload {
  return {
    title: row.title,
    subtitle: row.subtitle,
    startDate: row.start_date,
    endDate: row.end_date,
    operatingHours: row.operating_hours,
    admissionFee: row.admission_fee,
    summary: row.summary,
    description: row.description,
    officialUrl: row.official_url,
    bookingUrl: row.booking_url,
    posterImageUrl: row.poster_image_url,
  };
}

function sanitizeOptionalString(input: unknown, maxLength: number): NullableString | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) return undefined;
  return trimmed;
}

function sanitizeBoolean(input: unknown): boolean | undefined {
  if (typeof input !== 'boolean') return undefined;
  return input;
}

function sanitizeInteger(input: unknown, min: number, max: number): number | undefined {
  if (typeof input !== 'number' || !Number.isInteger(input)) return undefined;
  if (input < min || input > max) return undefined;
  return input;
}

function sanitizeRequiredString(input: unknown, maxLength: number): string | undefined {
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return undefined;
  return trimmed;
}

function isDateOnlyFormat(input: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(input);
}

function sanitizeDate(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!isDateOnlyFormat(trimmed)) return undefined;
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : trimmed;
}

function sanitizeOptionalUrl(input: unknown): NullableString | undefined {
  const normalized = sanitizeOptionalString(input, 1000);
  if (normalized === undefined || normalized === null) return normalized;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return normalized;
  } catch {
    return undefined;
  }
}

export function parseAdminExhibitionUpdatePayload(
  input: unknown,
): { ok: true; value: AdminExhibitionUpdatePayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  }

  const body = input as Record<string, unknown>;

  const title = sanitizeRequiredString(body.title, 200);
  if (!title) return { ok: false, error: '전시 제목은 1자 이상 200자 이하여야 합니다.' };

  const subtitle = sanitizeOptionalString(body.subtitle, 200);
  if (subtitle === undefined) return { ok: false, error: '부제목 길이가 올바르지 않습니다.' };

  const startDate = sanitizeDate(body.startDate);
  const endDate = sanitizeDate(body.endDate);
  if (!startDate || !endDate) {
    return { ok: false, error: '전시 기간 날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)' };
  }
  if (startDate > endDate) {
    return { ok: false, error: '종료일은 시작일보다 빠를 수 없습니다.' };
  }

  const operatingHours = sanitizeOptionalString(body.operatingHours, 300);
  if (operatingHours === undefined) return { ok: false, error: '운영 시간 길이가 올바르지 않습니다.' };

  const admissionFee = sanitizeOptionalString(body.admissionFee, 300);
  if (admissionFee === undefined) return { ok: false, error: '관람료 길이가 올바르지 않습니다.' };

  const summary = sanitizeOptionalString(body.summary, 1000);
  if (summary === undefined) return { ok: false, error: '요약 길이가 올바르지 않습니다.' };

  const description = sanitizeOptionalString(body.description, 5000);
  if (description === undefined) return { ok: false, error: '전시 소개 길이가 올바르지 않습니다.' };

  const officialUrl = sanitizeOptionalUrl(body.officialUrl);
  if (officialUrl === undefined) return { ok: false, error: '공식 링크 형식이 올바르지 않습니다.' };

  const bookingUrl = sanitizeOptionalUrl(body.bookingUrl);
  if (bookingUrl === undefined) return { ok: false, error: '예매 링크 형식이 올바르지 않습니다.' };

  const posterImageUrl = sanitizeOptionalUrl(body.posterImageUrl);
  if (posterImageUrl === undefined) return { ok: false, error: '포스터 이미지 URL 형식이 올바르지 않습니다.' };

  return {
    ok: true,
    value: {
      title,
      subtitle,
      startDate,
      endDate,
      operatingHours,
      admissionFee,
      summary,
      description,
      officialUrl,
      bookingUrl,
      posterImageUrl,
    },
  };
}

export function parseAdminExternalReviewPayload(
  input: unknown,
): { ok: true; value: AdminExternalReviewPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  }

  const body = input as Record<string, unknown>;

  const title = sanitizeRequiredString(body.title, 200);
  if (!title) return { ok: false, error: '후기 제목은 1자 이상 200자 이하여야 합니다.' };

  const sourceName = sanitizeRequiredString(body.sourceName, 120);
  if (!sourceName) return { ok: false, error: '출처 이름은 1자 이상 120자 이하여야 합니다.' };

  const url = sanitizeRequiredString(body.url, 1000);
  if (!url) return { ok: false, error: '후기 URL은 1자 이상 1000자 이하여야 합니다.' };
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { ok: false, error: '후기 URL은 http 또는 https 형식이어야 합니다.' };
    }
  } catch {
    return { ok: false, error: '후기 URL 형식이 올바르지 않습니다.' };
  }

  const summary = sanitizeOptionalString(body.summary, 1000);
  if (summary === undefined) return { ok: false, error: '요약 길이가 올바르지 않습니다.' };

  const sortOrder = sanitizeInteger(body.sortOrder, 0, 9999);
  if (sortOrder === undefined) return { ok: false, error: '정렬 순서는 0~9999 정수여야 합니다.' };

  const isHidden = sanitizeBoolean(body.isHidden);
  if (isHidden === undefined) return { ok: false, error: '숨김 여부 값이 올바르지 않습니다.' };

  return {
    ok: true,
    value: {
      title,
      sourceName,
      url,
      summary,
      sortOrder,
      isHidden,
    },
  };
}
