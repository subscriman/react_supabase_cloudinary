const { uniqueByKey } = require('./common');
const { stripHtml, toAbsoluteUrl } = require('../html-extract');
const { fetchText } = require('../http');

const SAC_BASE_URL = 'https://www.sac.or.kr';
const SAC_CALENDAR_ENDPOINT = 'https://www.sac.or.kr/site/main/program/getProgramCalList';
const EXHIBITION_VENUE_HINTS = [
  '한가람미술관',
  '한가람디자인미술관',
  '서울서예박물관',
  '비타민스테이션',
  '미술관',
  '박물관',
];

function isExhibitionProgram(item) {
  const place = stripHtml(item?.PLACE_NAME || '').toLowerCase();
  const category = stripHtml(item?.CATEGORY_PRIMARY_NAME || '').toLowerCase();
  const secondary = stripHtml(item?.CATEGORY_SECONDARY_NAME || '').toLowerCase();
  if (EXHIBITION_VENUE_HINTS.some((hint) => place.includes(hint.toLowerCase()))) return true;
  if (secondary.includes('전시') || secondary.includes('exhibition')) return true;
  return category.includes('미술관') || category.includes('박물관');
}

function mapProgramItem(item, context) {
  const title = stripHtml(item?.PROGRAM_SUBJECT || '').slice(0, 200);
  if (!title) return null;
  const sourceExternalId = String(item?.SN || '').trim();
  if (!sourceExternalId) return null;
  if (!isExhibitionProgram(item)) return null;

  return {
    sourceSiteKey: context.siteKey,
    sourceExternalId,
    title,
    venueName: stripHtml(item?.PLACE_NAME || '').slice(0, 200) || '예술의전당',
    startDateRaw: stripHtml(item?.BEGIN_DATE || ''),
    endDateRaw: stripHtml(item?.END_DATE || ''),
    summary: stripHtml(item?.PROGRAM_PLAYTIME || item?.PBLPRFR_PERIOD || '').slice(0, 800) || null,
    detailUrl: toAbsoluteUrl(`/site/main/show/show_view?SN=${sourceExternalId}`, SAC_BASE_URL),
    listUrl: context.listUrl || null,
    imageUrl: null,
    rawType: 'sac_calendar_api',
    rawPayload: item,
  };
}

function monthWindow(offset = 0) {
  const pivot = new Date();
  const date = new Date(pivot.getFullYear(), pivot.getMonth() + offset, 1);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return { year, month, firstDay: 1, lastDay };
}

async function fetchCalendarBucket(window, categoryPrimary) {
  const body = new URLSearchParams({
    searchYear: String(window.year),
    searchMonth: String(window.month),
    searchFirstDay: String(window.firstDay),
    searchLastDay: String(window.lastDay),
    CATEGORY_PRIMARY: String(categoryPrimary),
  });

  const response = await fetchText(SAC_CALENDAR_ENDPOINT, {
    method: 'POST',
    timeoutMs: 20000,
    accept: 'application/json, text/javascript, */*; q=0.01',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://www.sac.or.kr/site/main/program/schedule?tab=3',
    },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`SAC 일정 API 요청 실패 (${response.status} ${response.statusText})`);
  }

  const parsed = JSON.parse(response.text || '{}');
  const rows = [];
  for (const value of Object.values(parsed)) {
    if (Array.isArray(value)) rows.push(...value);
  }
  return rows;
}

async function fetchSacPrograms(context) {
  const items = [];
  const monthOffsets = [0, 1, 2, 3, 4, 5];
  // schedule?tab=3(미술관·박물관)은 CATEGORY_PRIMARY=6 을 사용한다.
  const categories = [6];
  for (const offset of monthOffsets) {
    const window = monthWindow(offset);
    for (const category of categories) {
      try {
        const rows = await fetchCalendarBucket(window, category);
        items.push(...rows.map((row) => mapProgramItem(row, context)).filter(Boolean));
      } catch (_error) {
        // Ignore each bucket failure and continue with other categories/months.
      }
    }
  }
  return uniqueByKey(items, (item) => item.sourceExternalId || `${item.title}::${item.startDateRaw || ''}`);
}

async function extractListItems(html, context) {
  const apiItems = await fetchSacPrograms(context);
  if (apiItems.length > 0) return apiItems;
  return [];
}

module.exports = {
  extractListItems,
};
