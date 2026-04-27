const crypto = require('crypto');
const { fetchDaeguImageViaEdge } = require('./edge-fetch');

const EXHIBITION_ASSET_BUCKET = 'exhibition-assets';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const IMAGE_FETCH_TIMEOUT_MS = 15000;
const IMAGE_FETCH_RETRIES = 2;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const MAX_CANDIDATE_IMAGES = 12;
const DEFAULT_MAX_ADDITIONAL_IMAGES = 2;

const IMAGE_EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

const SAFE_SEGMENT = /[^a-z0-9-_]/g;
const PLACEHOLDER_IMAGE_PATTERNS = [
  /\/noimage\//i,
  /\/noimage(?:[._/?-]|$)/i,
  /\/images\/common\/logo/i,
  /\/design\/common\/images\/asset\/noimage/i,
  /\/cmsh\/[^/]+\/images\/common\//i,
];
const SAC_PLACEHOLDER_PATH_PATTERNS = [
  /^\/design\/theme\/sac\/images\/logo/i,
  /^\/design\/common\/images\/asset\/noimage/i,
  /^\/design\/theme\/sac\/images\/sub\//i,
];
const MUSEUM_PLACEHOLDER_PATH_PATTERNS = [
  /^\/museum\/api\/qrcode\.do/i,
  /^\/ux\/content\/images\/common\//i,
  /^\/ux\/content\/images\/common\/btn\//i,
  /^\/images\/common\/btn\//i,
  /^\/design\/common\/images\//i,
  /^\/design\/content\/museum\/images\//i,
];
const MMCA_PLACEHOLDER_PATH_PATTERNS = [
  /^\/asset\/images\/common\//i,
  /^\/asset\/images\/@dummy\//i,
  /^\/images\/common\/noimage(?:[._/?-]|$)/i,
];
const LEEUM_PLACEHOLDER_PATH_PATTERNS = [
  /^\/img\//i,
];

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function withTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function toSafeSegment(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(SAFE_SEGMENT, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || fallback;
}

function shortHash(input) {
  const text = String(input || '').trim();
  if (!text) return 'unknown';
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 10);
}

