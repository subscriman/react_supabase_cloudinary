const { cleanText, extractGeneric, filterByTitleKeywords, filterByUrlKeywords, parseDateRange, uniqueByKey } = require('./common');
const { toAbsoluteUrl } = require('../html-extract');

const DAEGU_BASE_URL = 'https://daeguartmuseum.or.kr';
const DAEGU_DETAIL_PATH = '/index.do?menu_id=00000729&menu_link=/front/ehi/ehiViewFront.do';

function buildDetailUrl(sourceExternalId) {
  if (!sourceExternalId) return null;
  const detailPath = `${DAEGU_DETAIL_PATH}&ehi_id=${encodeURIComponent(sourceExternalId)}`;
  return toAbsoluteUrl(detailPath, DAEGU_BASE_URL);
}

function extractCards(listHtml, context) {
  const items = [];
  const cardPattern = /<a\s+href="javascript:fnView\('([^']+)'\);?">([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = cardPattern.exec(listHtml)) !== null) {
    const sourceExternalId = cleanText(match[1], 80);
    const cardHtml = match[2] || '';
    if (!sourceExternalId || !cardHtml) continue;

    const title = cleanText(cardHtml.match(/<span class="item_tit">\s*([\s\S]*?)<\/span>/i)?.[1], 200);
    if (!title) continue;

    const dateRaw = cleanText(cardHtml.match(/<span class="info_date">([\s\S]*?)<\/span>/i)?.[1], 120);
    const venueRaw = cardHtml.match(/<em class="info_tit">\s*장소\s*<\/em>\s*<span>([\s\S]*?)<\/span>/i)?.[1] || '';
    const imageRaw = cardHtml.match(/<img[^>]*?\bsrc=['"]([^'"]+)['"]/i)?.[1] || '';
    const dates = parseDateRange(dateRaw);

    items.push({
      sourceSiteKey: context.siteKey,
      sourceExternalId,
      title,
      venueName: cleanText(venueRaw, 200) || '대구미술관',
      startDateRaw: dates.startDateRaw,
      endDateRaw: dates.endDateRaw,
      summary: null,
      detailUrl: buildDetailUrl(sourceExternalId),
      listUrl: context.listUrl || null,
      imageUrl: toAbsoluteUrl(imageRaw, DAEGU_BASE_URL),
      rawType: 'daegu_current_card',
      rawPayload: {
        dateRaw,
      },
    });
  }

  return uniqueByKey(items, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
}

function extractListItems(html, context) {
  const fromCards = extractCards(html, context);
  if (fromCards.length > 0) return fromCards;

  const generic = extractGeneric(html, context);
  const byUrl = filterByUrlKeywords(generic, ['daeguartmuseum.or.kr', '/exhibitions', '/exhibition', '/archive']);
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
