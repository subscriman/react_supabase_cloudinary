import type { NextApiRequest, NextApiResponse } from 'next';
import type { FavoriteRecord } from '../../../lib/favorites';
import { parseFavoritePayload } from '../../../lib/favorites';
import { sendApiError, sendApiSuccess } from '../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../lib/supabase-server';

type ErrorResponse = { error: string; errorCode: string };
type SuccessResponse = { data: { favorite: FavoriteRecord } };

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

  const parsed = parseFavoritePayload(req.body);
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

    const { data: inserted, error } = await supabase
      .from('exhibition_favorites')
      .insert({
        exhibition_id: parsed.exhibitionId,
        user_id: authData.user.id,
      })
      .select('id, exhibition_id, user_id, created_at')
      .single();

    if (error) {
      const isDuplicate =
        error.code === '23505' || error.message.includes('exhibition_favorites_exhibition_id_user_id_key');
      if (isDuplicate) {
        return sendApiError(res, 409, 'CONFLICT', '이미 찜한 전시입니다.');
      }
      return sendApiError(res, 400, 'BAD_REQUEST', error.message);
    }

    return sendApiSuccess(res, 201, {
      favorite: inserted as FavoriteRecord,
    });
  } catch (error) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', mapUnknownError(error, '찜 저장 중 오류가 발생했습니다.'));
  }
}
