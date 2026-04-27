const http = require('http');
const https = require('https');

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_REDIRECTS = 5;

function withTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function describeFetchError(error) {
  const message = String(error?.message || error || '').trim();
  const code = String(error?.code || error?.cause?.code || '').trim();
  const causeMessage = String(error?.cause?.message || '').trim();
  const parts = [];
  if (message) parts.push(message);
  if (code) parts.push(`code=${code}`);
  if (causeMessage && causeMessage !== message) parts.push(`cause=${causeMessage}`);
  return parts.join(' | ') || 'unknown error';
}

function requestTextViaNode(url, options, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      reject(new Error(`유효하지 않은 URL입니다: ${url}`));
      return;
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const requestOptions = {
      method: options.method,
      headers: options.headers,
      timeout: options.timeoutMs,
      rejectUnauthorized: options.insecureTls ? false : undefined,
    };

    const request = transport.request(parsedUrl, requestOptions, (response) => {
      const statusCode = Number(response.statusCode || 0);
      const location = response.headers.location;
      const shouldRedirect = [301, 302, 303, 307, 308].includes(statusCode) && location;
      if (shouldRedirect) {
        if (redirectCount >= MAX_REDIRECTS) {
          response.resume();
          reject(new Error(`redirect limit exceeded (${MAX_REDIRECTS})`));
          return;
        }
        const nextUrl = new URL(location, parsedUrl).toString();
        const nextMethod = statusCode === 303 ? 'GET' : options.method;
        const nextBody = statusCode === 303 ? undefined : options.body;
        response.resume();
        requestTextViaNode(
          nextUrl,
          {
            ...options,
            method: nextMethod,
            body: nextBody,
          },
          redirectCount + 1,
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      });
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: statusCode >= 200 && statusCode < 300,
          status: statusCode,
          statusText: String(response.statusMessage || ''),
          url: parsedUrl.toString(),
          text,
        });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('request timeout'));
    });
    request.on('error', reject);

    if (options.body !== undefined && options.body !== null) {
      request.write(options.body);
    }
    request.end();
  });
}

async function fetchText(url, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const method = String(options.method || 'GET').toUpperCase();
  const accept =
    String(options.accept || '').trim() || (method === 'GET' ? 'text/html,application/xhtml+xml' : '*/*');
  const userAgent = String(options.userAgent || '').trim() || DEFAULT_USER_AGENT;
  const retries = Number.isFinite(options.retries) ? Math.max(0, Math.floor(options.retries)) : 2;
  const headers = {
    'User-Agent': userAgent,
    Accept: accept,
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    ...(options.headers || {}),
  };
  let attempt = 0;
  while (attempt <= retries) {
    const timeout = withTimeoutSignal(timeoutMs);
    try {
      if (options.insecureTls) {
        return await requestTextViaNode(url, {
          method,
          headers,
          body: options.body,
          timeoutMs,
          insecureTls: true,
        });
      }

      const response = await fetch(url, {
        method,
        headers,
        body: options.body,
        signal: timeout.signal,
        redirect: 'follow',
      });

      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url || url,
        text,
      };
    } catch (error) {
      if (attempt >= retries) {
        const detail = describeFetchError(error);
        throw new Error(
          `fetch failed (${method} ${url}, timeout=${timeoutMs}ms, retries=${retries}, attempts=${attempt + 1}): ${detail}`,
        );
      }
      await wait(250 * (attempt + 1));
      attempt += 1;
    } finally {
      timeout.clear();
    }
  }

  throw new Error('fetch failed');
}

module.exports = {
  fetchText,
};
