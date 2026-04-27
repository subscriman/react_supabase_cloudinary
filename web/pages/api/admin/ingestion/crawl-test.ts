import type { NextApiRequest, NextApiResponse } from 'next';
import { sendApiError, sendApiSuccess } from '../../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../../lib/supabase-server';

type ErrorResponse = { error: string; errorCode: string };

type CrawlTestPayload = {
  url: string;
  siteKey: string | 'auto';
  limit: number;
  includeDetail: boolean;
  detailLimit: number;
};

type CrawlPreviewItem = {
  index: number;
  sourceExternalId: string | null;
  title: string | null;
  venueName: string | null;
  startDateRaw: string | null;
  endDateRaw: string | null;
  detailUrl: string | null;
  listUrl: string | null;
  imageUrl: string | null;
  summary: string | null;
  rawType: string | null;
  detailPreferredPosterImageUrl: string | null;
  detailImageUrls: string[];
  detailImageCount: number;
  detailDescriptionPreview: string | null;
  detailDescriptionLength: number;
  detailFetchError: string | null;
};

type SuccessResponse = {
  data: {
    requestedUrl: string;
    fetchedUrl: string;
    fetchedStatus: number;
    fetchedOk: boolean;
    fetchedBytes: number;
    resolvedSiteKey: string;
    resolvedSiteName: string;
    matchMode: 'auto' | 'manual';
    includeDetail: boolean;
    detailLimit: number;
    limit: number;
    extractedCount: number;
    items: CrawlPreviewItem[];
    warnings: string[];
  };
};

type SiteConfigLike = {
  key: string;
  name: string;
  listUrl: string;
  detailUrlHint?: string;
};

type AdapterRawItem = {
  sourceExternalId?: unknown;
  title?: unknown;
  venueName?: unknown;
  startDateRaw?: unknown;
  endDateRaw?: unknown;
  detailUrl?: unknown;
  listUrl?: unknown;
  imageUrl?: unknown;
  summary?: unknown;
  rawType?: unknown;
  detailPreferredPosterImageUrl?: unknown;
  detailImageUrls?: unknown;
  detailDescriptionMarkdown?: unknown;
  detailFetchError?: unknown;
};

function mapUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function parsePayload(input: unknown): { ok: true; value: CrawlTestPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  }

  const body = input as Record<string, unknown>;
  const url = toNonEmptyString(body.url);
  if (!url) return { ok: false, error: '테스트할 URL을 입력해 주세요.' };
  if (!parseHttpUrl(url)) return { ok: false, error: 'URL 형식이 올바르지 않습니다.' };

  const siteRaw = toNonEmptyString(body.siteKey)?.toLowerCase() || 'auto';
  if (siteRaw !== 'auto' && !/^[a-z0-9-]{2,40}$/.test(siteRaw)) {
    return { ok: false, error: 'siteKey 형식이 올바르지 않습니다.' };
  }

  const limitRaw = Number(body.limit);
  const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 30 ? limitRaw : 10;

  const includeDetail = body.includeDetail !== false;

  const detailLimitRaw = Number(body.detailLimit);
  const detailLimitBase = Number.isInteger(detailLimitRaw) && detailLimitRaw >= 0 && detailLimitRaw <= 10 ? detailLimitRaw : 5;
  const detailLimit = Math.min(detailLimitBase, limit);

  return {
    ok: true,
    value: {
      url: url.trim(),
      siteKey: siteRaw as string | 'auto',
      limit,
      includeDetail,
      detailLimit,
    },
  };
}

async function ensureAdmin(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) return false;
  return data?.role === 'admin';
}

function collectSiteConfigs(): SiteConfigLike[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const loaded = require('../../../../scripts/ingestion/site-config') as {
      getSiteConfigs?: (keys?: string[]) => SiteConfigLike[];
      SITE_CONFIG_MAP?: Map<string, SiteConfigLike>;
    };
    const defaults = typeof loaded.getSiteConfigs === 'function' ? loaded.getSiteConfigs([]) : [];
    const withDaegu = typeof loaded.getSiteConfigs === 'function' ? loaded.getSiteConfigs(['daegu-art']) : [];
    const fromMap = loaded.SITE_CONFIG_MAP instanceof Map ? Array.from(loaded.SITE_CONFIG_MAP.values()) : [];
    const merged = [...defaults, ...withDaegu, ...fromMap];
    const deduped = new Map<string, SiteConfigLike>();
    for (const item of merged) {
      const key = String(item?.key || '').trim().toLowerCase();
      if (!key) continue;
      if (!deduped.has(key)) deduped.set(key, item);
    }
    return Array.from(deduped.values());
  } catch {
    return [];
  }
}

