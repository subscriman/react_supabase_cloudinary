import type { NextApiRequest, NextApiResponse } from 'next';
import type { StartAlertRecord } from '../../../lib/start-alerts';
import { parseStartAlertPayload } from '../../../lib/start-alerts';
import { sendApiError, sendApiSuccess } from '../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../lib/supabase-server';

type ErrorResponse = { error: string; errorCode: string };
type SuccessResponse = { data: { alert: StartAlertRecord } };

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

  const parsed = parseStartAlertPayload(req.body);
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

    const { data: exhibition, error: exhibitionError } = await supabase
      .from('exhibitions')
      .select('id, status, start_date, published_at')
      .eq('id', parsed.exhibitionId)
      .maybeSingle();
    if (exhibitionError) {
      return sendApiError(res, 400, 'BAD_REQUEST', exhibitionError.message);
    }
    if (!exhibition) {
      return sendApiError(res, 404, 'NOT_FOUND', '전시를 찾지 못했습니다.');
    }

    const status = String(exhibition.status || '');
    if (status !== 'upcoming') {
      return sendApiError(res, 409, 'CONFLICT', '예정 전시에만 시작 알림을 신청할 수 있습니다.');
    }
    if (!exhibition.published_at) {
      return sendApiError(res, 409, 'CONFLICT', '공개된 전시에만 시작 알림을 신청할 수 있습니다.');
    }

    const { data: inserted, error } = await supabase
      .from('exhibition_start_alerts')
      .insert({
        exhibition_id: parsed.exhibitionId,
        user_id: authData.user.id,
        notify_days_before: parsed.notifyDaysBefore,
      })
      .select('id, exhibition_id, user_id, notify_days_before, sent_at, created_at')
      .single();

    if (error) {
      const isDuplicate =
        error.code === '23505' || error.message.includes('exhibition_start_alerts_exhibition_id_user_id_key');
      if (isDuplicate) {
        return sendApiError(res, 409, 'CONFLICT', '이미 시작 알림을 신청한 전시입니다.');
      }
      return sendApiError(res, 400, 'BAD_REQUEST', error.message);
    }

    return sendApiSuccess(res, 201, {
      alert: inserted as StartAlertRecord,
    });
  } catch (error) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', mapUnknownError(error, '시작 알림 신청 중 오류가 발생했습니다.'));
  }
}
