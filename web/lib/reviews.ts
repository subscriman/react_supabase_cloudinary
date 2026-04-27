import type {
  ExhibitionReview,
  ReviewCrowdLevel,
  ReviewRecommendedFor,
  ReviewRevisitIntent,
  ReviewSortOption,
  ReviewVisitDuration,
} from './shared-types';

export const REVIEW_RECOMMENDED_FOR_OPTIONS: ReviewRecommendedFor[] = ['혼자', '친구와', '데이트', '가족'];
export const REVIEW_VISIT_DURATION_OPTIONS: ReviewVisitDuration[] = ['30분', '1시간', '2시간 이상'];
export const REVIEW_REVISIT_INTENT_OPTIONS: ReviewRevisitIntent[] = ['있음', '보통', '없음'];
export const REVIEW_CROWD_LEVEL_OPTIONS: ReviewCrowdLevel[] = ['여유', '보통', '혼잡'];
export const MAX_REVIEW_IMAGE_COUNT = 4;
export const MAX_REVIEW_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_REVIEW_LONG_TEXT_LENGTH = 3000;
export const REVIEW_IMAGE_ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVIEW_IMAGE_PATH_REGEX = /^reviews\/[a-z0-9-]+\/[a-z0-9-]+\/image-\d+\.(webp|jpg|png)$/;

export const REVIEW_SORT_OPTIONS: Array<{ value: ReviewSortOption; label: string }> = [
  { value: 'latest', label: '최신순' },
  { value: 'rating', label: '평점순' },
];

export type ReviewRecord = {
  id: string;
  exhibition_id: string;
  user_id: string;
  rating: number | string;
  one_line_review: string;
  detailed_review: string | null;
  recommended_for: ReviewRecommendedFor | null;
  visit_duration: ReviewVisitDuration | null;
  revisit_intent: ReviewRevisitIntent | null;
  crowd_level: ReviewCrowdLevel | null;
  review_image_paths: string[] | null;
  created_at: string;
};

export type ReviewDraft = {
  rating: number;
  oneLineReview: string;
  longReview: string;
  recommendedFor: '' | ReviewRecommendedFor;
  visitDuration: '' | ReviewVisitDuration;
  revisitIntent: '' | ReviewRevisitIntent;
  crowdLevel: '' | ReviewCrowdLevel;
  reviewImagePaths: string[];
};

export type ReviewUpsertPayload = {
  exhibitionId: string;
  reviewId?: string;
  rating: number;
  oneLineReview: string;
  longReview: string | null;
  recommendedFor: ReviewRecommendedFor | null;
  visitDuration: ReviewVisitDuration | null;
  revisitIntent: ReviewRevisitIntent | null;
  crowdLevel: ReviewCrowdLevel | null;
  reviewImagePaths: string[];
};

export const DEFAULT_REVIEW_DRAFT: ReviewDraft = {
  rating: 4,
  oneLineReview: '',
  longReview: '',
  recommendedFor: '',
  visitDuration: '',
  revisitIntent: '',
  crowdLevel: '',
  reviewImagePaths: [],
};

export function toReviewDraft(review?: ExhibitionReview | null): ReviewDraft {
  if (!review) {
    return { ...DEFAULT_REVIEW_DRAFT };
  }

  return {
    rating: review.rating,
    oneLineReview: review.oneLineReview,
    longReview: review.longReview ?? '',
    recommendedFor: review.recommendedFor ?? '',
    visitDuration: review.visitDuration ?? '',
    revisitIntent: review.revisitIntent ?? '',
    crowdLevel: review.crowdLevel ?? '',
    reviewImagePaths: review.reviewImagePaths ?? [],
  };
}

export function reviewDraftToPayload(exhibitionId: string, draft: ReviewDraft): ReviewUpsertPayload {
  return {
    exhibitionId,
    rating: draft.rating,
    oneLineReview: draft.oneLineReview.trim(),
    longReview: draft.longReview.trim().length > 0 ? draft.longReview.trim() : null,
    recommendedFor: draft.recommendedFor || null,
    visitDuration: draft.visitDuration || null,
    revisitIntent: draft.revisitIntent || null,
    crowdLevel: draft.crowdLevel || null,
    reviewImagePaths: Array.from(new Set(draft.reviewImagePaths)),
  };
}

function parseNullableOption<T extends string>(input: unknown, options: readonly T[]): T | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input === '') return null;
  if (typeof input !== 'string') return undefined;
  return options.includes(input as T) ? (input as T) : undefined;
}

function toHalfPointRating(input: unknown): number | null {
  const parsed = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0.5 || parsed > 5) return null;
  if (Math.round(parsed * 2) !== parsed * 2) return null;
  return Number(parsed.toFixed(1));
}

