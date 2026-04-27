import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { ExhibitionReview } from '../lib/shared-types';
import {
  DEFAULT_REVIEW_DRAFT,
  MAX_REVIEW_IMAGE_BYTES,
  MAX_REVIEW_IMAGE_COUNT,
  REVIEW_CROWD_LEVEL_OPTIONS,
  REVIEW_IMAGE_ACCEPTED_MIME_TYPES,
  REVIEW_RECOMMENDED_FOR_OPTIONS,
  REVIEW_REVISIT_INTENT_OPTIONS,
  REVIEW_VISIT_DURATION_OPTIONS,
  mapReviewRecordToExhibitionReview,
  reviewDraftToPayload,
  toReviewDraft,
  type ReviewRecord,
} from '../lib/reviews';
import { trackEvent } from '../lib/analytics';
import { supabase } from '../lib/supabase';
import { buildReviewImagePath, STORAGE_BUCKETS } from '../lib/storage-policy';

type ReviewComposerProps = {
  exhibitionId: string;
  session: Session | null;
  user: User | null;
  myReview: ExhibitionReview | null;
  onReviewSaved: (review: ExhibitionReview) => void;
  onReviewDeleted: (reviewId: string) => void;
};

type ApiErrorResponse = {
  error?: string;
  errorCode?: string;
};

type ApiSuccessResponse = {
  data?: {
    review?: ReviewRecord;
    deletedId?: string;
  };
  review?: ReviewRecord;
  deletedId?: string;
};

type UploadExtension = 'webp' | 'jpg' | 'png';

type PendingReviewImage = {
  id: string;
  file: File;
  previewUrl: string;
  extension: UploadExtension;
};

const FILE_EXTENSION_BY_MIME: Record<(typeof REVIEW_IMAGE_ACCEPTED_MIME_TYPES)[number], UploadExtension> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const RATING_OPTIONS = Array.from({ length: 10 }, (_, index) => {
  const value = (index + 1) / 2;
  return {
    value,
    label: `${value.toFixed(1)}점`,
  };
});

