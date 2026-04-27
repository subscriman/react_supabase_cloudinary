import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../hooks/useAuthSession';
import AuthTopBar from '../components/AuthTopBar';
import { formatDateTimeLocal } from '../lib/date-time';
import { STORAGE_BUCKETS } from '../lib/storage-policy';

type MyReviewItem = {
  id: string;
  rating: number;
  oneLineReview: string;
  longReview: string | null;
  recommendedFor: string | null;
  visitDuration: string | null;
  revisitIntent: string | null;
  crowdLevel: string | null;
  reviewImagePaths: string[];
  reviewImageUrls: string[];
  createdAt: string;
  exhibition: {
    title: string;
    slug: string;
  } | null;
};

type MyFavoriteItem = {
  id: string;
  createdAt: string;
  exhibition: {
    id: string;
    title: string;
    slug: string;
    posterImageUrl: string | null;
    startDate: string;
    endDate: string;
    venueName: string;
  } | null;
};

type MyStartAlertItem = {
  id: string;
  notifyDaysBefore: number;
  sentAt: string | null;
  createdAt: string;
  exhibition: {
    id: string;
    title: string;
    slug: string;
    startDate: string;
    venueName: string;
    status: string;
  } | null;
};

export default function MyPage() {
  const { user, session, loading } = useAuthSession();
  const [reviews, setReviews] = useState<MyReviewItem[]>([]);
  const [favorites, setFavorites] = useState<MyFavoriteItem[]>([]);
  const [startAlerts, setStartAlerts] = useState<MyStartAlertItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [startAlertError, setStartAlertError] = useState<string | null>(null);
  const [removingFavoriteId, setRemovingFavoriteId] = useState<string | null>(null);
  const [removingStartAlertId, setRemovingStartAlertId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setFetching(true);
      setReviewError(null);
      setFavoriteError(null);
      setStartAlertError(null);

      const [reviewResult, favoriteResult, startAlertResult] = await Promise.all([
        supabase
          .from('reviews')
          .select(
            `
              id,
              rating,
              one_line_review,
              detailed_review,
              recommended_for,
              visit_duration,
              revisit_intent,
              crowd_level,
              review_image_paths,
              created_at,
              exhibition:exhibitions (
                title,
                slug
              )
            `,
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('exhibition_favorites')
          .select(
            `
              id,
              created_at,
              exhibition:exhibitions (
                id,
                title,
                slug,
                poster_image_url,
                start_date,
                end_date,
                venues (
                  name
                )
              )
            `,
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('exhibition_start_alerts')
          .select(
            `
              id,
              notify_days_before,
              sent_at,
              created_at,
              exhibition:exhibitions (
                id,
                title,
                slug,
                start_date,
                status,
                venues (
                  name
                )
              )
            `,
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (reviewResult.error) {
        setReviewError(reviewResult.error.message);
      } else {
        const parsedReviews = (reviewResult.data ?? []).map((item: any) => ({
          id: item.id,
          rating: Number(item.rating),
          oneLineReview: item.one_line_review,
          longReview: item.detailed_review ?? null,
          recommendedFor: item.recommended_for,
          visitDuration: item.visit_duration,
          revisitIntent: item.revisit_intent,
          crowdLevel: item.crowd_level,
          reviewImagePaths: Array.isArray(item.review_image_paths)
            ? item.review_image_paths.filter(
                (path: unknown): path is string => typeof path === 'string' && path.trim().length > 0,
              )
            : [],
          reviewImageUrls: [],
          createdAt: item.created_at,
          exhibition: Array.isArray(item.exhibition) ? item.exhibition[0] ?? null : item.exhibition ?? null,
        })) as MyReviewItem[];

        const uniqueImagePaths = Array.from(new Set(parsedReviews.flatMap((item) => item.reviewImagePaths)));
        let signedUrlMap = new Map<string, string>();
        if (uniqueImagePaths.length > 0) {
          const { data: signedRows, error: signedError } = await supabase.storage
            .from(STORAGE_BUCKETS.reviewImages)
            .createSignedUrls(uniqueImagePaths, 60 * 60);
          if (signedError) {
            setReviewError(signedError.message);
          } else {
            signedUrlMap = new Map(
              uniqueImagePaths.map((path, index) => [path, signedRows?.[index]?.signedUrl ?? '']),
            );
          }
        }

        setReviews(
          parsedReviews.map((item) => ({
            id: item.id,
            rating: item.rating,
            oneLineReview: item.oneLineReview,
            longReview: item.longReview,
            recommendedFor: item.recommendedFor,
            visitDuration: item.visitDuration,
            revisitIntent: item.revisitIntent,
            crowdLevel: item.crowdLevel,
            reviewImagePaths: item.reviewImagePaths,
            reviewImageUrls: item.reviewImagePaths.map((path) => signedUrlMap.get(path) ?? ''),
            createdAt: item.createdAt,
            exhibition: item.exhibition,
          })),
        );
      }

      if (favoriteResult.error) {
        setFavoriteError(favoriteResult.error.message);
      } else {
        setFavorites(
          (favoriteResult.data ?? []).map((item: any) => {
            const rawExhibition = Array.isArray(item.exhibition) ? item.exhibition[0] ?? null : item.exhibition ?? null;
            const rawVenue = Array.isArray(rawExhibition?.venues) ? rawExhibition.venues[0] : rawExhibition?.venues;
            return {
              id: item.id,
              createdAt: item.created_at,
              exhibition: rawExhibition
                ? {
                    id: rawExhibition.id,
                    title: rawExhibition.title,
                    slug: rawExhibition.slug,
                    posterImageUrl: rawExhibition.poster_image_url ?? null,
                    startDate: rawExhibition.start_date,
                    endDate: rawExhibition.end_date,
                    venueName: rawVenue?.name ?? '장소 정보 없음',
                  }
                : null,
            } as MyFavoriteItem;
          }),
        );
      }

      if (startAlertResult.error) {
        setStartAlertError(startAlertResult.error.message);
      } else {
        setStartAlerts(
          (startAlertResult.data ?? []).map((item: any) => {
            const rawExhibition = Array.isArray(item.exhibition) ? item.exhibition[0] ?? null : item.exhibition ?? null;
            const rawVenue = Array.isArray(rawExhibition?.venues) ? rawExhibition.venues[0] : rawExhibition?.venues;
            return {
              id: item.id,
              notifyDaysBefore: Number(item.notify_days_before ?? 1),
              sentAt: item.sent_at ?? null,
              createdAt: item.created_at,
              exhibition: rawExhibition
                ? {
                    id: rawExhibition.id,
                    title: rawExhibition.title,
                    slug: rawExhibition.slug,
                    startDate: rawExhibition.start_date,
                    venueName: rawVenue?.name ?? '장소 정보 없음',
                    status: rawExhibition.status,
                  }
                : null,
            } as MyStartAlertItem;
          }),
        );
      }

      setFetching(false);
    };

    load();
  }, [user]);

  const handleRemoveFavorite = async (item: MyFavoriteItem) => {
    if (!item.exhibition?.id || !session?.access_token) {
      setFavoriteError('로그인 세션이 유효하지 않습니다. 다시 로그인해 주세요.');
      return;
    }

    setRemovingFavoriteId(item.id);
    setFavoriteError(null);
    try {
      const response = await fetch(`/api/favorites/${item.exhibition.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        const body = await response.json().catch(() => ({}));
        setFavoriteError(body?.error ?? '찜 해제에 실패했습니다.');
        return;
      }

      setFavorites((prev) => prev.filter((favorite) => favorite.id !== item.id));
    } finally {
      setRemovingFavoriteId(null);
    }
  };

  const handleRemoveStartAlert = async (item: MyStartAlertItem) => {
    if (!item.exhibition?.id || !session?.access_token) {
      setStartAlertError('로그인 세션이 유효하지 않습니다. 다시 로그인해 주세요.');
      return;
    }

    setRemovingStartAlertId(item.id);
    setStartAlertError(null);
    try {
      const response = await fetch(`/api/start-alerts/${item.exhibition.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        const body = await response.json().catch(() => ({}));
        setStartAlertError(body?.error ?? '시작 알림 해제에 실패했습니다.');
        return;
      }

      setStartAlerts((prev) => prev.filter((alert) => alert.id !== item.id));
    } finally {
      setRemovingStartAlertId(null);
    }
  };

  return (
    <>
      <Head>
        <title>마이페이지 | ArtTomato</title>
        <meta name="description" content="내가 작성한 전시 리뷰를 확인하세요." />
      </Head>

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
          <AuthTopBar />

          <header className="mb-6">
            <h1 className="text-2xl font-semibold md:text-3xl">마이페이지</h1>
            <p className="mt-2 text-sm text-zinc-400">내가 작성한 전시 리뷰를 확인할 수 있습니다.</p>
          </header>

          {loading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
              로그인 상태 확인 중...
            </div>
          ) : !user ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-300">
              로그인 후 이용할 수 있습니다.{' '}
              <Link href="/auth" className="underline">
                로그인하러 가기
              </Link>
            </div>
          ) : (
            <section className="space-y-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-300">
                <p>{user.email}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  총 리뷰 {reviews.length}개 · 찜한 전시 {favorites.length}개 · 시작 알림 {startAlerts.length}개
                </p>
              </div>

              {fetching ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
                  리뷰 목록을 불러오는 중...
                </div>
              ) : reviewError || favoriteError || startAlertError ? (
                <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">
                  {[reviewError, favoriteError, startAlertError].filter(Boolean).join(' / ')}
                </div>
              ) : (
                <div className="space-y-6">
                  <section>
                    <h2 className="mb-3 text-base font-medium text-zinc-100">시작 알림 신청 전시</h2>
                    {startAlerts.length === 0 ? (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
                        아직 신청한 시작 알림이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {startAlerts.map((alert) => (
                          <div key={alert.id} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-xs text-zinc-500">
                                {formatDateTimeLocal(alert.createdAt)}에 신청 · 전시 시작 {alert.notifyDaysBefore}일 전 알림
                              </p>
                              <button
                                type="button"
                                onClick={() => handleRemoveStartAlert(alert)}
                                disabled={removingStartAlertId === alert.id}
                                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-70"
                              >
                                {removingStartAlertId === alert.id ? '해제 중...' : '알림 해제'}
                              </button>
                            </div>
                            {alert.exhibition ? (
                              <div>
                                <p className="text-sm text-zinc-100">{alert.exhibition.title}</p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  {alert.exhibition.venueName} · 시작일 {alert.exhibition.startDate}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  상태: {alert.exhibition.status} · 발송 상태:{' '}
                                  {alert.sentAt ? `${formatDateTimeLocal(alert.sentAt)} 발송` : '발송 대기'}
                                </p>
                                <Link
                                  href={`/exhibitions/${alert.exhibition.slug}`}
                                  className="mt-2 inline-block text-xs text-zinc-300 underline"
                                >
                                  전시 상세 보기
                                </Link>
                              </div>
                            ) : (
                              <p className="text-sm text-zinc-400">전시 정보를 찾을 수 없습니다.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section>
                    <h2 className="mb-3 text-base font-medium text-zinc-100">찜한 전시</h2>
                    {favorites.length === 0 ? (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
                        아직 찜한 전시가 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {favorites.map((favorite) => (
                          <div key={favorite.id} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-xs text-zinc-500">{formatDateTimeLocal(favorite.createdAt)}에 찜함</p>
                              <button
                                type="button"
                                onClick={() => handleRemoveFavorite(favorite)}
                                disabled={removingFavoriteId === favorite.id}
                                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-70"
                              >
                                {removingFavoriteId === favorite.id ? '해제 중...' : '찜 해제'}
                              </button>
                            </div>
                            {favorite.exhibition ? (
                              <div>
                                <p className="text-sm text-zinc-100">{favorite.exhibition.title}</p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  {favorite.exhibition.venueName} · {favorite.exhibition.startDate} ~{' '}
                                  {favorite.exhibition.endDate}
                                </p>
                                <Link
                                  href={`/exhibitions/${favorite.exhibition.slug}`}
                                  className="mt-2 inline-block text-xs text-zinc-300 underline"
                                >
                                  전시 상세 보기
                                </Link>
                              </div>
                            ) : (
                              <p className="text-sm text-zinc-400">전시 정보를 찾을 수 없습니다.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section>
                    <h2 className="mb-3 text-base font-medium text-zinc-100">내가 작성한 리뷰</h2>
                    {reviews.length === 0 ? (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
                        아직 작성한 리뷰가 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reviews.map((review) => (
                          <div key={review.id} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-sm text-lime-300">평점 {review.rating.toFixed(1)} / 5.0</p>
                              <p className="text-xs text-zinc-500">{formatDateTimeLocal(review.createdAt)}</p>
                            </div>
                            <p className="text-sm text-zinc-200">{review.oneLineReview}</p>
                            {review.longReview ? (
                              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-300">
                                {review.longReview}
                              </p>
                            ) : null}
                            {review.reviewImagePaths.some((_, index) => Boolean(review.reviewImageUrls[index])) ? (
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {review.reviewImagePaths.map((path, index) => {
                                  const imageUrl = review.reviewImageUrls[index] ?? '';
                                  if (!imageUrl) return null;
                                  return (
                                    <a
                                      key={path}
                                      href={imageUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="overflow-hidden rounded-lg border border-zinc-800"
                                    >
                                      <img
                                        src={imageUrl}
                                        alt={`내 리뷰 사진 ${index + 1}`}
                                        className="h-28 w-full object-cover"
                                        loading="lazy"
                                      />
                                    </a>
                                  );
                                })}
                              </div>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
                              {review.recommendedFor ? <span>추천 대상: {review.recommendedFor}</span> : null}
                              {review.visitDuration ? <span>관람 시간: {review.visitDuration}</span> : null}
                              {review.revisitIntent ? <span>재방문: {review.revisitIntent}</span> : null}
                              {review.crowdLevel ? <span>혼잡도: {review.crowdLevel}</span> : null}
                            </div>
                            {review.exhibition ? (
                              <Link
                                href={`/exhibitions/${review.exhibition.slug}`}
                                className="mt-3 inline-block text-xs text-zinc-300 underline"
                              >
                                {review.exhibition.title} 보러가기
                              </Link>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
