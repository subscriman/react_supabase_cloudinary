const { cleanText, extractGeneric, filterByTitleKeywords, filterByUrlKeywords, parseDateRange, uniqueByKey } = require('./common');
const { toAbsoluteUrl } = require('../html-extract');
const { fetchText } = require('../http');

const KUKJE_BASE_URL = 'https://www.kukjegallery.com';
const KUKJE_LIST_URL = 'https://www.kukjegallery.com/exhibitions';

function extractCards(listHtml, context) {
  const items = [];
  const itemPattern = /<div class="page-main-list__item">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  let match;
  while ((match = itemPattern.exec(listHtml)) !== null) {
    const block = match[1] || '';
    const detailHref = block.match(/<a class="page-main-list__link" href="([^"]+)"/i)?.[1] || '';
    const title =
      cleanText(block.match(/<span class="page-main-list-artist__exhibition-text">([\s\S]*?)<\/span>/i)?.[1], 200) ||
      cleanText(block.match(/<span class="page-main-list-artist__name-text">([\s\S]*?)<\/span>/i)?.[1], 200);
    if (!title || !detailHref) continue;
    const venue = cleanText(block.match(/<span class="page-main-list-area__title">([\s\S]*?)<\/span>/i)?.[1], 160);
    const dateRaw = cleanText(block.match(/<span class="page-main-list-time">([\s\S]*?)<\/span>/i)?.[1], 120);
    const imageRaw = block.match(/<img class="page-main-list-figure__image" src="([^"]+)"/i)?.[1] || '';
    const detailUrl = toAbsoluteUrl(detailHref, KUKJE_BASE_URL);
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
      sourceExternalId: detailParsed?.searchParams?.get('seq') || null,
      title,
      venueName: venue || '국제갤러리',
      startDateRaw: dates.startDateRaw,
      endDateRaw: dates.endDateRaw,
      summary: null,
      detailUrl,
      listUrl: context.listUrl || null,
      imageUrl: toAbsoluteUrl(imageRaw, KUKJE_BASE_URL),
      rawType: 'kukje_exhibition_list',
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
    const response = await fetchText(KUKJE_LIST_URL, { timeoutMs: 20000 });
    if (response.ok) {
      const fetched = extractCards(response.text, { ...context, listUrl: KUKJE_LIST_URL });
      if (fetched.length > 0) {
        return uniqueByKey(fetched, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
      }
    }
  } catch (_error) {
    // Continue to generic fallback.
  }

  const generic = extractGeneric(html, context);
  const byUrl = filterByUrlKeywords(generic, ['/exhibitions', '/exhibition']);
  const byTitle = filterByTitleKeywords(byUrl.length > 0 ? byUrl : generic, ['전시', 'exhibition', 'artist']);
  if (byTitle.length > 0) return byTitle;
  if (byUrl.length > 0) return byUrl;
  return generic;
}

module.exports = {
  extractListItems,
};
