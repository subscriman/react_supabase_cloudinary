const {
  cleanText,
  extractGeneric,
  filterByUrlKeywords,
  normalizeDateToken,
  parseDateRange,
  uniqueByKey,
} = require('./common');
const { toAbsoluteUrl } = require('../html-extract');
const { fetchText } = require('../http');

const SEMA_BASE_URL = 'https://sema.seoul.go.kr';
const SEMA_LIST_URLS = [
  'https://sema.seoul.go.kr/kr/whatson/landing?whatsonMenuDivList=EX&whatChoice2=N&whatChoice3=N&whatChoice4=N&whatChoice5=N&whenType=FROM_TODAY',
  'https://sema.seoul.go.kr/kr/whatson/landing?whatsonMenuDivList=EX&whatChoice2=N&whatChoice3=N&whatChoice4=N&whatChoice5=N&whenType=PLAN_DAY',
];

function parseVenueText(raw) {
  const cleaned = cleanText(raw, 300);
  if (!cleaned) return '서울시립미술관';
  const tokens = cleaned
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens[0] || cleaned;
}

function extractCards(listHtml, context) {
  const items = [];
  const cardPattern =
    /<div id="dv_(\d+)" class="[^"]*viewLink[^"]*"[\s\S]*?<a href="javascript:;" class="o_figure">([\s\S]*?)<\/a>\s*<\/div>/gi;
  let match;
  while ((match = cardPattern.exec(listHtml)) !== null) {
    const exNo = String(match[1] || '').trim();
    const cardHtml = match[2] || '';
    if (!exNo) continue;

    const title = cleanText(cardHtml.match(/<strong class="o_h1">([\s\S]*?)<\/strong>/i)?.[1], 200);
    if (!title) continue;
    const venueRaw = cardHtml.match(/<span class="o_h2 epEcPlaceNm[^"]*">([\s\S]*?)<\/span>/i)?.[1] || '';
    const dateRaw = cardHtml.match(/<span class="o_h3">([\s\S]*?)<\/span>/i)?.[1] || '';
    const imageRaw = cardHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1] || '';
    const dates = parseDateRange(dateRaw);
    const detailUrl = toAbsoluteUrl(`/kr/whatson/exhibition/detail?exNo=${encodeURIComponent(exNo)}`, SEMA_BASE_URL);

    items.push({
      sourceSiteKey: context.siteKey,
      sourceExternalId: exNo,
      title,
      venueName: parseVenueText(venueRaw),
      startDateRaw: dates.startDateRaw,
      endDateRaw: dates.endDateRaw,
      summary: null,
      detailUrl,
      listUrl: context.listUrl || null,
      imageUrl: toAbsoluteUrl(imageRaw, SEMA_BASE_URL),
      rawType: 'sema_list_card',
      rawPayload: {
        exNo,
        venueRaw,
        dateRaw: cleanText(dateRaw, 200),
      },
    });
  }
  return items;
}

function parseCompactYmd(value) {
  const matched = String(value || '').match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!matched) return null;
  return `${matched[1]}-${matched[2]}-${matched[3]}`;
}

function extractAlwaysOnDatesFromDetail(detailHtml) {
  const endCompact = detailHtml.match(/id="exEnddtVal"[^>]*value="(\d{8})"/i)?.[1] || '';
  const endDateRaw = normalizeDateToken(parseCompactYmd(endCompact));
  if (!endDateRaw) return { startDateRaw: null, endDateRaw: null };

  const koreanStart = detailHtml.match(/(\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일)\s*개막/i)?.[1] || '';
  const numericStart = detailHtml.match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2})\s*(개막|오픈|open)?/i)?.[1] || '';
  const startDateRaw = normalizeDateToken(koreanStart || numericStart) || endDateRaw;

  return {
    startDateRaw,
    endDateRaw,
  };
}

async function enrichAlwaysOnDates(items) {
  const output = [];
  for (const item of items) {
    const hasDate = Boolean(item.startDateRaw && item.endDateRaw);
    const dateRaw = cleanText(item?.rawPayload?.dateRaw, 120);
    const isAlwaysOn = dateRaw.includes('상시');
    if (hasDate || !isAlwaysOn || !item.detailUrl) {
      output.push(item);
      continue;
    }

    try {
      const response = await fetchText(item.detailUrl, { timeoutMs: 20000 });
      if (!response.ok) {
        output.push(item);
        continue;
      }
      const extracted = extractAlwaysOnDatesFromDetail(response.text);
      output.push({
        ...item,
        startDateRaw: item.startDateRaw || extracted.startDateRaw,
        endDateRaw: item.endDateRaw || extracted.endDateRaw,
        rawPayload: {
          ...(item.rawPayload || {}),
          alwaysOnDateEnriched: true,
          alwaysOnStartDateRaw: extracted.startDateRaw,
          alwaysOnEndDateRaw: extracted.endDateRaw,
        },
      });
    } catch (_error) {
      output.push(item);
    }
  }
  return output;
}

async function fetchSemalists(context) {
  const fetched = [];
  for (const url of SEMA_LIST_URLS) {
    try {
      const response = await fetchText(url, { timeoutMs: 20000 });
      if (!response.ok) continue;
      fetched.push(...extractCards(response.text, { ...context, listUrl: url }));
    } catch (_error) {
      // Continue to next URL.
    }
  }
  return fetched;
}

async function extractListItems(html, context) {
  const fromHtml = await enrichAlwaysOnDates(extractCards(html, context));
  if (fromHtml.length >= 2) {
    return uniqueByKey(fromHtml, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
  }

  const fromUrls = await enrichAlwaysOnDates(await fetchSemalists(context));
  if (fromUrls.length > 0) {
    return uniqueByKey(fromUrls, (item) => item.sourceExternalId || `${item.title}::${item.detailUrl || ''}`);
  }

  const generic = extractGeneric(html, context);
  const prioritized = filterByUrlKeywords(generic, ['/whatson/', '/exhibition/', '/kr/whatson/']);
  return prioritized.length > 0 ? prioritized : generic;
}

module.exports = {
  extractListItems,
};