function resolveOrigin(config: SiteConfigLike | null, fallbackUrl: string): string {
  const probes = [config?.listUrl, config?.detailUrlHint, fallbackUrl];
  for (const probe of probes) {
    const parsed = probe ? parseHttpUrl(probe) : null;
    if (!parsed) continue;
    return `${parsed.protocol}//${parsed.host}`;
  }
  return fallbackUrl;
}

function scoreConfigByUrl(target: URL, config: SiteConfigLike): number {
  const probes = [config.listUrl, config.detailUrlHint].filter(Boolean) as string[];
  let score = 0;

  for (const probeUrl of probes) {
    const probe = parseHttpUrl(probeUrl);
    if (!probe) continue;
    const targetHost = target.hostname.toLowerCase();
    const probeHost = probe.hostname.toLowerCase();

    if (targetHost === probeHost) score += 12;
    else if (targetHost.endsWith(`.${probeHost}`) || probeHost.endsWith(`.${targetHost}`)) score += 8;

    const targetPath = target.pathname.toLowerCase();
    const probePath = probe.pathname.toLowerCase();
    if (probePath && probePath !== '/') {
      if (targetPath.startsWith(probePath)) score += 4;
      else if (targetPath.includes(probePath)) score += 2;
    }
  }

  const lowered = target.toString().toLowerCase();
  const key = String(config.key || '').toLowerCase();
  if (key && lowered.includes(key)) score += 1;
  return score;
}

