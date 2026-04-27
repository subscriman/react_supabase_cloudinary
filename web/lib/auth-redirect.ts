const DEFAULT_SITE_URL = 'https://arttomato-web.vercel.app';
const DEFAULT_WEB_CALLBACK_PATH = '/auth/callback';
const DEFAULT_POST_AUTH_PATH = '/mypage';

function stripTrailingSlash(input: string): string {
  return input.replace(/\/+$/, '');
}

export function normalizeNextPath(path: string | null | undefined): string {
  const value = String(path || '').trim();
  if (!value) return DEFAULT_POST_AUTH_PATH;
  if (!value.startsWith('/')) return DEFAULT_POST_AUTH_PATH;
  if (value.startsWith('//')) return DEFAULT_POST_AUTH_PATH;
  return value;
}

export function resolveSiteUrl(): string {
  const envSiteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (envSiteUrl) return stripTrailingSlash(envSiteUrl);
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = stripTrailingSlash(window.location.origin);
    const host = String(window.location.hostname || '').toLowerCase();
    const isLocalhost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local');

    // 로컬에서 NEXT_PUBLIC_SITE_URL이 비어 있으면 운영 도메인으로 리다이렉트 링크를 생성해
    // 메일 링크가 localhost로 고정되는 문제를 피한다.
    if (isLocalhost) {
      return DEFAULT_SITE_URL;
    }
    return origin;
  }
  return DEFAULT_SITE_URL;
}

export function buildWebAuthRedirectUrl(nextPath?: string): string {
  const url = new URL(DEFAULT_WEB_CALLBACK_PATH, `${resolveSiteUrl()}/`);
  url.searchParams.set('next', normalizeNextPath(nextPath));
  return url.toString();
}

export function getMobileAuthCallbackTemplate(): string {
  return String(process.env.NEXT_PUBLIC_APP_AUTH_CALLBACK || 'arttomato://auth/callback').trim();
}
