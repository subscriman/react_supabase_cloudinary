const { fetchText } = require('./http');
const { stripHtml, toAbsoluteUrl } = require('./html-extract');

function extractMetaDescription(html) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (!match) return null;
  return stripHtml(match[1]).slice(0, 1200) || null;
}

function extractBodyExcerpt(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const source = bodyMatch ? bodyMatch[1] : html;
  const cleaned = stripHtml(source);
  if (!cleaned) return null;
  return cleaned.slice(0, 1600);
}

function uniqueImageUrls(urls, limit = 8) {
  const seen = new Set();
  const picked = [];
  for (const raw of urls || []) {
    const value = String(raw || '').trim();
    if (!value) continue;
    if (!/^https?:\/\//i.test(value)) continue;
    if (isPlaceholderImageUrl(value)) continue;
    const dedupeKey = (() => {
      try {
        const parsed = new URL(value);
        return `${parsed.hostname.toLowerCase()}${parsed.pathname}${parsed.search}`;
      } catch {
        return value;
      }
    })();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    picked.push(value);
    if (picked.length >= limit) break;
  }
  return picked;
}

function isPlaceholderImageUrl(url) {
  const value = String(url || '').toLowerCase();
  if (!value) return true;
  if (value.includes('/noimage/')) return true;
  if (/\/noimage(?:[._/?-]|$)/i.test(value)) return true;
  if (value.includes('/images/common/logo')) return true;
  if (value.includes('/design/common/images/asset/noimage')) return true;
  if (value.includes('/cmsh/') && value.includes('/images/common/')) return true;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (host.includes('sac.or.kr')) {
      if (path.startsWith('/design/theme/sac/images/logo')) return true;
      if (path.startsWith('/design/common/images/asset/noimage')) return true;
      if (path.startsWith('/design/theme/sac/images/sub/')) return true;
    }
    if (host.includes('museum.go.kr')) {
      if (path.startsWith('/museum/api/qrcode.do')) return true;
      if (path.startsWith('/ux/content/images/common/')) return true;
      if (path.startsWith('/ux/content/images/common/btn/')) return true;
      if (path.startsWith('/images/common/btn/')) return true;
      if (path.startsWith('/design/common/images/')) return true;
      if (path.startsWith('/design/content/museum/images/')) return true;
    }
    if (host.includes('mmca.go.kr')) {
      if (path.startsWith('/asset/images/common/')) return true;
      if (path.startsWith('/asset/images/@dummy/')) return true;
      if (path.startsWith('/images/common/noimage')) return true;
    }
    if (host.includes('leeumhoam.org')) {
      if (path.startsWith('/img/')) return true;
    }
    if (host.includes('sejongpac.or.kr')) {
      if (path.startsWith('/static/portal/img/main/logo-footer')) return true;
      if (path.startsWith('/static/portal/img/common/')) return true;
      if (path.startsWith('/static/portal/img/layout/')) return true;
      if (path.startsWith('/portal/captcha/image.do')) return true;
    }
    if (host.includes('sema.seoul.go.kr')) {
      if (/^\/resources\/content\/(?:1x1|2x3|3x2|16x9)\.(?:jpg|jpeg|png|gif)$/i.test(path)) return true;
      if (path.startsWith('/resources/content/noimage')) return true;
      if (path.startsWith('/resources/images/common/noimg')) return true;
      if (path === '/common/imgfileview') {
        const fileId = String(parsed.searchParams.get('file_id') || parsed.searchParams.get('FILE_ID') || '').trim();
        if (!/^\d+$/.test(fileId)) return true;
      }
    }
  } catch {
    // noop
  }
  return false;
}

function extractMetaImageUrls(html, baseUrl) {
  const urls = [];
  const pattern = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    urls.push(toAbsoluteUrl(match[1], baseUrl));
  }
  return uniqueImageUrls(urls, 4);
}

