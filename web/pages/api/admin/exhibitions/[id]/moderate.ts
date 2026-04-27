import type { NextApiRequest, NextApiResponse } from 'next';
import { sendApiError, sendApiSuccess } from '../../../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../../../lib/supabase-server';

type ModerateAction = 'approve' | 'reject' | 'hold';

type ErrorResponse = { error: string; errorCode: string };
type SuccessResponse = {
  data: {
    exhibition: {
      id: string;
      status: string;
      published_at: string | null;
      updated_at: string;
    };
  };
};

function getExhibitionId(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseAction(input: unknown): ModerateAction | null {
  if (input === 'approve' || input === 'reject' || input === 'hold') return input;
  return null;
}

function computePublishStatus(startDate: string, endDate: string): 'upcoming' | 'ongoing' | 'ended' {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'ongoing';
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

  const exhibitionId = getExhibitionId(req.query.id);
  if (!exhibitionId) {
    return sendApiError(res, 400, 'INVALID_INPUT', '전시 ID가 필요합니다.');
  }

  const action = parseAction((req.body as Record<string, unknown> | undefined)?.action);
  if (!action) {
    return sendApiError(res, 400, 'INVALID_INPUT', 'action 값이 올바르지 않습니다.');
  }

  const accessToken = getBearerTokenFromHeader(req.headers.authorization);
  if (!accessToken) {
    return sendApiError(res, 401, 'UNAUTHORIZED', '로그인이 필요합니다.');
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

    if (profileError) {
      return sendApiError(res, 403, 'FORBIDDEN', '관리자 권한을 확인할 수 없습니다.');
    }
    if (profileData?.role !== 'admin') {
      return sendApiError(res, 403, 'FORBIDDEN', '관리자만 처리할 수 있습니다.');
    }

    const { data: exhibitionData, error: exhibitionError } = await supabase
      .from('exhibitions')
      .select('id, start_date, end_date')
      .eq('id', exhibitionId)
      .maybeSingle();

    if (exhibitionError) {
      return sendApiError(res, 400, 'BAD_REQUEST', exhibitionError.message);
    }
    if (!exhibitionData) {
      return sendApiError(res, 404, 'NOT_FOUND', '전시를 찾을 수 없습니다.');
    }

    let nextStatus: string;
    let publishedAt: string | null;

    if (action === 'approve') {
      nextStatus = computePublishStatus(exhibitionData.start_date, exhibitionData.end_date);
      publishedAt = new Date().toISOString();
    } else if (action === 'reject') {
      nextStatus = 'rejected';
      publishedAt = null;
    } else {
      nextStatus = 'pending_review';
      publishedAt = null;
    }

    const { data: updatedData, error: updateError } = await supabase
      .from('exhibitions')
      .update({
        status: nextStatus,
        published_at: publishedAt,
      })
      .eq('id', exhibitionId)
      .select('id, status, published_at, updated_at')
      .maybeSingle();

    if (updateError) {
      return sendApiError(res, 400, 'BAD_REQUEST', updateError.message);
    }
    if (!updatedData) {
      return sendApiError(res, 404, 'NOT_FOUND', '전시 상태를 업데이트하지 못했습니다.');
    }

    return sendApiSuccess(res, 200, {
      exhibition: {
        id: updatedData.id,
        status: updatedData.status,
        published_at: updatedData.published_at,
        updated_at: updatedData.updated_at,
      },
    });
  } catch (error) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', mapUnknownError(error, '승인 처리 중 오류가 발생했습니다.'));
  }
}
