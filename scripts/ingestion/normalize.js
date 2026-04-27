function slugify(input) {
  const ascii = String(input || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return ascii.slice(0, 90).replace(/^-|-$/g, '');
}

function parseDateLike(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const ymdMatch = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
        .toString()
        .padStart(2, '0')}`;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function sanitizeNullableString(value, maxLength = 5000) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function sanitizeUrl(value) {
  const normalized = sanitizeNullableString(value, 1000);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function fallbackNormalize(rawItem) {
  const title = sanitizeNullableString(rawItem?.title, 200);
  return {
    title,
    subtitle: null,
    venueName: sanitizeNullableString(rawItem?.venueName, 200),
    city: null,
    district: null,
    startDate: parseDateLike(rawItem?.startDateRaw),
    endDate: parseDateLike(rawItem?.endDateRaw),
    operatingHours: null,
    admissionFee: null,
    summary: sanitizeNullableString(rawItem?.summary, 1000),
    description: sanitizeNullableString(rawItem?.summary, 60000),
    officialUrl: sanitizeUrl(rawItem?.detailUrl || rawItem?.listUrl),
    bookingUrl: null,
    posterImageUrl: sanitizeUrl(rawItem?.imageUrl),
    tagCandidates: [],
  };
}

function validateAndCoerceNormalized(raw) {
  const errors = [];
  const normalized = {
    title: sanitizeNullableString(raw?.title, 200),
    subtitle: sanitizeNullableString(raw?.subtitle, 200),
    venueName: sanitizeNullableString(raw?.venueName, 200),
    city: sanitizeNullableString(raw?.city, 60),
    district: sanitizeNullableString(raw?.district, 60),
    startDate: parseDateLike(raw?.startDate),
    endDate: parseDateLike(raw?.endDate),
    operatingHours: sanitizeNullableString(raw?.operatingHours, 300),
    admissionFee: sanitizeNullableString(raw?.admissionFee, 300),
    summary: sanitizeNullableString(raw?.summary, 1000),
    description: sanitizeNullableString(raw?.description, 60000),
    officialUrl: sanitizeUrl(raw?.officialUrl),
    bookingUrl: sanitizeUrl(raw?.bookingUrl),
    posterImageUrl: sanitizeUrl(raw?.posterImageUrl),
    tagCandidates: [],
  };

  if (Array.isArray(raw?.tagCandidates)) {
    normalized.tagCandidates = Array.from(
      new Set(
        raw.tagCandidates
          .map((value) => sanitizeNullableString(value, 40))
          .filter((value) => Boolean(value)),
      ),
    ).slice(0, 12);
  }

  if (!normalized.title) errors.push('title 누락');
  if (!normalized.venueName) errors.push('venueName 누락');
  if (!normalized.startDate) errors.push('startDate 누락');
  if (!normalized.endDate) errors.push('endDate 누락');
  if (!normalized.officialUrl) errors.push('officialUrl 누락');

  if (normalized.startDate && normalized.endDate && normalized.endDate < normalized.startDate) {
    errors.push('endDate가 startDate보다 이릅니다.');
  }

  if (!normalized.summary && normalized.description) {
    normalized.summary = normalized.description.slice(0, 200);
  }
  if (!normalized.description && normalized.summary) {
    normalized.description = normalized.summary;
  }

  return {
    ok: errors.length === 0,
    errors,
    value: normalized,
  };
}

function buildDedupeKey(normalized) {
  const title = slugify(normalized?.title || '');
  const venue = slugify(normalized?.venueName || '');
  const start = normalized?.startDate || '';
  const end = normalized?.endDate || '';
  return [title, venue, start, end].join('::');
}

module.exports = {
  buildDedupeKey,
  fallbackNormalize,
  slugify,
  validateAndCoerceNormalized,
};
