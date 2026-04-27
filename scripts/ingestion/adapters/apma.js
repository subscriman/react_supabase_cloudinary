const { cleanText, extractGeneric, filterByTitleKeywords, filterByUrlKeywords, uniqueByKey } = require('./common');
const { toAbsoluteUrl } = require('../html-extract');
const { fetchText } = require('../http');

const APMA_BASE_URL = 'https://apma.amorepacific.com';
const APMA_LIST_URL = 'https://apma.amorepacific.com/contents/exhibition/index.do';

function extractPagesJson(listHtml) {
  const matched = listHtml.match(/var\s+pages\s*=\s*(\{[\s\S]*?\});/i);
  if (!matched) return null;
  try {
    return JSON.parse(matched[1]);
  } catch {
    return null;
  }
}

function mapPageContent(item, context) {
  const groupId = String(item?.groupId || item?.id || '').trim();
  if (!groupId) return null;
  const title = cleanText(item?.thumbnailTitle, 200);
  if (!title) return null;
  const start = String(item?.showStartTime || '').trim();
  const end = String(item?.showEndTime || '').trim();
  if (!start || !end) return null;

  return {
    sourceSiteKey: context.siteKey,
    sourceExternalId: groupId,
    title,
    venueName: '아모레퍼시픽미술관',
    startDateRaw: start,
    endDateRaw: end,
    summary: null,
    detailUrl: toAbsoluteUrl(`/contents/exhibition/${encodeURIComponent(groupId)}/view.do`, APMA_BASE_URL),
    listUrl: context.listUrl || null,
    imageUrl: toAbsoluteUrl(item?.thumbnailUri, APMA_BASE_URL),
    rawType: 'apma_pages_json',
    rawPayload: item,
  };
}

function extractFromHtml(listHtml, context) {
  const pages = extractPagesJson(listHtml);
  const content = Array.isArray(pages?.content) ? pages.content : [];
  return content.map((item) => mapPageContent(item, context)).filter(Boolean);
}

async function extractListItems(html, context) {
  const fromHtml = extractFromHtml(html, context);
  if (fromHtml.length > 0) {
    return uniqueByKey(fromHtml, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
  }

  try {
    const response = await fetchText(APMA_LIST_URL, { timeoutMs: 20000 });
    if (response.ok) {
      const fetched = extractFromHtml(response.text, { ...context, listUrl: APMA_LIST_URL });
      if (fetched.length > 0) {
        return uniqueByKey(fetched, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
      }
    }
  } catch (_error) {
    // Continue to generic fallback.
  }

  const generic = extractGeneric(html, context);
  const byUrl = filterByUrlKeywords(generic, ['apma.amorepacific.com', '/exhibitions', '/exhibition']);
  const byTitle = filterByTitleKeywords(byUrl.length > 0 ? byUrl : generic, ['전시', 'exhibition', '아모레', 'apma']);
  if (byTitle.length > 0) return byTitle;
  if (byUrl.length > 0) return byUrl;
  return generic;
}

module.exports = {
  extractListItems,
};
