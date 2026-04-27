export const STORAGE_BUCKETS = {
  exhibitionAssets: 'exhibition-assets',
  reviewImages: 'review-images',
  profileAvatars: 'profile-avatars',
} as const;

const FILE_NAME_SAFE = /[^a-z0-9-_]/g;

function toSafeSegment(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(FILE_NAME_SAFE, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toFileName(value: string, fallback: string) {
  const normalized = toSafeSegment(value);
  return normalized || fallback;
}

export function buildExhibitionPosterPath(params: {
  sourceSiteKey: string;
  exhibitionSlug: string;
  extension?: 'webp' | 'jpg' | 'png';
  date?: Date;
}) {
  const extension = params.extension || 'webp';
  const now = params.date || new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const slug = toFileName(params.exhibitionSlug, 'untitled-exhibition');
  const site = toFileName(params.sourceSiteKey, 'unknown-site');
  return `posters/${site}/${yyyy}/${mm}/${slug}.${extension}`;
}

export function buildReviewImagePath(params: {
  userId: string;
  reviewId: string;
  index?: number;
  extension?: 'webp' | 'jpg' | 'png';
}) {
  const extension = params.extension || 'webp';
  const userId = toFileName(params.userId, 'unknown-user');
  const reviewId = toFileName(params.reviewId, 'unknown-review');
  const index = Number.isFinite(params.index) ? Math.max(0, Number(params.index)) : 0;
  return `reviews/${userId}/${reviewId}/image-${index + 1}.${extension}`;
}

export function buildAvatarPath(params: {
  userId: string;
  extension?: 'webp' | 'jpg' | 'png';
}) {
  const extension = params.extension || 'webp';
  const userId = toFileName(params.userId, 'unknown-user');
  return `avatars/${userId}/profile.${extension}`;
}
