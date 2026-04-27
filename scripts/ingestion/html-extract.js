function decodeHtmlEntities(input) {
  if (!input) return '';
  return String(input)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(input) {
  return decodeHtmlEntities(String(input || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function toAbsoluteUrl(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function sourceExternalIdFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const idParam = parsed.searchParams.get('id') || parsed.searchParams.get('seq') || parsed.searchParams.get('no');
    if (idParam && idParam.trim()) return idParam.trim();

    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments.at(-1) || '';
    if (!last) return null;
    return last.replace(/\.[a-zA-Z0-9]+$/, '') || null;
  } catch {
    return null;
  }
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function extractJsonLdItems(html) {
  const scripts = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    scripts.push(match[1]);
  }

  const events = [];
  for (const block of scripts) {
    try {
      const parsed = JSON.parse(block.trim());
      const items = toArray(parsed).flatMap((entry) => {
        if (entry && Array.isArray(entry['@graph'])) return entry['@graph'];
        return [entry];
      });
      for (const item of items) {
        const types = toArray(item?.['@type']).map((value) => String(value || '').toLowerCase());
        if (!types.includes('event') && !types.includes('exhibition')) continue;
        events.push(item);
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return events;
}

function sanitizeTitle(title) {
  const cleaned = stripHtml(title);
  if (!cleaned) return null;
  if (cleaned.length < 3) return null;
  if (/^(home|menu|login|more|자세히|상세|전체보기)$/i.test(cleaned)) return null;
  return cleaned.slice(0, 200);
}

function extractRawItemsFromHtml(html, options) {
  const sourceItems = [];
  const seen = new Set();
  const baseUrl = options?.baseUrl || options?.listUrl || '';

  const jsonLdEvents = extractJsonLdItems(html);
  for (const event of jsonLdEvents) {
    const title = sanitizeTitle(event?.name);
    const detailUrl = toAbsoluteUrl(event?.url, baseUrl);
    if (!title) continue;

    const key = `${title}::${detailUrl || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const location = event?.location?.name || event?.location?.address?.streetAddress || null;
    const image = Array.isArray(event?.image) ? event.image[0] : event?.image;
    sourceItems.push({
      sourceSiteKey: options.siteKey,
      sourceExternalId: sourceExternalIdFromUrl(detailUrl),
      title,
      venueName: stripHtml(location || ''),
      startDateRaw: event?.startDate || null,
      endDateRaw: event?.endDate || null,
      summary: stripHtml(event?.description || ''),
      detailUrl,
      listUrl: options.listUrl || null,
      imageUrl: toAbsoluteUrl(image, baseUrl),
      rawType: 'jsonld',
      rawPayload: event,
    });
  }

  const anchorPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let anchorMatch;
  while ((anchorMatch = anchorPattern.exec(html)) !== null) {
    const href = anchorMatch[1];
    const linkText = sanitizeTitle(anchorMatch[2]);
    if (!linkText) continue;

    if (!/[가-힣a-zA-Z]/.test(linkText)) continue;
    if (linkText.length > 120) continue;

    const detailUrl = toAbsoluteUrl(href, baseUrl);
    if (!detailUrl) continue;

    if (detailUrl.includes('#') || detailUrl.startsWith('javascript:')) continue;

    const key = `${linkText}::${detailUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);

    sourceItems.push({
      sourceSiteKey: options.siteKey,
      sourceExternalId: sourceExternalIdFromUrl(detailUrl),
      title: linkText,
      venueName: null,
      startDateRaw: null,
      endDateRaw: null,
      summary: null,
      detailUrl,
      listUrl: options.listUrl || null,
      imageUrl: null,
      rawType: 'anchor',
      rawPayload: {
        href,
        text: linkText,
      },
    });
  }

  return sourceItems;
}

module.exports = {
  extractRawItemsFromHtml,
  stripHtml,
  toAbsoluteUrl,
};
