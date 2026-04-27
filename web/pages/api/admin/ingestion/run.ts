import type { NextApiRequest, NextApiResponse } from 'next';
import { sendApiError, sendApiSuccess } from '../../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../../lib/supabase-server';

type ErrorResponse = { error: string; errorCode: string };
type SuccessResponse = {
  data: {
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    site: string;
    dryRun: boolean;
    limit: number;
    message: string;
  };
};

type IngestionRunPayload = {
  siteKey: string | 'all';
  dryRun: boolean;
  limit: number;
};

function mapUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function parsePayload(input: unknown): { ok: true; value: IngestionRunPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  }

  const body = input as Record<string, unknown>;
  const siteRaw = typeof body.siteKey === 'string' ? body.siteKey.trim().toLowerCase() : 'all';
  const siteKey = siteRaw.length === 0 ? 'all' : siteRaw;
  if (siteKey !== 'all' && !/^[a-z0-9-]{2,40}$/.test(siteKey)) {
    return { ok: false, error: 'siteKey 형식이 올바르지 않습니다.' };
  }

  const dryRun = body.dryRun === true;
  const limitRaw = Number(body.limit);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? limitRaw : 20;

  return {
    ok: true,
    value: {
      siteKey,
      dryRun,
      limit,
    },
  };
}

async function ensureAdmin(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) return false;
  return data?.role === 'admin';
}

async function countRunningJobs(supabase: ReturnType<typeof createSupabaseServerClient>): Promise<number> {
  const { count, error } = await supabase
    .from('ingestion_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'running');
  if (error) return 0;
  return count ?? 0;
}

function resolveIngestionMain(): ((argv?: string[], env?: NodeJS.ProcessEnv) => Promise<void>) | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const loaded = require('../../../../scripts/ingestion/run') as {
      main?: (argv?: string[], env?: NodeJS.ProcessEnv) => Promise<void>;
    };
    if (typeof loaded.main === 'function') return loaded.main;
  } catch (_error) {
    return null;
  }
  return null;
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
      return sendApiError(res, 403, 'FORBIDDEN', '관리자만 수집을 실행할 수 있습니다.');
    }

    const runningCount = await countRunningJobs(supabase);
    if (runningCount > 0) {
      return sendApiError(
        res,
        409,
        'CONFLICT',
        `이미 실행 중인 수집 작업이 ${runningCount}건 있습니다. 완료 후 다시 시도해 주세요.`,
      );
    }

    const runIngestionMain = resolveIngestionMain();
    if (!runIngestionMain) {
      return sendApiError(
        res,
        500,
        'INTERNAL_ERROR',
        '수집 스크립트를 불러오지 못했습니다. 서버 배포 구조를 확인해 주세요.',
      );
    }

    const startedAt = new Date();
    const args: string[] = [];
    if (parsed.value.siteKey !== 'all') {
      args.push(`--site=${parsed.value.siteKey}`);
    }
    if (parsed.value.dryRun) {
      args.push('--dry-run');
    }
    args.push(`--limit=${parsed.value.limit}`);

    await runIngestionMain(args, process.env);

    const finishedAt = new Date();
    return sendApiSuccess(res, 200, {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      site: parsed.value.siteKey,
      dryRun: parsed.value.dryRun,
      limit: parsed.value.limit,
      message: '수집 실행이 완료되었습니다.',
    });
  } catch (error) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', mapUnknownError(error, '수집 실행 중 오류가 발생했습니다.'));
  }
}
