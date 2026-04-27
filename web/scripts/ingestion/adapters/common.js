const { extractRawItemsFromHtml, stripHtml } = require('../html-extract');

function uniqueByKey(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function filterByUrlKeywords(items, keywords) {
  if (!keywords || keywords.length === 0) return items;
  return items.filter((item) => {
    const url = String(item.detailUrl || '').toLowerCase();
    if (!url) return false;
    return keywords.some((keyword) => url.includes(String(keyword).toLowerCase()));
  });
}

function filterByTitleKeywords(items, keywords) {
  if (!keywords || keywords.length === 0) return items;
  return items.filter((item) => {
    const title = String(item.title || '').toLowerCase();
    if (!title) return false;
    return keywords.some((keyword) => title.includes(String(keyword).toLowerCase()));
  });
}

function extractGeneric(html, context) {
  const base = extractRawItemsFromHtml(html, {
    siteKey: context.siteKey,
    baseUrl: context.baseUrl,
    listUrl: context.listUrl,
  });
  return uniqueByKey(base, (item) => `${item.title || ''}::${item.detailUrl || ''}`);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toIsoDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (y < 1900 || y > 9999) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
}

function normalizeDateToken(value) {
  const cleaned = String(value || '')
    .replace(/[()가-힣]/g, '')
    .replace(/[년./]/g, '-')
    .replace(/[월]/g, '-')
    .replace(/[일]/g, '')
    .replace(/\s+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const matched = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!matched) return null;
  return toIsoDate(matched[1], matched[2], matched[3]);
}

function parseDateRange(value) {
  const raw = stripHtml(value || '')
    .replace(/[–—]/g, '~')
    .replace(/\s*~\s*/g, ' ~ ')
    .trim();
  if (!raw) return { startDateRaw: null, endDateRaw: null };

  // yyyy-mm-dd / yyyy.mm.dd / yyyy/mm/dd style
  const numericMatches = raw.match(/\d{4}[./-]\d{1,2}[./-]\d{1,2}/g) || [];
  if (numericMatches.length > 0) {
    const start = normalizeDateToken(numericMatches[0]);
    const end = normalizeDateToken(numericMatches[1] || numericMatches[0]);
    return { startDateRaw: start, endDateRaw: end };
  }

  // "March 19 – May 10, 2026" style
  const monthRange = raw.match(
    /^([A-Za-z]+)\s+(\d{1,2})\s*~\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/,
  );
  if (monthRange) {
    const [, monthA, dayA, monthB, dayB, year] = monthRange;
    const start = new Date(`${monthA} ${dayA}, ${year}`);
    const end = new Date(`${monthB} ${dayB}, ${year}`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return {
        startDateRaw: start.toISOString().slice(0, 10),
        endDateRaw: end.toISOString().slice(0, 10),
      };
    }
  }

  // "March 19, 2026 ~ May 10, 2026" style
  const englishTokens =
    raw.match(/[A-Za-z]+\s+\d{1,2},\s*\d{4}/g)?.map((token) => token.trim()) || [];
  if (englishTokens.length > 0) {
    const start = new Date(englishTokens[0]);
    const end = new Date(englishTokens[1] || englishTokens[0]);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return {
        startDateRaw: start.toISOString().slice(0, 10),
        endDateRaw: end.toISOString().slice(0, 10),
      };
    }
  }

  return { startDateRaw: null, endDateRaw: null };
}

function cleanText(value, maxLength = 300) {
  return stripHtml(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

module.exports = {
  cleanText,
  extractGeneric,
  filterByTitleKeywords,
  filterByUrlKeywords,
  normalizeDateToken,
  parseDateRange,
  uniqueByKey,
};
