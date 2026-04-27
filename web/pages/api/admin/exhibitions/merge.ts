import type { NextApiRequest, NextApiResponse } from 'next';
import { sendApiError, sendApiSuccess } from '../../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../../lib/supabase-server';

type ErrorResponse = { error: string; errorCode: string };
type SuccessResponse = { data: { primaryId: string; hiddenIds: string[] } };

function parseBody(
  input: unknown,
): { ok: true; primaryId: string; duplicateIds: string[] } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  }

  const body = input as Record<string, unknown>;
  const primaryId = typeof body.primaryId === 'string' ? body.primaryId.trim() : '';
  const duplicateIds = Array.isArray(body.duplicateIds)
    ? Array.from(
        new Set(
          body.duplicateIds
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
        ),
      )
    : [];

  if (!primaryId) {
    return { ok: false, error: '대표 전시 ID가 필요합니다.' };
  }
  if (duplicateIds.length === 0) {
    return { ok: false, error: '중복 처리할 전시 ID가 없습니다.' };
  }
  if (duplicateIds.includes(primaryId)) {
    return { ok: false, error: '대표 전시 ID는 중복 대상에 포함될 수 없습니다.' };
  }

  return { ok: true, primaryId, duplicateIds };
}

function mapUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
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

  const parsed = parseBody(req.body);
  if (!parsed.ok) {
    const errorMessage = 'error' in parsed ? parsed.error : '요청 값이 올바르지 않습니다.';
    return sendApiError(res, 400, 'INVALID_INPUT', errorMessage);
  }

  try {
    const supabase = createSupabaseServerClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return sendApiError(res, 401, 'UNAUTHORIZED', '로그인 세션이 유효하지 않습니다.');
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError || profileData?.role !== 'admin') {
      return sendApiError(res, 403, 'FORBIDDEN', '관리자만 처리할 수 있습니다.');
    }

    const { primaryId, duplicateIds } = parsed;

    const { data: primaryData, error: primaryError } = await supabase
      .from('exhibitions')
      .select('id')
      .eq('id', primaryId)
      .maybeSingle();
    if (primaryError) {
      return sendApiError(res, 400, 'BAD_REQUEST', primaryError.message);
    }
    if (!primaryData) {
      return sendApiError(res, 404, 'NOT_FOUND', '대표 전시를 찾지 못했습니다.');
    }

    const { data: duplicateData, error: duplicateError } = await supabase
      .from('exhibitions')
      .select('id')
      .in('id', duplicateIds);
    if (duplicateError) {
      return sendApiError(res, 400, 'BAD_REQUEST', duplicateError.message);
    }

    const foundIds = new Set((duplicateData ?? []).map((item: any) => item.id as string));
    if (foundIds.size !== duplicateIds.length) {
      return sendApiError(res, 400, 'INVALID_INPUT', '중복 대상 전시 중 존재하지 않는 항목이 있습니다.');
    }

    const { error: updateError } = await supabase
      .from('exhibitions')
      .update({
        status: 'hidden',
        published_at: null,
      })
      .in('id', duplicateIds);

    if (updateError) {
      return sendApiError(res, 400, 'BAD_REQUEST', updateError.message);
    }

    return sendApiSuccess(res, 200, {
      primaryId,
      hiddenIds: duplicateIds,
    });
  } catch (error) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', mapUnknownError(error, '중복 병합 처리 중 오류가 발생했습니다.'));
  }
}