export default function ReviewComposer({
  exhibitionId,
  session,
  user,
  myReview,
  onReviewSaved,
  onReviewDeleted,
}: ReviewComposerProps) {
  const [draft, setDraft] = useState(toReviewDraft(myReview));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<PendingReviewImage[]>([]);
  const pendingImagesRef = useRef<PendingReviewImage[]>([]);

  const isEditMode = Boolean(myReview);
  const hasToken = Boolean(session?.access_token);
  const oneLineCount = draft.oneLineReview.trim().length;
  const longReviewCount = draft.longReview.trim().length;
  const totalImageCount = draft.reviewImagePaths.length + pendingImages.length;
  const authorName = useMemo(() => {
    if (!user?.email) return '나';
    const localPart = user.email.split('@')[0] ?? '';
    return localPart.length > 0 ? localPart : '나';
  }, [user?.email]);
  const savedImageUrlByPath = useMemo(() => {
    const map = new Map<string, string>();
    if (!myReview) return map;
    myReview.reviewImagePaths.forEach((path, index) => {
      const url = myReview.reviewImageUrls[index];
      if (typeof path === 'string' && path.length > 0 && typeof url === 'string' && url.length > 0) {
        map.set(path, url);
      }
    });
    return map;
  }, [myReview]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(
    () => () => {
      for (const item of pendingImagesRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    },
    [],
  );

  useEffect(() => {
    setDraft(toReviewDraft(myReview));
    setError(null);
    setMessage(null);
    setPendingImages((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
  }, [myReview]);

  const clearPendingImages = () => {
    setPendingImages((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
  };

  const cleanupUploadedImages = async (paths: string[]) => {
    if (paths.length === 0) return;
    await supabase.storage.from(STORAGE_BUCKETS.reviewImages).remove(paths);
  };

  const createSignedReviewImageUrls = async (paths: string[]) => {
    if (!paths.length) return [];
    const { data, error: signedError } = await supabase.storage
      .from(STORAGE_BUCKETS.reviewImages)
      .createSignedUrls(paths, 60 * 60);

    if (signedError) {
      return paths.map(() => '');
    }
    return paths.map((_, index) => data?.[index]?.signedUrl ?? '');
  };

  const uploadPendingImages = async (reviewId: string, startingIndex: number) => {
    if (!user) return [];
    const uploadedPaths: string[] = [];
    const indexSeed = Date.now();

    try {
      for (let index = 0; index < pendingImages.length; index += 1) {
        const item = pendingImages[index];
        const storagePath = buildReviewImagePath({
          userId: user.id,
          reviewId,
          index: indexSeed + startingIndex + index,
          extension: item.extension,
        });
        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKETS.reviewImages).upload(storagePath, item.file, {
          contentType: item.file.type,
          upsert: false,
        });
        if (uploadError) {
          throw uploadError;
        }
        uploadedPaths.push(storagePath);
      }
      return uploadedPaths;
    } catch (uploadError) {
      await cleanupUploadedImages(uploadedPaths);
      throw uploadError;
    }
  };

  const handleAddImages = (event: ChangeEvent<HTMLInputElement>) => {
    const inputFiles = Array.from(event.target.files ?? []);
    event.currentTarget.value = '';
    if (inputFiles.length === 0) return;

    setError(null);
    setMessage(null);

    const availableSlots = MAX_REVIEW_IMAGE_COUNT - (draft.reviewImagePaths.length + pendingImages.length);
    if (availableSlots <= 0) {
      setError(`리뷰 사진은 최대 ${MAX_REVIEW_IMAGE_COUNT}장까지 첨부할 수 있습니다.`);
      return;
    }

    const nextPending: PendingReviewImage[] = [];
    const errors: string[] = [];

    for (let index = 0; index < inputFiles.length; index += 1) {
      const file = inputFiles[index];
      if (nextPending.length >= availableSlots) {
        errors.push(`최대 ${MAX_REVIEW_IMAGE_COUNT}장까지만 첨부할 수 있습니다.`);
        break;
      }
      if (!REVIEW_IMAGE_ACCEPTED_MIME_TYPES.includes(file.type as (typeof REVIEW_IMAGE_ACCEPTED_MIME_TYPES)[number])) {
        errors.push(`${file.name}: JPG/PNG/WEBP 형식만 첨부할 수 있습니다.`);
        continue;
      }
      if (file.size > MAX_REVIEW_IMAGE_BYTES) {
        errors.push(`${file.name}: 파일 크기는 5MB 이하여야 합니다.`);
        continue;
      }

      const extension = FILE_EXTENSION_BY_MIME[file.type as (typeof REVIEW_IMAGE_ACCEPTED_MIME_TYPES)[number]];
      if (!extension) {
        errors.push(`${file.name}: 지원하지 않는 파일 형식입니다.`);
        continue;
      }

      nextPending.push({
        id: `pending-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        extension,
      });
    }

    if (nextPending.length > 0) {
      setPendingImages((prev) => [...prev, ...nextPending]);
    }
    if (errors.length > 0) {
      setError(errors[0]);
    }
  };

  const handleRemoveSavedImage = (path: string) => {
    setDraft((prev) => ({
      ...prev,
      reviewImagePaths: prev.reviewImagePaths.filter((item) => item !== path),
    }));
  };

  const handleRemovePendingImage = (targetId: string) => {
    setPendingImages((prev) => {
      const target = prev.find((item) => item.id === targetId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== targetId);
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !hasToken || !session?.access_token) {
      setError('리뷰 작성은 로그인 후 가능합니다.');
      return;
    }

    const payload = reviewDraftToPayload(exhibitionId, draft);
    const isEditing = Boolean(myReview);

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      let finalReviewRecord: ReviewRecord | null = null;
      const uploadedPaths: string[] = [];

      if (isEditing && myReview) {
        let nextImagePaths = payload.reviewImagePaths;

        if (pendingImages.length > 0) {
          const createdPaths = await uploadPendingImages(myReview.id, nextImagePaths.length);
          uploadedPaths.push(...createdPaths);
          nextImagePaths = [...nextImagePaths, ...createdPaths];
        }

        const response = await fetch(`/api/reviews/${myReview.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...payload,
            reviewImagePaths: nextImagePaths,
          }),
        });
        const responseBody = ((await response.json().catch(() => ({}))) ?? {}) as ApiErrorResponse & ApiSuccessResponse;
        const review = responseBody.data?.review ?? responseBody.review;
        if (!response.ok || !review) {
          await cleanupUploadedImages(uploadedPaths);
          setError(responseBody.error ?? '리뷰 저장에 실패했습니다.');
          return;
        }
        finalReviewRecord = review;
      } else {
        let createPayload = payload;
        if (pendingImages.length > 0) {
          const reviewId = crypto.randomUUID();
          const createdPaths = await uploadPendingImages(reviewId, 0);
          uploadedPaths.push(...createdPaths);
          createPayload = {
            ...payload,
            reviewId,
            reviewImagePaths: createdPaths,
          };
        }

        const response = await fetch('/api/reviews', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(createPayload),
        });

        const responseBody = ((await response.json().catch(() => ({}))) ?? {}) as ApiErrorResponse & ApiSuccessResponse;
        const review = responseBody.data?.review ?? responseBody.review;
        if (!response.ok || !review) {
          await cleanupUploadedImages(uploadedPaths);
          setError(responseBody.error ?? '리뷰 저장에 실패했습니다.');
          return;
        }
        finalReviewRecord = review;
      }

      if (!finalReviewRecord) {
        setError('리뷰 저장 결과를 확인할 수 없습니다.');
        return;
      }

      const savedPaths = Array.isArray(finalReviewRecord.review_image_paths)
        ? finalReviewRecord.review_image_paths
        : [];
      const signedUrls = await createSignedReviewImageUrls(savedPaths);
      const mapped = mapReviewRecordToExhibitionReview(finalReviewRecord, {
        authorName,
        reviewImageUrls: signedUrls,
      });

      onReviewSaved(mapped);
      setDraft(toReviewDraft(mapped));
      clearPendingImages();
      trackEvent('review_submit_success', {
        exhibition_id: exhibitionId,
        action: isEditing ? 'update' : 'create',
        image_count: mapped.reviewImagePaths.length,
        long_review_length: mapped.longReview?.length ?? 0,
      });
      setMessage(isEditing ? '리뷰를 수정했습니다.' : '리뷰를 등록했습니다.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '리뷰 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!myReview || !session?.access_token) return;
    const confirmed = window.confirm('작성한 리뷰를 삭제할까요?');
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/reviews/${myReview.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const responseBody = ((await response.json().catch(() => ({}))) ?? {}) as ApiErrorResponse & ApiSuccessResponse;
      const deletedId = responseBody.data?.deletedId ?? responseBody.deletedId;
      if (!response.ok || !deletedId) {
        setError(responseBody.error ?? '리뷰 삭제에 실패했습니다.');
        return;
      }

      onReviewDeleted(deletedId);
      setDraft({ ...DEFAULT_REVIEW_DRAFT });
      clearPendingImages();
      setMessage('리뷰를 삭제했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-medium">리뷰 남기기</h3>
        <p className="text-xs text-zinc-500">전시당 1개 리뷰만 작성할 수 있습니다.</p>
      </div>

      {!user ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-300">
          리뷰 작성은 로그인 후 이용할 수 있습니다.{' '}
          <Link href="/auth" className="underline">
            로그인하러 가기
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="rating" className="mb-1 block text-xs text-zinc-400">
              별점(0.5점 단위)
            </label>
            <select
              id="rating"
              value={draft.rating}
              onChange={(event) => setDraft((prev) => ({ ...prev, rating: Number(event.target.value) }))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
            >
              {RATING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="recommendedFor" className="mb-1 block text-xs text-zinc-400">
              관람 추천 대상
            </label>
            <select
              id="recommendedFor"
              value={draft.recommendedFor}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  recommendedFor: event.target.value as '' | (typeof REVIEW_RECOMMENDED_FOR_OPTIONS)[number],
                }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
            >
              <option value="">선택 안함</option>
              {REVIEW_RECOMMENDED_FOR_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="visitDuration" className="mb-1 block text-xs text-zinc-400">
              예상 관람 시간
            </label>
            <select
              id="visitDuration"
              value={draft.visitDuration}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  visitDuration: event.target.value as '' | (typeof REVIEW_VISIT_DURATION_OPTIONS)[number],
                }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
            >
              <option value="">선택 안함</option>
              {REVIEW_VISIT_DURATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="revisitIntent" className="mb-1 block text-xs text-zinc-400">
              재방문 의사
            </label>
            <select
              id="revisitIntent"
              value={draft.revisitIntent}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  revisitIntent: event.target.value as '' | (typeof REVIEW_REVISIT_INTENT_OPTIONS)[number],
                }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
            >
              <option value="">선택 안함</option>
              {REVIEW_REVISIT_INTENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="crowdLevel" className="mb-1 block text-xs text-zinc-400">
              혼잡도
            </label>
            <select
              id="crowdLevel"
              value={draft.crowdLevel}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  crowdLevel: event.target.value as '' | (typeof REVIEW_CROWD_LEVEL_OPTIONS)[number],
                }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
            >
              <option value="">선택 안함</option>
              {REVIEW_CROWD_LEVEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="oneLineReview" className="mb-1 block text-xs text-zinc-400">
              한줄 총평
            </label>
            <textarea
              id="oneLineReview"
              value={draft.oneLineReview}
              onChange={(event) => setDraft((prev) => ({ ...prev, oneLineReview: event.target.value }))}
              maxLength={280}
              required
              rows={3}
              placeholder="이 전시에 대한 한줄 총평을 남겨주세요."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400 focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-zinc-500">{oneLineCount} / 280</p>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="longReview" className="mb-1 block text-xs text-zinc-400">
              긴 리뷰 (선택)
            </label>
            <textarea
              id="longReview"
              value={draft.longReview}
              onChange={(event) => setDraft((prev) => ({ ...prev, longReview: event.target.value }))}
              maxLength={3000}
              rows={6}
              placeholder="전시 감상 포인트, 좋았던 점, 아쉬운 점 등을 길게 남겨주세요."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400 focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-zinc-500">{longReviewCount} / 3000</p>
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor="reviewImages" className="block text-xs text-zinc-400">
                리뷰 사진
              </label>
              <p className="text-xs text-zinc-500">
                {totalImageCount} / {MAX_REVIEW_IMAGE_COUNT}
              </p>
            </div>
            <input
              id="reviewImages"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleAddImages}
              disabled={submitting || totalImageCount >= MAX_REVIEW_IMAGE_COUNT}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200 hover:file:bg-zinc-700 focus:border-lime-400 focus:outline-none disabled:opacity-70"
            />
            <p className="mt-1 text-xs text-zinc-500">JPG/PNG/WEBP, 파일당 5MB 이하, 최대 4장</p>

            {totalImageCount > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {draft.reviewImagePaths.map((path, index) => {
                  const imageUrl = savedImageUrlByPath.get(path) ?? '';
                  return (
                    <div key={path} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60">
                      {imageUrl ? (
                        <img src={imageUrl} alt={`리뷰 사진 ${index + 1}`} className="h-32 w-full object-cover" />
                      ) : (
                        <div className="flex h-32 items-center justify-center px-3 text-center text-xs text-zinc-500">
                          미리보기 준비중
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveSavedImage(path)}
                        disabled={submitting}
                        className="w-full border-t border-zinc-800 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-70"
                      >
                        사진 제거
                      </button>
                    </div>
                  );
                })}

                {pendingImages.map((item, index) => (
                  <div key={item.id} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60">
                    <img src={item.previewUrl} alt={`업로드 예정 사진 ${index + 1}`} className="h-32 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePendingImage(item.id)}
                      disabled={submitting}
                      className="w-full border-t border-zinc-800 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-70"
                    >
                      업로드 취소
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-lime-300 disabled:opacity-70"
            >
              {submitting ? '처리 중...' : isEditMode ? '리뷰 수정 저장' : '리뷰 등록'}
            </button>
            {isEditMode ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-lg border border-rose-900 px-4 py-2 text-sm text-rose-300 hover:bg-rose-950/40 disabled:opacity-70"
              >
                리뷰 삭제
              </button>
            ) : null}
          </div>

          {message ? <p className="md:col-span-2 text-sm text-lime-300">{message}</p> : null}
          {error ? <p className="md:col-span-2 text-sm text-rose-300">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
