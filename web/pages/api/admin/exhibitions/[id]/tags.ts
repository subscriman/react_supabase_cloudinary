import type { NextApiRequest, NextApiResponse } from 'next';
import { sendApiError, sendApiSuccess } from '../../../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../../../lib/supabase-server';

type ErrorResponse = { error: string; errorCode: string };
type SuccessResponse = { data: { tagIds: string[] } };

function getExhibitionId(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTagIds(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const normalized = input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return Array.from(new Set(normalized));
}

function mapUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>,
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return sendApiError(res, 405, 'METHOD_NOT_ALLOWED', '허용되지 않은 메서드입니다.');
  }

  const exhibitionId = getExhibitionId(req.query.id);
  if (!exhibitionId) {
    return sendApiError(res, 400, 'INVALID_INPUT', '전시 ID가 필요합니다.');
  }

  const accessToken = getBearerTokenFromHeader(req.headers.authorization);
  if (!accessToken) {
    return sendApiError(res, 401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  }

  const tagIds = toTagIds((req.body as Record<string, unknown> | undefined)?.tagIds);
  if (!tagIds || tagIds.length > 50) {
    return sendApiError(res, 400, 'INVALID_INPUT', '태그 목록 형식이 올바르지 않습니다.');
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
      return sendApiError(res, 403, 'FORBIDDEN', '관리자만 태그를 수정할 수 있습니다.');
    }

    if (tagIds.length > 0) {
      const { data: tagsData, error: tagsError } = await supabase.from('tags').select('id').in('id', tagIds);
      if (tagsError) {
        return sendApiError(res, 400, 'BAD_REQUEST', tagsError.message);
      }
      const foundIds = new Set((tagsData ?? []).map((item: any) => item.id as string));
      if (foundIds.size !== tagIds.length) {
        return sendApiError(res, 400, 'INVALID_INPUT', '존재하지 않는 태그가 포함되어 있습니다.');
      }
    }

    const { error: deleteError } = await supabase.from('exhibition_tags').delete().eq('exhibition_id', exhibitionId);
    if (deleteError) {
      return sendApiError(res, 400, 'BAD_REQUEST', deleteError.message);
    }

    if (tagIds.length > 0) {
      const rows = tagIds.map((tagId) => ({
        exhibition_id: exhibitionId,
        tag_id: tagId,
      }));

      const { error: insertError } = await supabase.from('exhibition_tags').insert(rows);
      if (insertError) {
        return sendApiError(res, 400, 'BAD_REQUEST', insertError.message);
      }
    }

    return sendApiSuccess(res, 200, { tagIds });
  } catch (error) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', mapUnknownError(error, '태그 저장 중 오류가 발생했습니다.'));
  }
}
