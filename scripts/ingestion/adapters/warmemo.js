const { cleanText, extractGeneric, filterByTitleKeywords, filterByUrlKeywords, parseDateRange, uniqueByKey } = require('./common');
const { toAbsoluteUrl } = require('../html-extract');
const { fetchText } = require('../http');

const WARMEMO_BASE_URL = 'https://www.warmemo.or.kr:8443/Home/H20000/H20200/';
const WARMEMO_LIST_URL = 'https://www.warmemo.or.kr:8443/Home/H20000/H20200/boardList';

function extractCards(listHtml, context) {
  const items = [];
  const boardPattern = /<div class="m-board">([\s\S]*?)<\/div>\s*<\/div>\s*<\/a>\s*<\/div>/gi;
  let match;
  while ((match = boardPattern.exec(listHtml)) !== null) {
    const block = match[1] || '';
    if (block.includes('state_fin')) continue;
    const href = block.match(/<a href="([^"]*boardView\?[^"]+)"/i)?.[1] || '';
    const title = cleanText(block.match(/<div class="m-board-title">\s*([\s\S]*?)\s*<\/div>/i)?.[1], 200);
    if (!title || !href) continue;
    const dateRaw = cleanText(block.match(/<div class="m-info date">\s*([\s\S]*?)<\/div>/i)?.[1], 120);
    const place = cleanText(block.match(/<div class="m-info place">\s*([\s\S]*?)<\/div>/i)?.[1], 200);
    const imageRaw = block.match(/<img[^>]+src="([^"]+)"/i)?.[1] || '';
    const detailUrl = toAbsoluteUrl(href, WARMEMO_BASE_URL);
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
      sourceExternalId: detailParsed?.searchParams?.get('board_key') || null,
      title,
      venueName: place || '전쟁기념관',
      startDateRaw: dates.startDateRaw,
      endDateRaw: dates.endDateRaw,
      summary: null,
      detailUrl,
      listUrl: context.listUrl || null,
      imageUrl: toAbsoluteUrl(imageRaw, WARMEMO_BASE_URL),
      rawType: 'warmemo_board',
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
    const response = await fetchText(WARMEMO_LIST_URL, {
      timeoutMs: 20000,
      insecureTls: true,
    });
    if (response.ok) {
      const fetched = extractCards(response.text, { ...context, listUrl: WARMEMO_LIST_URL });
      if (fetched.length > 0) {
        return uniqueByKey(fetched, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
      }
    }
  } catch (_error) {
    // Continue to generic fallback.
  }

  const generic = extractGeneric(html, context);
  const byUrl = filterByUrlKeywords(generic, ['warmemo.or.kr', '/h20200/', 'boardview', 'boardlist']);
  const byTitle = filterByTitleKeywords(byUrl.length > 0 ? byUrl : generic, [
    '전시',
    '기획전',
    '특별전',
    '기획',
    'special',
    'exhibition',
  ]);
  if (byTitle.length > 0) return byTitle;
  if (byUrl.length > 0) return byUrl;
  return generic;
}

module.exports = {
  extractListItems,
};