function resolveSiteConfig(input: { siteKey: string | 'auto'; url: string; configs: SiteConfigLike[] }) {
  if (input.siteKey !== 'auto') {
    const exact = input.configs.find((config) => String(config.key || '').toLowerCase() === input.siteKey);
    if (!exact) return { config: null as SiteConfigLike | null, matchMode: 'manual' as const };
    return { config: exact, matchMode: 'manual' as const };
  }

  const parsed = parseHttpUrl(input.url);
  if (!parsed) return { config: null as SiteConfigLike | null, matchMode: 'auto' as const };

  const ranked = input.configs
    .map((config) => ({
      config,
      score: scoreConfigByUrl(parsed, config),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    config: ranked[0]?.config || null,
    matchMode: 'auto' as const,
  };
}

function normalizeItems(items: AdapterRawItem[]): AdapterRawItem[] {
  const seen = new Set<string>();
  const out: AdapterRawItem[] = [];
  for (const item of items || []) {
    const title = toNonEmptyString(item?.title) || '';
    const detailUrl = toNonEmptyString(item?.detailUrl) || '';
    const sourceExternalId = toNonEmptyString(item?.sourceExternalId) || '';
    const key = `${sourceExternalId}::${detailUrl}::${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function toStringArray(values: unknown, limit = 20): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const item = toNonEmptyString(value);
    if (!item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function toCrawlPreviewItem(index: number, item: AdapterRawItem): CrawlPreviewItem {
  const detailDescription = toNonEmptyString(item?.detailDescriptionMarkdown) || '';
  const previewLimit = 2500;
  const detailImageUrls = toStringArray(item?.detailImageUrls, 24);

  return {
    index,
    sourceExternalId: toNonEmptyString(item?.sourceExternalId),
    title: toNonEmptyString(item?.title),
    venueName: toNonEmptyString(item?.venueName),
    startDateRaw: toNonEmptyString(item?.startDateRaw),
    endDateRaw: toNonEmptyString(item?.endDateRaw),
    detailUrl: toNonEmptyString(item?.detailUrl),
    listUrl: toNonEmptyString(item?.listUrl),
    imageUrl: toNonEmptyString(item?.imageUrl),
    summary: toNonEmptyString(item?.summary),
    rawType: toNonEmptyString(item?.rawType),
    detailPreferredPosterImageUrl: toNonEmptyString(item?.detailPreferredPosterImageUrl),
    detailImageUrls,
    detailImageCount: detailImageUrls.length,
    detailDescriptionPreview: detailDescription ? detailDescription.slice(0, previewLimit) : null,
    detailDescriptionLength: detailDescription.length,
    detailFetchError: toNonEmptyString(item?.detailFetchError),
  };
}

function shouldUseInsecureTls(siteKey: string, targetUrl: string): boolean {
  if (siteKey === 'warmemo') return true;
  return targetUrl.includes('warmemo.or.kr');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendApiError(res, 405, 'METHOD_NOT_ALLOWED', '허용되지 않은 메서드입니다.');
  }

  const accessToken = getBearerTokenFromHeader(req.headers.authorization);
  if (!accessToken) {
    return sendApiError(res, 401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  }

  const parsed = parsePayload(req.body);
  if (!parsed.ok) {
    const message = 'error' in parsed ? parsed.error : '요청 값이 올바르지 않습니다.';
    return sendApiError(res, 400, 'INVALID_INPUT', message);
  }

  try {
    const supabase = createSupabaseServerClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return sendApiError(res, 401, 'UNAUTHORIZED', '로그인 세션이 유효하지 않습니다.');
    }

    const isAdmin = await ensureAdmin(supabase, authData.user.id);
    if (!isAdmin) {
      return sendApiError(res, 403, 'FORBIDDEN', '관리자만 사용할 수 있습니다.');
    }

    const siteConfigs = collectSiteConfigs();
    if (siteConfigs.length === 0) {
      return sendApiError(res, 500, 'INTERNAL_ERROR', '사이트 설정을 불러오지 못했습니다.');
    }

    const resolved = resolveSiteConfig({
      siteKey: parsed.value.siteKey,
      url: parsed.value.url,
      configs: siteConfigs,
    });

    if (!resolved.config) {
      return sendApiError(
        res,
        400,
        'INVALID_INPUT',
        'URL에 매칭되는 수집 사이트를 찾지 못했습니다. siteKey를 직접 지정해 주세요.',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { pickAdapter } = require('../../../../scripts/ingestion/adapters') as {
      pickAdapter: (siteKey: string) => { extractListItems: (html: string, context: any) => Promise<any[]> | any[] };
    };
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { fetchText } = require('../../../../scripts/ingestion/http') as {
      fetchText: (
        url: string,
        options?: { timeoutMs?: number; insecureTls?: boolean },
      ) => Promise<{ ok: boolean; status: number; statusText: string; url: string; text: string }>;
    };
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { enrichWithDetailContext } = require('../../../../scripts/ingestion/detail-fetch') as {
      enrichWithDetailContext: (item: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };

    const siteKey = String(resolved.config.key || '').trim().toLowerCase();
    const adapter = pickAdapter(siteKey);
    const response = await fetchText(parsed.value.url, {
      timeoutMs: 20000,
      insecureTls: shouldUseInsecureTls(siteKey, parsed.value.url),
    });

    const context = {
      siteKey,
      baseUrl: resolveOrigin(resolved.config, parsed.value.url),
      listUrl: parsed.value.url,
    };

    const extractedRaw = await Promise.resolve(adapter.extractListItems(response.text || '', context));
    const normalizedItems = normalizeItems(Array.isArray(extractedRaw) ? (extractedRaw as AdapterRawItem[]) : []);
    const sliced = normalizedItems.slice(0, parsed.value.limit);

    const warnings: string[] = [];
    if (!response.ok) {
      warnings.push(`목록 요청이 성공 상태가 아닙니다. (${response.status} ${response.statusText})`);
    }

    const withDetail: AdapterRawItem[] = [];
    for (let index = 0; index < sliced.length; index += 1) {
      const item = sliced[index];
      if (!parsed.value.includeDetail || index >= parsed.value.detailLimit) {
        withDetail.push(item);
        continue;
      }

      try {
        const enriched = await enrichWithDetailContext(item as Record<string, unknown>);
        withDetail.push((enriched || item) as AdapterRawItem);
      } catch (error) {
        withDetail.push({
          ...item,
          detailFetchError: mapUnknownError(error, '상세 파싱 실패'),
        });
      }
    }

    const previewItems = withDetail.map((item, index) => toCrawlPreviewItem(index + 1, item));
    return sendApiSuccess(res, 200, {
      requestedUrl: parsed.value.url,
      fetchedUrl: response.url || parsed.value.url,
      fetchedStatus: response.status,
      fetchedOk: response.ok,
      fetchedBytes: Buffer.byteLength(response.text || '', 'utf8'),
      resolvedSiteKey: siteKey,
      resolvedSiteName: resolved.config.name || siteKey,
      matchMode: resolved.matchMode,
      includeDetail: parsed.value.includeDetail,
      detailLimit: parsed.value.detailLimit,
      limit: parsed.value.limit,
      extractedCount: normalizedItems.length,
      items: previewItems,
      warnings,
    });
  } catch (error) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', mapUnknownError(error, '크롤링 테스트 중 오류가 발생했습니다.'));
  }
}
