const { cleanText, extractGeneric, filterByTitleKeywords, filterByUrlKeywords, parseDateRange, uniqueByKey } = require('./common');
const { toAbsoluteUrl } = require('../html-extract');
const { fetchText } = require('../http');

const SEJONG_BASE_URL = 'https://www.sejongpac.or.kr';
const SEJONG_LIST_URL = 'https://www.sejongpac.or.kr/portal/performance/exhibit/performList.do?menuNo=200558';
const SEJONG_DATA_URL =
  'https://www.sejongpac.or.kr/portal/performance/exhibit/performListData.do?viewType=CONTBODY';

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&');
}

function formatDate(value) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractCards(listHtml, context) {
  const items = [];
  const cardPattern = /<li>\s*<a href="([^"]*performTicket\.do[^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi;
  let match;
  while ((match = cardPattern.exec(listHtml)) !== null) {
    const detailHref = match[1] || '';
    const cardHtml = match[2] || '';
    const title = cleanText(cardHtml.match(/<li class="tit">([\s\S]*?)<\/li>/i)?.[1], 200);
    if (!title) continue;
    const dateRaw = cleanText(cardHtml.match(/<li>\s*([\s\S]*?)<\/li>/i)?.[1], 140);
    const venue = cleanText(cardHtml.match(/<li class="flex">\s*<span>\s*([\s\S]*?)\s*<\/span>/i)?.[1], 200);
    const genre = cleanText(
      cardHtml.match(/<li class="flex">\s*<span>[\s\S]*?<\/span>\s*<span>\s*([\s\S]*?)\s*<\/span>/i)?.[1],
      80,
    );
    if (genre && !genre.includes('전시')) continue;
    const imageRaw = decodeHtmlEntities(cardHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1] || '');
    const detailUrl = toAbsoluteUrl(detailHref, SEJONG_BASE_URL);
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
      sourceExternalId: detailParsed?.searchParams?.get('performIdx') || null,
      title,
      venueName: venue || '세종문화회관',
      startDateRaw: dates.startDateRaw,
      endDateRaw: dates.endDateRaw,
      summary: genre || null,
      detailUrl,
      listUrl: context.listUrl || null,
      imageUrl: toAbsoluteUrl(imageRaw, SEJONG_BASE_URL),
      rawType: 'sejong_exhibit_list',
      rawPayload: {
        dateRaw,
        genre: genre || null,
      },
    });
  }
  return items;
}

async function fetchSejongDataList() {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
  const form = new URLSearchParams({
    pageIndex: '1',
    menuNo: '200558',
    searchPackage: '',
    searchSort: '1',
    nowCheck: formatDate(today),
    listType: '1',
    sdate: formatDate(today),
    edate: formatDate(end),
    searchCnd: '1',
    searchWrd: '',
    searchGenreCdData: '',
  });

  const response = await fetchText(SEJONG_DATA_URL, {
    method: 'POST',
    timeoutMs: 20000,
    accept: 'text/html, */*; q=0.1',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: SEJONG_LIST_URL,
    },
    body: form.toString(),
  });
  if (!response.ok) {
    throw new Error(`세종 목록 데이터 요청 실패 (${response.status} ${response.statusText})`);
  }
  return response.text;
}

async function extractListItems(html, context) {
  const fromHtml = extractCards(html, context);
  if (fromHtml.length > 0) {
    return uniqueByKey(fromHtml, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
  }

  try {
    const listHtml = await fetchSejongDataList();
    const fetched = extractCards(listHtml, { ...context, listUrl: SEJONG_LIST_URL });
    if (fetched.length > 0) {
      return uniqueByKey(fetched, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
    }
  } catch (_error) {
    // Continue to generic fallback.
  }

  const generic = extractGeneric(html, context);
  const byUrl = filterByUrlKeywords(generic, ['/portal/program/exhibition', '/submain/exhibition', 'sejongpac.or.kr']);
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
