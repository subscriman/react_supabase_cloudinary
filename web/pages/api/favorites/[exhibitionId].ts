import type { NextApiRequest, NextApiResponse } from 'next';
import { getFavoriteExhibitionId } from '../../../lib/favorites';
import { sendApiError, sendApiSuccess } from '../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../lib/supabase-server';

type ErrorResponse = { error: string; errorCode: string };
type SuccessResponse = { data: { deletedId: string } };

function mapUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>,
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return sendApiError(res, 405, 'METHOD_NOT_ALLOWED', '허용되지 않은 메서드입니다.');
  }

  const exhibitionId = getFavoriteExhibitionId(req.query.exhibitionId);
  if (!exhibitionId) {
    return sendApiError(res, 400, 'INVALID_INPUT', '전시 ID가 필요합니다.');
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

    const { data: deleted, error } = await supabase
      .from('exhibition_favorites')
      .delete()
      .eq('exhibition_id', exhibitionId)
      .eq('user_id', authData.user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return sendApiError(res, 400, 'BAD_REQUEST', error.message);
    }
    if (!deleted) {
      return sendApiError(res, 404, 'NOT_FOUND', '찜 내역을 찾지 못했습니다.');
    }

    return sendApiSuccess(res, 200, {
      deletedId: deleted.id as string,
    });
  } catch (error) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', mapUnknownError(error, '찜 삭제 중 오류가 발생했습니다.'));
  }
}
