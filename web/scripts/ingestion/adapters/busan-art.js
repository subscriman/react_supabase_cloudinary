const { cleanText, extractGeneric, filterByTitleKeywords, filterByUrlKeywords, parseDateRange, uniqueByKey } = require('./common');
const { toAbsoluteUrl } = require('../html-extract');
const { fetchText } = require('../http');

const BUSAN_BASE_URL = 'https://art.busan.go.kr';
const BUSAN_LIST_PATHS = ['/tblTsite07Display/listNowClient.nm', '/tblTsite07Display/listFutureClient.nm'];

function extractCards(listHtml, context) {
  const items = [];
  const itemPattern = /<li>\s*<div class="thumb_img">([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = itemPattern.exec(listHtml)) !== null) {
    const block = match[1] || '';
    const detailHref = block.match(/<a href="([^"]*view(?:Now|Future)Client\.nm\?id=[^"]+)"/i)?.[1] || '';
    const titleRaw = block.match(/<span class="tit">\s*<a [^>]*>([\s\S]*?)<\/a>\s*<\/span>/i)?.[1] || '';
    const dateRaw = block.match(/<span class="date">([\s\S]*?)<\/span>/i)?.[1] || '';
    const imageRaw = block.match(/<img[^>]+src="([^"]+)"/i)?.[1] || '';
    const title = cleanText(titleRaw, 200);
    if (!title || !detailHref) continue;
    const detailUrl = toAbsoluteUrl(detailHref, BUSAN_BASE_URL);
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
      sourceExternalId: detailParsed?.searchParams?.get('id') || null,
      title,
      venueName: '부산시립미술관',
      startDateRaw: dates.startDateRaw,
      endDateRaw: dates.endDateRaw,
      summary: null,
      detailUrl,
      listUrl: context.listUrl || null,
      imageUrl: toAbsoluteUrl(imageRaw, BUSAN_BASE_URL),
      rawType: 'busan_art_list',
      rawPayload: {
        dateRaw: cleanText(dateRaw, 120),
      },
    });
  }
  return items;
}

async function fetchBusanLists(context) {
  const out = [];
  for (const path of BUSAN_LIST_PATHS) {
    const url = toAbsoluteUrl(path, BUSAN_BASE_URL);
    if (!url) continue;
    try {
      const response = await fetchText(url, { timeoutMs: 20000 });
      if (!response.ok) continue;
      out.push(...extractCards(response.text, { ...context, listUrl: url }));
    } catch (_error) {
      // Ignore one endpoint failure.
    }
  }
  return out;
}

async function extractListItems(html, context) {
  const fromHtml = extractCards(html, context);
  if (fromHtml.length >= 1) {
    return uniqueByKey(fromHtml, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
  }

  const fetched = await fetchBusanLists(context);
  if (fetched.length > 0) {
    return uniqueByKey(fetched, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
  }

  const generic = extractGeneric(html, context);
  const byUrl = filterByUrlKeywords(generic, ['art.busan.go.kr', 'menucd=', '/index.nm', '/board/']);
  const byTitle = filterByTitleKeywords(byUrl.length > 0 ? byUrl : generic, [
    '전시',
    '기획전',
    '특별전',
    'exhibition',
  ]);
  if (byTitle.length > 0) return byTitle;
  if (byUrl.length > 0) return byUrl;
  return generic;
}

module.exports = {
  extractListItems,
};