function isHttpUrl(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function toCanonicalUrl(value) {
  const parsed = new URL(value);
  parsed.hash = '';
  return parsed.toString();
}

function toDedupeKey(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.toLowerCase()}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function inferExtension(url, contentType) {
  const normalizedContentType = normalizeContentType(contentType);
  if (IMAGE_EXT_BY_MIME[normalizedContentType]) {
    return IMAGE_EXT_BY_MIME[normalizedContentType];
  }

  try {
    const parsed = new URL(url);
    const fileName = parsed.pathname.split('/').pop() || '';
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
    if (ext === 'png') return 'png';
    if (ext === 'webp') return 'webp';
    if (ext === 'avif') return 'avif';
    if (ext === 'gif') return 'gif';
  } catch {
    // noop
  }

  return 'jpg';
}

function normalizeContentType(contentType) {
  const normalized = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  if (normalized === 'image/jpg' || normalized === 'image/pjpeg') return 'image/jpeg';
  return normalized;
}

function isPlaceholderImageUrl(url) {
  if (!isHttpUrl(url)) return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = `${parsed.pathname}${parsed.search}`.toLowerCase();
    if (PLACEHOLDER_IMAGE_PATTERNS.some((pattern) => pattern.test(path))) {
      return true;
    }
    if (host.includes('sac.or.kr') && SAC_PLACEHOLDER_PATH_PATTERNS.some((pattern) => pattern.test(parsed.pathname))) {
      return true;
    }
    if (
      host.includes('museum.go.kr') &&
      MUSEUM_PLACEHOLDER_PATH_PATTERNS.some((pattern) => pattern.test(parsed.pathname))
    ) {
      return true;
    }
    if (host.includes('mmca.go.kr') && MMCA_PLACEHOLDER_PATH_PATTERNS.some((pattern) => pattern.test(parsed.pathname))) {
      return true;
    }
    if (
      host.includes('leeumhoam.org') &&
      LEEUM_PLACEHOLDER_PATH_PATTERNS.some((pattern) => pattern.test(parsed.pathname))
    ) {
      return true;
    }
    if (host.includes('sejongpac.or.kr')) {
      if (/^\/static\/portal\/img\/main\/logo-footer/i.test(parsed.pathname)) return true;
      if (/^\/static\/portal\/img\/common\//i.test(parsed.pathname)) return true;
      if (/^\/static\/portal\/img\/layout\//i.test(parsed.pathname)) return true;
      if (/^\/portal\/captcha\/image\.do/i.test(parsed.pathname)) return true;
    }
    if (host.includes('sema.seoul.go.kr')) {
      if (/^\/resources\/content\/(?:1x1|2x3|3x2|16x9)\.(?:jpg|jpeg|png|gif)$/i.test(parsed.pathname)) return true;
      if (/^\/resources\/images\/common\/noimg/i.test(parsed.pathname)) return true;
      if (parsed.pathname.toLowerCase() === '/common/imgfileview') {
        const fileId = String(parsed.searchParams.get('file_id') || parsed.searchParams.get('FILE_ID') || '').trim();
        if (!/^\d+$/.test(fileId)) return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

function isDaeguImageHost(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().includes('daeguartmuseum.or.kr');
  } catch {
    return false;
  }
}

function collectImageCandidates(rawItem, normalized) {
  const list = [
    rawItem?.imageUrl,
    rawItem?.detailMetaImageUrl,
    ...(Array.isArray(rawItem?.detailImageUrls) ? rawItem.detailImageUrls : []),
    normalized?.posterImageUrl,
  ]
    .map((value) => String(value || '').trim())
    .filter((value) => value.length > 0)
    .filter((value) => isHttpUrl(value))
    .filter((value) => !isPlaceholderImageUrl(value));

  const seen = new Set();
  const picked = [];
  for (const value of list) {
    const canonical = toCanonicalUrl(value);
    const dedupeKey = toDedupeKey(canonical);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    picked.push(canonical);
    if (picked.length >= MAX_CANDIDATE_IMAGES) break;
  }

  return picked;
}

async function fetchRemoteImage(url, options = {}) {
  const allowDaeguEdgeFetch = Boolean(options.allowDaeguEdgeFetch);
  const edgeEnv = options.env || process.env;
  let finalDirectError = null;

  let attempt = 0;
  while (attempt <= IMAGE_FETCH_RETRIES) {
    const timeout = withTimeoutSignal(IMAGE_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: timeout.signal,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });
      if (!response.ok) {
        throw new Error(`이미지 요청 실패 (${response.status} ${response.statusText})`);
      }

      const contentType = normalizeContentType(response.headers.get('content-type') || '');
      if (contentType && !contentType.startsWith('image/')) {
        throw new Error(`이미지 응답이 아닙니다. (${contentType})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length === 0) {
        throw new Error('이미지 응답 본문이 비어 있습니다.');
      }
      if (buffer.length > IMAGE_MAX_BYTES) {
        throw new Error(`이미지 용량 초과 (${buffer.length} bytes)`);
      }

      return {
        buffer,
        contentType,
      };
    } catch (error) {
      finalDirectError = error;
      if (attempt >= IMAGE_FETCH_RETRIES) {
        break;
      }
      await wait(250 * (attempt + 1));
      attempt += 1;
    } finally {
      timeout.clear();
    }
  }

  if (allowDaeguEdgeFetch && isDaeguImageHost(url)) {
    try {
      const edge = await fetchDaeguImageViaEdge(edgeEnv, {
        url,
        timeoutMs: IMAGE_FETCH_TIMEOUT_MS,
      });
      return {
        buffer: edge.buffer,
        contentType: normalizeContentType(edge.contentType || ''),
      };
    } catch (edgeError) {
      const directMessage = finalDirectError instanceof Error ? finalDirectError.message : String(finalDirectError || '');
      const edgeMessage = edgeError instanceof Error ? edgeError.message : String(edgeError);
      throw new Error(`이미지 다운로드 실패 (direct: ${directMessage || 'unknown'}, edge: ${edgeMessage})`);
    }
  }

  if (finalDirectError) {
    throw finalDirectError;
  }
  throw new Error('이미지 다운로드 실패');
}

function buildBasePathPrefix({ sourceSiteKey, sourceExternalId, title, date }) {
  const now = date || new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const site = toSafeSegment(sourceSiteKey, 'unknown-site');
  const titleSegment = toSafeSegment(title, 'untitled-exhibition');
  const external = toSafeSegment(sourceExternalId, '');
  const idSegment = external || `${titleSegment}-${shortHash(titleSegment)}`;
  return `posters/${site}/${yyyy}/${mm}/${idSegment}`;
}

async function uploadRemoteImageToStorage({ supabase, path, sourceUrl, fetchOptions }) {
  const downloaded = await fetchRemoteImage(sourceUrl, fetchOptions);
  const extension = inferExtension(sourceUrl, downloaded.contentType);
  const finalPath = `${path}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(EXHIBITION_ASSET_BUCKET).upload(finalPath, downloaded.buffer, {
    contentType: downloaded.contentType || `image/${extension}`,
    upsert: true,
    cacheControl: '86400',
  });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(EXHIBITION_ASSET_BUCKET).getPublicUrl(finalPath);
  const publicUrl = data?.publicUrl || null;
  if (!publicUrl) {
    throw new Error('공개 URL 생성 실패');
  }

  return {
    path: finalPath,
    publicUrl,
    sourceUrl,
    sizeBytes: downloaded.buffer.length,
    contentType: downloaded.contentType || null,
  };
}

async function uploadExhibitionImageSet({
  supabase,
  sourceSiteKey,
  sourceExternalId,
  title,
  candidateUrls,
  maxAdditionalImages = DEFAULT_MAX_ADDITIONAL_IMAGES,
  fetchOptions = null,
}) {
  const maxExtras = Number.isFinite(maxAdditionalImages)
    ? Math.min(DEFAULT_MAX_ADDITIONAL_IMAGES, Math.max(0, Math.floor(maxAdditionalImages)))
    : DEFAULT_MAX_ADDITIONAL_IMAGES;
  const maxTotal = 1 + maxExtras;

  const uploaded = [];
  const warnings = [];

  if (!Array.isArray(candidateUrls) || candidateUrls.length === 0) {
    return {
      mainImageUrl: null,
      additionalImageUrls: [],
      uploaded,
      warnings,
    };
  }

  const prefix = buildBasePathPrefix({
    sourceSiteKey,
    sourceExternalId,
    title,
  });

  for (const candidate of candidateUrls) {
    if (uploaded.length >= maxTotal) break;
    try {
      const kind = uploaded.length === 0 ? 'main' : `extra-${uploaded.length}`;
      const uploadedItem = await uploadRemoteImageToStorage({
        supabase,
        path: `${prefix}/${kind}`,
        sourceUrl: candidate,
        fetchOptions,
      });
      uploaded.push(uploadedItem);
    } catch (error) {
      warnings.push(`${candidate} (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  return {
    mainImageUrl: uploaded[0]?.publicUrl || null,
    additionalImageUrls: uploaded.slice(1).map((item) => item.publicUrl).slice(0, maxExtras),
    uploaded,
    warnings,
  };
}

module.exports = {
  collectImageCandidates,
  isPlaceholderImageUrl,
  uploadExhibitionImageSet,
};
