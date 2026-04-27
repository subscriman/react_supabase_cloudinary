import type { NextApiRequest, NextApiResponse } from 'next';
import type { ReviewRecord } from '../../../lib/reviews';
import { parseReviewPayload } from '../../../lib/reviews';
import { sendApiError, sendApiSuccess } from '../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../lib/supabase-server';
import { STORAGE_BUCKETS } from '../../../lib/storage-policy';

type ErrorResponse = { error: string; errorCode: string };
type SuccessResponse = { data: { review?: ReviewRecord; deletedId?: string } };

function mapUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function getReviewId(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePaths(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>,
) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'PATCH, DELETE');
    return sendApiError(res, 405, 'METHOD_NOT_ALLOWED', '허용되지 않은 메서드입니다.');
  }

  const reviewId = getReviewId(req.query.id);
  if (!reviewId) {
    return sendApiError(res, 400, 'INVALID_INPUT', '리뷰 ID가 필요합니다.');
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

    if (req.method === 'DELETE') {
      const { data, error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', authData.user.id)
        .select('id, review_image_paths')
        .maybeSingle();

      if (error) {
        return sendApiError(res, 400, 'BAD_REQUEST', error.message);
      }
      if (!data) {
        return sendApiError(res, 404, 'NOT_FOUND', '삭제할 리뷰를 찾지 못했습니다.');
      }

      const imagePaths = normalizePaths(data.review_image_paths);
      if (imagePaths.length > 0) {
        const { error: storageError } = await supabase.storage.from(STORAGE_BUCKETS.reviewImages).remove(imagePaths);
        if (storageError) {
          console.error('[reviews.delete] review image cleanup failed:', storageError.message);
        }
      }

      return sendApiSuccess(res, 200, { deletedId: data.id });
    }

    const parsed = parseReviewPayload(req.body, { requireExhibitionId: false });
    if (!parsed.ok) {
      const errorMessage = 'error' in parsed ? parsed.error : '요청 값이 올바르지 않습니다.';
      return sendApiError(res, 400, 'INVALID_INPUT', errorMessage);
    }

    const payload = parsed.value;
    const { data: existing, error: existingError } = await supabase
      .from('reviews')
      .select('id, review_image_paths')
      .eq('id', reviewId)
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (existingError) {
      return sendApiError(res, 400, 'BAD_REQUEST', existingError.message);
    }
    if (!existing) {
      return sendApiError(res, 404, 'NOT_FOUND', '수정할 리뷰를 찾지 못했습니다.');
    }

    const beforeImagePaths = normalizePaths(existing.review_image_paths);

    const { data, error } = await supabase
      .from('reviews')
      .update({
        rating: payload.rating,
        one_line_review: payload.oneLineReview,
        detailed_review: payload.longReview,
        recommended_for: payload.recommendedFor,
        visit_duration: payload.visitDuration,
        revisit_intent: payload.revisitIntent,
        crowd_level: payload.crowdLevel,
        review_image_paths: payload.reviewImagePaths,
      })
      .eq('id', reviewId)
      .eq('user_id', authData.user.id)
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
      .maybeSingle();

    if (error) {
      return sendApiError(res, 400, 'BAD_REQUEST', error.message);
    }
    if (!data) {
      return sendApiError(res, 404, 'NOT_FOUND', '수정할 리뷰를 찾지 못했습니다.');
    }

    const afterPathSet = new Set(payload.reviewImagePaths);
    const removedPaths = beforeImagePaths.filter((path) => !afterPathSet.has(path));
    if (removedPaths.length > 0) {
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKETS.reviewImages).remove(removedPaths);
      if (storageError) {
        console.error('[reviews.patch] review image cleanup failed:', storageError.message);
      }
    }

    return sendApiSuccess(res, 200, { review: data as ReviewRecord });
  } catch (error) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', mapUnknownError(error, '리뷰 처리 중 오류가 발생했습니다.'));
  }
}
