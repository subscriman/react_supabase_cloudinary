const { extractGeneric, filterByTitleKeywords, filterByUrlKeywords, uniqueByKey } = require('./common');
const { toAbsoluteUrl } = require('../html-extract');
const { fetchText } = require('../http');

const LEEUM_BASE_URL = 'https://www.leeumhoam.org';
const LEEUM_LIST_ENDPOINT = 'https://www.leeumhoam.org/leeum/exhibition/list';
const LEEUM_STATES = ['1', '2']; // 현재 + 예정

function normalizeLeeumDateRange(startDateRaw, endDateRaw) {
  const start = String(startDateRaw || '').trim() || null;
  const endInput = String(endDateRaw || '').trim() || null;
  const isSentinelEnd = Boolean(endInput && /^(1900[-./]?0?1[-./]?0?1)$/.test(endInput));

  let end = isSentinelEnd ? null : endInput;
  if (!end && start) end = start;
  if (start && end && end < start) end = start;

  return {
    startDateRaw: start,
    endDateRaw: end,
    corrected: isSentinelEnd || Boolean(start && endInput && endInput < start),
    endDateRawOriginal: endInput,
  };
}

function normalizeLeeumItem(item, context) {
  const title = String(item?.title || '').trim().slice(0, 200);
  const seq = String(item?.exhibitionSeq || '').trim();
  if (!title || !seq) return null;
  const imagePath = String(item?.image || '').trim();
  const normalizedDates = normalizeLeeumDateRange(item?.startDate, item?.endDate);
  return {
    sourceSiteKey: context.siteKey,
    sourceExternalId: seq,
    title,
    venueName: String(item?.location || '').trim() || '리움미술관',
    startDateRaw: normalizedDates.startDateRaw,
    endDateRaw: normalizedDates.endDateRaw,
    summary: null,
    detailUrl: toAbsoluteUrl(`/leeum/exhibition/${encodeURIComponent(seq)}?params=Y`, LEEUM_BASE_URL),
    listUrl: context.listUrl || null,
    imageUrl: imagePath ? toAbsoluteUrl(`/upload/exhibition/${encodeURIComponent(imagePath)}`, LEEUM_BASE_URL) : null,
    rawType: 'leeum_exhibition_api',
    rawPayload: {
      ...item,
      dateCorrected: normalizedDates.corrected,
      endDateRawOriginal: normalizedDates.endDateRawOriginal,
    },
  };
}

async function fetchLeeumItems(context) {
  const rows = [];
  for (const state of LEEUM_STATES) {
    const query = new URLSearchParams({
      view: 'grid',
      state,
      keyword: '',
      limit: '16',
      mainFlag: 'false',
      found: 'LM',
      page: '1',
      tab: state === '1' ? 'present' : 'expect',
    });
    const url = `${LEEUM_LIST_ENDPOINT}?${query.toString()}`;
    try {
      const response = await fetchText(url, { timeoutMs: 20000, accept: 'application/json, */*;q=0.8' });
      if (!response.ok) continue;
      const parsed = JSON.parse(response.text || '{}');
      const list = Array.isArray(parsed?.list) ? parsed.list : [];
      rows.push(...list.map((item) => normalizeLeeumItem(item, { ...context, listUrl: LEEUM_LIST_ENDPOINT })).filter(Boolean));
    } catch (_error) {
      // Ignore one state failure.
    }
  }
  return rows;
}

async function extractListItems(html, context) {
  const apiItems = await fetchLeeumItems(context);
  if (apiItems.length > 0) {
    return uniqueByKey(apiItems, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
  }

  const generic = extractGeneric(html, context);
  const byUrl = filterByUrlKeywords(generic, ['/exhibitions', '/exhibition', 'leeumhoam.org']);
  const byTitle = filterByTitleKeywords(byUrl.length > 0 ? byUrl : generic, ['전시', 'exhibition', '리움', 'leeum']);
  if (byTitle.length > 0) return byTitle;
  if (byUrl.length > 0) return byUrl;
  return generic;
}

module.exports = {
  extractListItems,
};
