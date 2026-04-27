type ConnectTestInput = {
  url?: string;
  timeoutMs?: number;
  method?: string;
  includeHtml?: boolean;
  includeBodyBase64?: boolean;
};

const DEFAULT_TARGET_URL = 'https://daeguartmuseum.or.kr/index.do?menu_id=00000729';
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_TIMEOUT_MS = 30000;
const MIN_TIMEOUT_MS = 3000;

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

function parseTimeoutMs(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(parsed)));
}

function parseInput(req: Request): Promise<ConnectTestInput> {
  if (req.method === 'POST') {
    return req
      .json()
      .then((body) => (body && typeof body === 'object' ? (body as ConnectTestInput) : {}))
      .catch(() => ({}));
  }

  const url = new URL(req.url);
  return Promise.resolve({
    url: url.searchParams.get('url') ?? undefined,
    timeoutMs: url.searchParams.get('timeoutMs') ?? undefined,
    method: url.searchParams.get('method') ?? undefined,
    includeBodyBase64: url.searchParams.get('includeBodyBase64') ?? undefined,
  });
}

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, ' ').trim().slice(0, 180) || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Only GET/POST is allowed.' });
  }

  const input = await parseInput(req);
  const targetUrl = String(input.url || DEFAULT_TARGET_URL).trim();
  const timeoutMs = parseTimeoutMs(input.timeoutMs);
  const method = String(input.method || 'GET').trim().toUpperCase();
  const includeHtml = parseBoolean(input.includeHtml);
  const includeBodyBase64 = parseBoolean(input.includeBodyBase64);
  const startedAt = new Date().toISOString();
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const contentType = response.headers.get('content-type');
    let text = '';
    let bodyBase64: string | undefined;
    let bodyLength = 0;

    if (includeBodyBase64) {
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      bodyLength = bytes.length;
      bodyBase64 = toBase64(bytes);
      if (contentType && contentType.toLowerCase().includes('text/html')) {
        text = new TextDecoder().decode(bytes);
      }
    } else {
      text = await response.text();
      bodyLength = text.length;
    }

    const durationMs = Date.now() - started;
    const title = text ? extractTitle(text) : null;

    return jsonResponse(200, {
      ok: response.ok,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs,
      request: {
        method,
        url: targetUrl,
        timeoutMs,
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        finalUrl: response.url,
        contentType,
        title,
        bodyLength,
        bodyPreview: text ? text.slice(0, 400) : '',
        bodyBase64,
        html: includeHtml ? text : undefined,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - started;
    const err = error instanceof Error ? error : new Error(String(error));
    const anyErr = error as Record<string, unknown> | undefined;
    const cause =
      anyErr && typeof anyErr === 'object' && 'cause' in anyErr ? (anyErr.cause as Record<string, unknown>) : null;

    return jsonResponse(200, {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs,
      request: {
        method,
        url: targetUrl,
        timeoutMs,
      },
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack ?? null,
        cause: cause
          ? {
              name: String(cause.name ?? ''),
              message: String(cause.message ?? ''),
              code: String(cause.code ?? ''),
            }
          : null,
      },
    });
  } finally {
    clearTimeout(timer);
  }
});