function extractInlineImageUrls(html, baseUrl) {
  const urls = [];
  const pattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const absolute = toAbsoluteUrl(match[1], baseUrl);
    if (!absolute) continue;
    if (/(\.svg)(\?|$)/i.test(absolute)) continue;
    urls.push(absolute);
  }
  return uniqueImageUrls(urls, 12);
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function normalizeCssUrlToken(value) {
  const decoded = decodeHtmlEntities(value).trim();
  return decoded.replace(/^['"]+|['"]+$/g, '').trim();
}

function findFirstTagIndexByClass(html, className) {
  if (!html || !className) return -1;
  const escaped = String(className).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<[^>]+class=["'][^"']*\\b${escaped}\\b[^"']*["']`, 'i');
  return html.search(pattern);
}

function extractClassSectionHtml(html, className, fallbackLength = 10000) {
  const index = findFirstTagIndexByClass(html, className);
  if (index < 0) return '';
  return html.slice(index, index + fallbackLength);
}

function extractFirstImageUrlNearClass(html, className, baseUrl) {
  const chunk = extractClassSectionHtml(html, className, 12000);
  if (!chunk) return null;
  const match = chunk.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (!match?.[1]) return null;
  const absolute = toAbsoluteUrl(decodeHtmlEntities(match[1]), baseUrl);
  if (!absolute) return null;
  if (/(\.svg)(\?|$)/i.test(absolute)) return null;
  if (isPlaceholderImageUrl(absolute)) return null;
  return absolute;
}

function extractDdpDetailInnerHtml(html) {
  const sectionStart = findFirstTagIndexByClass(html, 'detail_cont_inner');
  if (sectionStart < 0) return '';
  const nextChunk = html.slice(sectionStart);
  const endIndexInChunk = findFirstTagIndexByClass(nextChunk, 'detail_cont_btm');
  const section = endIndexInChunk > 0 ? nextChunk.slice(0, endIndexInChunk) : nextChunk.slice(0, 120000);
  const blocks = [];
  const pattern = /<div[^>]+class=["'][^"']*\bdetail_cont_each_txt\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = pattern.exec(section)) !== null) {
    blocks.push(match[1] || '');
  }
  if (blocks.length > 0) return blocks.join('\n');
  return section;
}

function extractImageUrlFromTag(tagHtml, baseUrl) {
  if (/\sclass\s*=\s*["'][^"']*\bimgBg\b[^"']*["']/i.test(String(tagHtml || ''))) return null;
  const dataSaved = tagHtml.match(/\sdata-cke-saved-src\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  const src = tagHtml.match(/\ssrc\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  const picked = decodeHtmlEntities(dataSaved || src);
  if (!picked) return null;
  const absolute = toAbsoluteUrl(picked, baseUrl);
  if (!absolute) return null;
  if (/(\.svg)(\?|$)/i.test(absolute)) return null;
  if (isPlaceholderImageUrl(absolute)) return null;
  return absolute;
}

function normalizeExtractedText(htmlFragment) {
  const withBreaks = String(htmlFragment || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<\/\s*div\s*>/gi, '\n')
    .replace(/<\/\s*h[1-6]\s*>/gi, '\n')
    .replace(/<\/\s*ul\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const decoded = decodeHtmlEntities(withBreaks)
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
  const lines = decoded
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.join('\n').trim();
}

function extractOrderedContentBlocks(htmlFragment, baseUrl) {
  const blocks = [];
  const seenImages = new Set();
  const pattern = /<img\b[^>]*>/gi;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(htmlFragment)) !== null) {
    const textChunk = htmlFragment.slice(lastIndex, match.index);
    const text = normalizeExtractedText(textChunk);
    if (text) {
      blocks.push({ type: 'text', value: text });
    }

    const imageUrl = extractImageUrlFromTag(match[0], baseUrl);
    if (imageUrl) {
      const key = (() => {
        try {
          const parsed = new URL(imageUrl);
          return `${parsed.hostname.toLowerCase()}${parsed.pathname}${parsed.search}`;
        } catch {
          return imageUrl;
        }
      })();
      if (!seenImages.has(key)) {
        seenImages.add(key);
        blocks.push({ type: 'image', value: imageUrl });
      }
    }
    lastIndex = match.index + match[0].length;
  }

  const tail = normalizeExtractedText(htmlFragment.slice(lastIndex));
  if (tail) {
    blocks.push({ type: 'text', value: tail });
  }
  return blocks;
}

function buildDescriptionMarkdown(blocks) {
  const lines = [];
  for (const block of blocks || []) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'text') {
      const text = String(block.value || '').trim();
      if (text) lines.push(text);
      continue;
    }
    if (block.type === 'image') {
      const imageUrl = String(block.value || '').trim();
      if (imageUrl) lines.push(`![상세 이미지](${imageUrl})`);
    }
  }
  return lines.join('\n\n').trim() || null;
}

function stripNonContentHtml(htmlFragment) {
  return String(htmlFragment || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<input\b[^>]*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function stripElementsByClass(htmlFragment, classNames) {
  let next = String(htmlFragment || '');
  for (const className of classNames || []) {
    const escaped = String(className || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escaped) continue;
    const pairedPattern = new RegExp(
      `<([a-z][a-z0-9:-]*)\\b[^>]*class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`,
      'gi',
    );
    const selfClosingPattern = new RegExp(
      `<[a-z][a-z0-9:-]*\\b[^>]*class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*\\/?>`,
      'gi',
    );
    next = next.replace(pairedPattern, ' ').replace(selfClosingPattern, ' ');
  }
  return next;
}

function extractSectionHtmlBetweenIds(html, startId, endId, maxLength = 220000) {
  const source = String(html || '');
  if (!source || !startId || !endId) return '';
  const startPattern = new RegExp(`id=["']${String(startId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
  const endPattern = new RegExp(`id=["']${String(endId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
  const startMatch = startPattern.exec(source);
  if (!startMatch || typeof startMatch.index !== 'number') return '';
  const startIndex = startMatch.index;
  const containerStart = source.lastIndexOf('<div', startIndex);
  const from = containerStart >= 0 ? containerStart : startIndex;
  const endSearchBase = source.slice(startIndex);
  const endMatch = endPattern.exec(endSearchBase);
  const to = endMatch && typeof endMatch.index === 'number' ? startIndex + endMatch.index : source.length;
  return source.slice(from, Math.min(to, from + maxLength));
}

function extractDdpDetailContext(html, baseUrl) {
  const posterImageUrl = extractFirstImageUrlNearClass(html, 'detail_cont_tbg', baseUrl) || null;
  const detailInnerHtml = extractDdpDetailInnerHtml(html) || extractClassSectionHtml(html, 'sub_cont_inner', 120000);
  if (!detailInnerHtml) {
    return {
      posterImageUrl,
      contentImageUrls: [],
      descriptionMarkdown: null,
      textExcerpt: null,
      contentBlocks: [],
    };
  }

  const orderedBlocks = extractOrderedContentBlocks(detailInnerHtml, baseUrl);
  const contentImageUrls = uniqueImageUrls(
    orderedBlocks.filter((block) => block.type === 'image').map((block) => block.value),
    12,
  );
  const textExcerpt = orderedBlocks
    .filter((block) => block.type === 'text')
    .map((block) => block.value)
    .join('\n')
    .slice(0, 1600)
    .trim();

  return {
    posterImageUrl,
    contentImageUrls,
    descriptionMarkdown: buildDescriptionMarkdown(orderedBlocks),
    textExcerpt: textExcerpt || null,
    contentBlocks: orderedBlocks.slice(0, 120),
  };
}

function extractSemaDetailContext(html, baseUrl) {
  const semaSectionRaw = extractSectionHtmlBetweenIds(html, 'exGuideArea', 'footer', 260000);
  if (!semaSectionRaw) {
    return {
      posterImageUrl: null,
      contentImageUrls: [],
      descriptionMarkdown: null,
      textExcerpt: null,
      contentBlocks: [],
    };
  }

  const semaSection = stripNonContentHtml(semaSectionRaw);
  const orderedBlocks = extractOrderedContentBlocks(semaSection, baseUrl);
  const contentImageUrls = uniqueImageUrls(
    orderedBlocks.filter((block) => block.type === 'image').map((block) => block.value),
    24,
  );
  const textExcerpt = orderedBlocks
    .filter((block) => block.type === 'text')
    .map((block) => block.value)
    .join('\n')
    .slice(0, 1600)
    .trim();

  return {
    posterImageUrl: null,
    contentImageUrls,
    descriptionMarkdown: buildDescriptionMarkdown(orderedBlocks),
    textExcerpt: textExcerpt || null,
    contentBlocks: orderedBlocks.slice(0, 320),
  };
}

function extractSejongIntroHtml(html) {
  const tabCont1Raw = extractSectionHtmlBetweenIds(html, 'tabCont1', 'tabCont2', 220000);
  if (!tabCont1Raw) return '';
  const sectionIds = ['tabMove1', 'tabMove2'];
  const sectionScopes = sectionIds
    .map((id) => {
      const match = tabCont1Raw.match(new RegExp(`<li[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/li>`, 'i'));
      return match ? String(match[1] || '').trim() : '';
    })
    .filter(Boolean);
  const introScope = sectionScopes.length > 0 ? sectionScopes.join('\n') : tabCont1Raw;
  const blocks = [];
  const editerPattern = /<div[^>]+class=["'][^"']*\bediter\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = editerPattern.exec(introScope)) !== null) {
    const value = String(match[1] || '').trim();
    if (value) blocks.push(value);
  }
  if (blocks.length > 0) return blocks.join('\n');
  return introScope;
}

function extractSejongDetailContext(html, baseUrl) {
  const posterImageUrl = extractFirstImageUrlNearClass(html, 'zoomImg', baseUrl) || null;
  const introHtml = extractSejongIntroHtml(html);
  if (!introHtml) {
    return {
      posterImageUrl,
      contentImageUrls: [],
      descriptionMarkdown: null,
      textExcerpt: null,
      contentBlocks: [],
    };
  }

  const cleanedIntro = stripNonContentHtml(introHtml);
  const orderedBlocks = extractOrderedContentBlocks(cleanedIntro, baseUrl);
  const contentImageUrls = uniqueImageUrls(
    orderedBlocks.filter((block) => block.type === 'image').map((block) => block.value),
    18,
  );
  const textExcerpt = orderedBlocks
    .filter((block) => block.type === 'text')
    .map((block) => block.value)
    .join('\n')
    .slice(0, 1600)
    .trim();

  return {
    posterImageUrl,
    contentImageUrls,
    descriptionMarkdown: buildDescriptionMarkdown(orderedBlocks),
    textExcerpt: textExcerpt || null,
    contentBlocks: orderedBlocks.slice(0, 220),
  };
}

function parseJavascriptFunctionArgs(value) {
  const args = [];
  const source = String(value || '');
  const start = source.indexOf('(');
  const end = source.lastIndexOf(')');
  if (start < 0 || end <= start) return args;
  const inner = source.slice(start + 1, end);
  const pattern = /'([^']*)'|"([^"]*)"|([^,\s][^,]*)/g;
  let match;
  while ((match = pattern.exec(inner)) !== null) {
    args.push(decodeHtmlEntities(match[1] || match[2] || match[3] || '').trim());
  }
  return args;
}

function extractMmcaRelatedDownloads(html, baseUrl) {
  const downloads = [];
  const seen = new Set();
  const pattern = /<a\b([^>]*\bclass=["'][^"']*\bbtnDownList\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const attrs = match[1] || '';
    const hrefRaw = attrs.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    const args = parseJavascriptFunctionArgs(hrefRaw);
    const firstUrlArg = args.find((arg) => /^https?:\/\//i.test(arg));
    const url = toAbsoluteUrl(firstUrlArg || hrefRaw, baseUrl);
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const label =
      normalizeExtractedText(match[2]).replace(/^다운로드\s*/i, '').trim() ||
      attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ||
      '관련자료 다운로드';
    downloads.push({
      label: decodeHtmlEntities(label).slice(0, 120),
      url,
    });
  }
  return downloads.slice(0, 12);
}

function appendRelatedDownloadsMarkdown(descriptionMarkdown, downloads) {
  const base = String(descriptionMarkdown || '').trim();
  const links = (downloads || [])
    .map((item) => {
      const label = String(item?.label || '관련자료 다운로드').replace(/[[\]]/g, '').trim();
      const url = String(item?.url || '').trim();
      if (!label || !/^https?:\/\//i.test(url)) return null;
      return `[${label}](${url})`;
    })
    .filter(Boolean);
  if (links.length === 0) return base || null;
  const downloadSection = ['관련자료', ...links].join('\n');
  return [base, downloadSection].filter(Boolean).join('\n\n');
}

function sliceMmcaExhibitionInfoHtml(html) {
  const source = String(html || '');
  if (!source) return '';
  const startMatch = />\s*전시정보\s*</i.exec(source);
  const start = startMatch && typeof startMatch.index === 'number' ? startMatch.index : 0;
  const scoped = source.slice(start);
  const endPatterns = [
    />\s*더보기\s*</i,
    />\s*관련자료\s*</i,
    />\s*오디오가이드\s*</i,
    />\s*이벤트\s*</i,
  ];
  const end = endPatterns.reduce((picked, pattern) => {
    const match = pattern.exec(scoped);
    if (!match || typeof match.index !== 'number' || match.index <= 0) return picked;
    return picked === -1 ? match.index : Math.min(picked, match.index);
  }, -1);
  return end > 0 ? scoped.slice(0, end) : scoped;
}

function extractMmcaDetailContext(html, baseUrl) {
  const downloads = extractMmcaRelatedDownloads(html, baseUrl);
  const candidates = [
    extractSectionHtmlBetweenIds(html, 'contents', 'footer', 260000),
    extractClassSectionHtml(html, 'viewInfo', 180000),
    extractClassSectionHtml(html, 'exhInfo', 180000),
    extractClassSectionHtml(html, 'detailCont', 180000),
    extractClassSectionHtml(html, 'contArea', 180000),
  ].filter(Boolean);
  const rawSection = candidates[0] || '';
  if (!rawSection) {
    return {
      posterImageUrl: null,
      contentImageUrls: [],
      descriptionMarkdown: appendRelatedDownloadsMarkdown(null, downloads),
      textExcerpt: null,
      contentBlocks: [],
      relatedDownloads: downloads,
    };
  }

  const infoSection = sliceMmcaExhibitionInfoHtml(rawSection) || rawSection;
  const cleaned = stripElementsByClass(stripNonContentHtml(infoSection), ['imgBg', 'audioGuide', 'audioGuideBox']);
  const orderedBlocks = extractOrderedContentBlocks(cleaned, baseUrl).filter((block) => {
    const value = String(block?.value || '');
    if (block.type === 'text' && /오디오\s*가이드/i.test(value) && value.length < 120) return false;
    return true;
  });
  const contentImageUrls = uniqueImageUrls(
    orderedBlocks.filter((block) => block.type === 'image').map((block) => block.value),
    18,
  );
  const textExcerpt = orderedBlocks
    .filter((block) => block.type === 'text')
    .map((block) => block.value)
    .join('\n')
    .slice(0, 1600)
    .trim();

  return {
    posterImageUrl: null,
    contentImageUrls,
    descriptionMarkdown: appendRelatedDownloadsMarkdown(buildDescriptionMarkdown(orderedBlocks), downloads),
    textExcerpt: textExcerpt || null,
    contentBlocks: orderedBlocks.slice(0, 260),
    relatedDownloads: downloads,
  };
}

function extractBackgroundImageUrls(html, baseUrl) {
  const urls = [];
  const pattern = /background(?:-image)?\s*:[^;{}]*url\(([^)]+)\)/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const token = normalizeCssUrlToken(match[1]);
    if (!token) continue;
    const absolute = toAbsoluteUrl(token, baseUrl);
    if (!absolute) continue;
    if (/(\.svg)(\?|$)/i.test(absolute)) continue;
    urls.push(absolute);
  }
  return uniqueImageUrls(urls, 12);
}

function shouldUseInsecureTls(rawItem, detailUrl) {
  const siteKey = String(rawItem?.sourceSiteKey || '').trim().toLowerCase();
  if (siteKey === 'warmemo') return true;
  const text = String(detailUrl || '').toLowerCase();
  return text.includes('warmemo.or.kr');
}

async function enrichWithDetailContext(rawItem) {
  const detailUrl = rawItem?.detailUrl || null;
  if (!detailUrl) return rawItem;
  const insecureTls = shouldUseInsecureTls(rawItem, detailUrl);

  try {
    const response = await fetchText(detailUrl, {
      timeoutMs: 15000,
      insecureTls,
    });
    if (!response.ok) {
      throw new Error(`상세 요청 실패 (${response.status} ${response.statusText})`);
    }

    const siteKey = String(rawItem?.sourceSiteKey || '').trim().toLowerCase();
    const ddpDetail = siteKey === 'ddp' ? extractDdpDetailContext(response.text, detailUrl) : null;
    const semaDetail = siteKey === 'sema' ? extractSemaDetailContext(response.text, detailUrl) : null;
    const sejongDetail = siteKey === 'sejong' ? extractSejongDetailContext(response.text, detailUrl) : null;
    const mmcaDetail = siteKey === 'mmca' ? extractMmcaDetailContext(response.text, detailUrl) : null;
    const siteDetail = ddpDetail || semaDetail || sejongDetail || mmcaDetail;
    const metaDescription = siteDetail?.textExcerpt?.slice(0, 1200) || extractMetaDescription(response.text);
    const bodyExcerpt = siteDetail?.textExcerpt || extractBodyExcerpt(response.text);
    const metaImageUrls = extractMetaImageUrls(response.text, detailUrl);
    const backgroundImageUrls = extractBackgroundImageUrls(response.text, detailUrl);
    const inlineImageUrls = extractInlineImageUrls(response.text, detailUrl);
    const detailImageUrls =
      siteDetail && (siteDetail.posterImageUrl || siteDetail.contentImageUrls.length > 0)
        ? uniqueImageUrls([siteDetail.posterImageUrl, ...siteDetail.contentImageUrls].filter(Boolean), 10)
        : uniqueImageUrls([...metaImageUrls, ...backgroundImageUrls, ...inlineImageUrls], 10);
    const detailMetaImageUrl = siteDetail?.posterImageUrl || metaImageUrls[0] || null;
    const nextImageUrl = siteDetail?.posterImageUrl || rawItem?.imageUrl || null;

    return {
      ...rawItem,
      imageUrl: nextImageUrl,
      detailMetaDescription: metaDescription,
      detailBodyExcerpt: bodyExcerpt,
      detailMetaImageUrl,
      detailImageUrls,
      detailPreferredPosterImageUrl: siteDetail?.posterImageUrl || null,
      detailDescriptionMarkdown: siteDetail?.descriptionMarkdown || null,
      detailContentBlocks: siteDetail?.contentBlocks || null,
      detailRelatedDownloads: siteDetail?.relatedDownloads || null,
      detailFetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...rawItem,
      detailFetchError: error instanceof Error ? error.message : String(error),
      detailFetchedAt: null,
    };
  }
}

module.exports = {
  enrichWithDetailContext,
};
