import type { NextApiRequest, NextApiResponse } from 'next';
import type { ReviewRecord } from '../../../lib/reviews';
import { parseReviewPayload } from '../../../lib/reviews';
import { sendApiError, sendApiSuccess } from '../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../lib/supabase-server';

type ErrorResponse = { error: string; errorCode: string };
type SuccessResponse = { data: { review: ReviewRecord } };

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

  const parsed = parseReviewPayload(req.body, { requireExhibitionId: true, allowReviewId: true });
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

    const payload = parsed.value;
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        id: payload.reviewId,
        exhibition_id: payload.exhibitionId,
        user_id: authData.user.id,
        rating: payload.rating,
        one_line_review: payload.oneLineReview,
        detailed_review: payload.longReview,
        recommended_for: payload.recommendedFor,
        visit_duration: payload.visitDuration,
        revisit_intent: payload.revisitIntent,
        crowd_level: payload.crowdLevel,
        review_image_paths: payload.reviewImagePaths,
      })
      .select(
        `
          id,
          exhibition_id,
          user_id,
          rating,
          one_line_review,
          detailed_review,
          recommended_for,
          visit_duration,
          revisit_intent,
          crowd_level,
          review_image_paths,
          created_at
        `,
      )
      .single();

    if (error) {
      const isDuplicate = error.code === '23505' || error.message.includes('reviews_exhibition_id_user_id_key');
      if (isDuplicate) {
        return sendApiError(res, 409, 'CONFLICT', '이미 이 전시에 리뷰를 작성했습니다. 기존 리뷰를 수정해주세요.');
      }
      return sendApiError(res, 400, 'BAD_REQUEST', error.message);
    }

    return sendApiSuccess(res, 201, { review: data as ReviewRecord });
  } catch (error) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', mapUnknownError(error, '리뷰 저장 중 오류가 발생했습니다.'));
  }
}
