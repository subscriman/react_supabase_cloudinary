const { extractGeneric, filterByUrlKeywords, uniqueByKey } = require('./common');
const { stripHtml, toAbsoluteUrl } = require('../html-extract');
const { fetchText } = require('../http');

function toMmcaDetailUrl(exhId, baseUrl) {
  if (!exhId) return null;
  const base = baseUrl || 'https://www.mmca.go.kr';
  return `${base.replace(/\/+$/, '')}/exhibitions/exhibitionsDetail.do?exhFlag=1&exhId=${encodeURIComponent(exhId)}`;
}

function normalizeApiItem(item, context) {
  const title = stripHtml(item?.exhTitle || '').slice(0, 200);
  if (!title) return null;

  const detailUrl = toMmcaDetailUrl(item?.exhId, context.baseUrl);
  return {
    sourceSiteKey: context.siteKey,
    sourceExternalId: String(item?.exhId || '').trim() || null,
    title,
    venueName: stripHtml(item?.exhPlaNm || ''),
    startDateRaw: item?.exhStDt || null,
    endDateRaw: item?.exhEdDt || null,
    summary: stripHtml(item?.exhContentsSumm || item?.exhContents || '').slice(0, 1200),
    detailUrl,
    listUrl: context.listUrl || null,
    imageUrl: toAbsoluteUrl(item?.exhThumbImg || item?.exhDidImg || null, context.baseUrl || context.listUrl || ''),
    rawType: 'mmca_api',
    rawPayload: item,
  };
}

async function fetchMmcaAjaxItems(context) {
  const endpoint = new URL('/exhibitions/AjaxExhibitionList.do', context.baseUrl || context.listUrl).toString();
  const form = new URLSearchParams({
    exhFlag: '1',
    searchExhPlaCd: '',
    searchExhCd: '',
    sort: '1',
    pageIndex: '1',
  });

  const response = await fetchText(endpoint, {
    method: 'POST',
    timeoutMs: 20000,
    accept: 'application/json, text/javascript, */*; q=0.01',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: context.listUrl || endpoint,
    },
    body: form.toString(),
  });

  if (!response.ok) {
    throw new Error(`MMCA Ajax 목록 요청 실패 (${response.status} ${response.statusText})`);
  }

  const parsed = JSON.parse(response.text || '{}');
  const exhibitionsList = Array.isArray(parsed?.exhibitionsList) ? parsed.exhibitionsList : [];
  const mapped = exhibitionsList.map((item) => normalizeApiItem(item, context)).filter(Boolean);
  return uniqueByKey(mapped, (item) => `${item.sourceExternalId || ''}::${item.title || ''}`);
}

async function extractListItems(html, context) {
  try {
    const fromAjax = await fetchMmcaAjaxItems(context);
    if (fromAjax.length > 0) return fromAjax;
  } catch (_error) {
    // Fallback to generic HTML extraction when Ajax endpoint is unavailable.
  }

  const generic = extractGeneric(html, context);
  const prioritized = filterByUrlKeywords(generic, ['/exhibitions/', 'exhibitionsdetail', 'progresslist']);
  return prioritized.length > 0 ? prioritized : generic;
}

module.exports = {
  extractListItems,
};
