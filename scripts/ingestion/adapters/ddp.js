const { cleanText, extractGeneric, filterByTitleKeywords, filterByUrlKeywords, parseDateRange, uniqueByKey } = require('./common');
const { toAbsoluteUrl } = require('../html-extract');
const { fetchText } = require('../http');

const DDP_BASE_URL = 'https://ddp.or.kr';
const DDP_EXHIBITION_LIST_URL = 'https://ddp.or.kr/?menuno=240';

function buildFallbackDetailUrl(block) {
  const bbsNo = block.match(/submitForm\(this,'view',(\d+)\)/i)?.[1];
  if (!bbsNo) return null;
  return `${DDP_BASE_URL}/index.html?menuno=240&siteno=2&bbsno=${bbsNo}&boardno=15&bbstopno=${bbsNo}&act=view&subno=1`;
}

function extractCards(listHtml, context) {
  const items = [];
  const blockPattern = /<li>\s*<a href="#none"[\s\S]*?class="sbj title">([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = blockPattern.exec(listHtml)) !== null) {
    const block = match[1] || '';
    if (!block.includes('<strong>')) continue;
    const title = cleanText(block.match(/<strong>([\s\S]*?)<\/strong>/i)?.[1], 200);
    if (!title) continue;
    const dateRaw = cleanText(block.match(/<span>\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2}\s*[~–-]\s*\d{4}[-./]\d{1,2}[-./]\d{1,2})\s*<\/span>/i)?.[1], 120);
    const detailRaw =
      block.match(/<input id="copyurl"[^>]+value="([^"]+)"/i)?.[1] ||
      buildFallbackDetailUrl(block) ||
      '';
    const imageRaw = block.match(/<img class="for_web"[^>]+src="([^"]+)"/i)?.[1] || '';
    const detailUrl = toAbsoluteUrl(detailRaw, DDP_BASE_URL);
    if (!detailUrl) continue;
    const detailParsed = (() => {
      try {
        return new URL(detailUrl);
      } catch {
        return null;
      }
    })();
    const dates = parseDateRange(dateRaw);

    items.push({
      sourceSiteKey: context.siteKey,
      sourceExternalId: detailParsed?.searchParams?.get('bbsno') || null,
      title,
      venueName: 'DDP',
      startDateRaw: dates.startDateRaw,
      endDateRaw: dates.endDateRaw,
      summary: null,
      detailUrl,
      listUrl: context.listUrl || null,
      imageUrl: toAbsoluteUrl(imageRaw, DDP_BASE_URL),
      rawType: 'ddp_exhibition_list',
      rawPayload: {
        dateRaw,
      },
    });
  }
  return items;
}

async function extractListItems(html, context) {
  const fromHtml = extractCards(html, context);
  if (fromHtml.length > 0) {
    return uniqueByKey(fromHtml, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
  }

  try {
    const response = await fetchText(DDP_EXHIBITION_LIST_URL, { timeoutMs: 20000 });
    if (response.ok) {
      const fetched = extractCards(response.text, { ...context, listUrl: DDP_EXHIBITION_LIST_URL });
      if (fetched.length > 0) {
        return uniqueByKey(fetched, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
      }
    }
  } catch (_error) {
    // Continue to generic fallback.
  }

  const generic = extractGeneric(html, context);
  const byUrl = filterByUrlKeywords(generic, ['/exhibition', '/event', 'menu_id=2', 'ddp.or.kr']);
  const byTitle = filterByTitleKeywords(byUrl.length > 0 ? byUrl : generic, [
    '전시',
    'exhibition',
    '아트',
    'art',
    '디자인',
    'design',
  ]);
  if (byTitle.length > 0) return byTitle;
  if (byUrl.length > 0) return byUrl;
  return generic;
}

module.exports = {
  extractListItems,
};
