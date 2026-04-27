const { cleanText, extractGeneric, filterByUrlKeywords, parseDateRange, uniqueByKey } = require('./common');
const { toAbsoluteUrl } = require('../html-extract');
const { fetchText } = require('../http');

const MUSEUM_BASE_URL = 'https://www.museum.go.kr';
const MUSEUM_CURRENT_URL = 'https://www.museum.go.kr/MUSEUM/contents/M0202010000.do?menuId=current';
const MUSEUM_UPCOMING_URL = 'https://www.museum.go.kr/MUSEUM/contents/M0202020000.do?menuId=upcomming';

function parseMuseumCards(html, context, sourceListUrl) {
  const items = [];
  const listUrl = sourceListUrl || context.listUrl || MUSEUM_CURRENT_URL;
  const cardPattern = /<li>\s*<div class="img-box">[\s\S]*?<\/li>/gi;
  let match;
  while ((match = cardPattern.exec(html)) !== null) {
    const block = match[0] || '';
    const title = cleanText(block.match(/<strong>\s*([\s\S]*?)\s*<\/strong>/i)?.[1], 200);
    if (!title) continue;

    const hrefRaw =
      block.match(/<a href="([^"]*exhiSpThemId=\d+[^"]*)"/i)?.[1] ||
      block.match(/<a href="([^"]*schM=view[^"]*)"/i)?.[1] ||
      '';
    const detailUrl = toAbsoluteUrl(hrefRaw, listUrl);
    let sourceExternalId = null;
    if (detailUrl) {
      try {
        sourceExternalId = new URL(detailUrl).searchParams.get('exhiSpThemId');
      } catch {
        sourceExternalId = null;
      }
    }

    const periodRaw = cleanText(
      block.match(/<li>\s*<strong>\s*기간\s*<\/strong>\s*<p>\s*([\s\S]*?)\s*<\/p>/i)?.[1],
      120,
    );
    const venue = cleanText(
      block.match(/<li>\s*<strong>\s*장소\s*<\/strong>\s*<p>\s*([\s\S]*?)\s*<\/p>/i)?.[1],
      200,
    );
    const imageRaw = block.match(/<img[^>]+src="([^"]+)"/i)?.[1] || '';
    const dates = parseDateRange(periodRaw);

    items.push({
      sourceSiteKey: context.siteKey,
      sourceExternalId: sourceExternalId || `${title}:${dates.startDateRaw || ''}:${dates.endDateRaw || ''}`,
      title,
      venueName: venue || '국립중앙박물관',
      startDateRaw: dates.startDateRaw,
      endDateRaw: dates.endDateRaw,
      summary: null,
      detailUrl: detailUrl || listUrl,
      listUrl,
      imageUrl: toAbsoluteUrl(imageRaw, MUSEUM_BASE_URL),
      rawType: 'museum_special_list',
      rawPayload: {
        periodRaw,
      },
    });
  }
  return items;
}

async function extractListItems(html, context) {
  const items = [];
  const listCandidates = Array.from(new Set([context.listUrl || MUSEUM_CURRENT_URL, MUSEUM_CURRENT_URL, MUSEUM_UPCOMING_URL]));

  items.push(...parseMuseumCards(html, context, context.listUrl || MUSEUM_CURRENT_URL));

  for (const url of listCandidates) {
    if (url === context.listUrl) continue;
    try {
      const response = await fetchText(url, { timeoutMs: 20000 });
      if (!response.ok) continue;
      items.push(...parseMuseumCards(response.text, context, url));
    } catch {
      // Ignore candidate errors and continue with available rows.
    }
  }

  const byCard = uniqueByKey(items, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
  if (byCard.length > 0) return byCard;

  const generic = extractGeneric(html, context);
  const prioritized = filterByUrlKeywords(generic, ['/MUSEUM/contents/M02020', 'exhiSpThemId', 'menuId=current']);
  return prioritized.length > 0 ? prioritized : generic;
}

module.exports = {
  extractListItems,
};
