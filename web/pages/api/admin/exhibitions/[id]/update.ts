import type { NextApiRequest, NextApiResponse } from 'next';
import {
  parseAdminExhibitionUpdatePayload,
  type AdminExhibitionEditableRow,
} from '../../../../../lib/admin-exhibitions';
import { sendApiError, sendApiSuccess } from '../../../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../../../lib/supabase-server';

type ErrorResponse = { error: string; errorCode: string };
type SuccessResponse = { data: { exhibition: AdminExhibitionEditableRow } };

function getExhibitionId(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>,
) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
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

  const parsed = parseAdminExhibitionUpdatePayload(req.body);
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

    if (profileError) {
      return sendApiError(res, 403, 'FORBIDDEN', '관리자 권한을 확인할 수 없습니다.');
    }
    if (profileData?.role !== 'admin') {
      return sendApiError(res, 403, 'FORBIDDEN', '관리자만 수정할 수 있습니다.');
    }

    const payload = parsed.value;
    const { data, error } = await supabase
      .from('exhibitions')
      .update({
        title: payload.title,
        subtitle: payload.subtitle,
        start_date: payload.startDate,
        end_date: payload.endDate,
        operating_hours: payload.operatingHours,
        admission_fee: payload.admissionFee,
        summary: payload.summary,
        description: payload.description,
        official_url: payload.officialUrl,
        booking_url: payload.bookingUrl,
        poster_image_url: payload.posterImageUrl,
      })
      .eq('id', exhibitionId)
      .select(
        `
          id,
          slug,
          title,
          subtitle,
          status,
          start_date,
          end_date,
          operating_hours,
          admission_fee,
          summary,
          description,
          official_url,
          booking_url,
          poster_image_url,
          updated_at,
          published_at
        `,
      )
      .maybeSingle();

    if (error) {
      return sendApiError(res, 400, 'BAD_REQUEST', error.message);
    }
    if (!data) {
      return sendApiError(res, 404, 'NOT_FOUND', '수정할 전시를 찾지 못했습니다.');
    }

    return sendApiSuccess(res, 200, { exhibition: data as AdminExhibitionEditableRow });
  } catch (error) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', mapUnknownError(error, '전시 수정 중 오류가 발생했습니다.'));
  }
}