export function parseReviewPayload(
  input: unknown,
  options: { requireExhibitionId: boolean; allowReviewId?: boolean },
): { ok: true; value: ReviewUpsertPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  }

  const body = input as Record<string, unknown>;
  const exhibitionIdRaw = body.exhibitionId;
  const exhibitionId =
    typeof exhibitionIdRaw === 'string' && exhibitionIdRaw.trim().length > 0 ? exhibitionIdRaw.trim() : '';

  if (options.requireExhibitionId && exhibitionId.length === 0) {
    return { ok: false, error: '전시 정보가 누락되었습니다.' };
  }

  let reviewId: string | undefined;
  if (options.allowReviewId && body.reviewId !== undefined) {
    if (typeof body.reviewId !== 'string' || !UUID_REGEX.test(body.reviewId.trim())) {
      return { ok: false, error: '리뷰 ID 형식이 올바르지 않습니다.' };
    }
    reviewId = body.reviewId.trim();
  }

  const rating = toHalfPointRating(body.rating);
  if (rating === null) {
    return { ok: false, error: '별점은 0.5점 단위로 0.5~5.0 사이여야 합니다.' };
  }

  const oneLineReviewRaw = body.oneLineReview;
  const oneLineReview = typeof oneLineReviewRaw === 'string' ? oneLineReviewRaw.trim() : '';
  if (oneLineReview.length < 1 || oneLineReview.length > 280) {
    return { ok: false, error: '한줄 총평은 1자 이상 280자 이하여야 합니다.' };
  }

  const longReviewRaw = body.longReview;
  if (longReviewRaw !== undefined && longReviewRaw !== null && typeof longReviewRaw !== 'string') {
    return { ok: false, error: '긴 리뷰 값이 올바르지 않습니다.' };
  }
  const longReviewNormalized = typeof longReviewRaw === 'string' ? longReviewRaw.trim() : '';
  if (longReviewNormalized.length > MAX_REVIEW_LONG_TEXT_LENGTH) {
    return { ok: false, error: `긴 리뷰는 ${MAX_REVIEW_LONG_TEXT_LENGTH}자 이하여야 합니다.` };
  }
  const longReview = longReviewNormalized.length > 0 ? longReviewNormalized : null;

  const recommendedFor = parseNullableOption(body.recommendedFor, REVIEW_RECOMMENDED_FOR_OPTIONS);
  if (recommendedFor === undefined) {
    return { ok: false, error: '추천 대상 값이 올바르지 않습니다.' };
  }

  const visitDuration = parseNullableOption(body.visitDuration, REVIEW_VISIT_DURATION_OPTIONS);
  if (visitDuration === undefined) {
    return { ok: false, error: '예상 관람 시간 값이 올바르지 않습니다.' };
  }

  const revisitIntent = parseNullableOption(body.revisitIntent, REVIEW_REVISIT_INTENT_OPTIONS);
  if (revisitIntent === undefined) {
    return { ok: false, error: '재방문 의사 값이 올바르지 않습니다.' };
  }

  const crowdLevel = parseNullableOption(body.crowdLevel, REVIEW_CROWD_LEVEL_OPTIONS);
  if (crowdLevel === undefined) {
    return { ok: false, error: '혼잡도 값이 올바르지 않습니다.' };
  }

  const reviewImagePathsRaw = body.reviewImagePaths;
  if (reviewImagePathsRaw !== undefined && !Array.isArray(reviewImagePathsRaw)) {
    return { ok: false, error: '리뷰 사진 경로 형식이 올바르지 않습니다.' };
  }

  const reviewImagePaths = Array.isArray(reviewImagePathsRaw)
    ? reviewImagePathsRaw
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0)
    : [];

  if (reviewImagePaths.length > MAX_REVIEW_IMAGE_COUNT) {
    return { ok: false, error: `리뷰 사진은 최대 ${MAX_REVIEW_IMAGE_COUNT}장까지 첨부할 수 있습니다.` };
  }

  if (
    reviewImagePaths.some(
      (path) => path.length > 260 || !REVIEW_IMAGE_PATH_REGEX.test(path) || path.includes('..') || path.startsWith('/'),
    )
  ) {
    return { ok: false, error: '리뷰 사진 경로가 올바르지 않습니다.' };
  }

  if (new Set(reviewImagePaths).size !== reviewImagePaths.length) {
    return { ok: false, error: '리뷰 사진 경로에 중복 값이 있습니다.' };
  }

  return {
    ok: true,
    value: {
      exhibitionId,
      reviewId,
      rating,
      oneLineReview,
      longReview,
      recommendedFor,
      visitDuration,
      revisitIntent,
      crowdLevel,
      reviewImagePaths,
    },
  };
}

export function mapReviewRecordToExhibitionReview(
  row: ReviewRecord,
  options?: { authorName?: string | null; reviewImageUrls?: string[] | null },
): ExhibitionReview {
  const reviewImagePaths = Array.isArray(row.review_image_paths)
    ? row.review_image_paths.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
    : [];
  const reviewImageUrlsRaw = options?.reviewImageUrls ?? [];
  const reviewImageUrls = reviewImagePaths.map((_, index) => {
    const picked = reviewImageUrlsRaw[index];
    return typeof picked === 'string' ? picked : '';
  });

  return {
    id: row.id,
    rating: Number(row.rating),
    oneLineReview: row.one_line_review,
    longReview: row.detailed_review,
    recommendedFor: row.recommended_for,
    visitDuration: row.visit_duration,
    revisitIntent: row.revisit_intent,
    crowdLevel: row.crowd_level,
    reviewImagePaths,
    reviewImageUrls,
    createdAt: row.created_at,
    authorName: options?.authorName ?? 'ArtTomato 유저',
    authorId: row.user_id ?? null,
  };
}

export function sortExhibitionReviews(
  reviews: ExhibitionReview[],
  sort: ReviewSortOption,
): ExhibitionReview[] {
  const copied = [...reviews];
  if (sort === 'rating') {
    copied.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return copied;
  }

  copied.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return copied;
}
