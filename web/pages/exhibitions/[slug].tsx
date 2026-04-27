import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import type { ExhibitionDetail, ExhibitionReview, ReviewSortOption } from '../../lib/shared-types';
import { getExhibitionBySlug } from '../../lib/exhibitions';
import AuthTopBar from '../../components/AuthTopBar';
import ReviewComposer from '../../components/ReviewComposer';
import { REVIEW_SORT_OPTIONS, sortExhibitionReviews } from '../../lib/reviews';
import { useAuthSession } from '../../hooks/useAuthSession';
import { trackEvent } from '../../lib/analytics';
import { formatDateOnlyLocal, formatDateTimeLocal } from '../../lib/date-time';
import { supabase } from '../../lib/supabase';

type ExhibitionDetailPageProps = {
  exhibition: ExhibitionDetail | null;
  source: 'supabase' | 'fallback';
  warning: string | null;
};

function formatDateTime(date: string) {
  return formatDateOnlyLocal(date);
}

function formatReviewDate(date: string) {
  return formatDateTimeLocal(date);
}

function ratingText(averageRating: number | null, reviewCount: number) {
  if (averageRating === null || reviewCount === 0) {
    return '리뷰 준비중';
  }
  return `${averageRating.toFixed(1)} / 5.0 (${reviewCount})`;
}

type DescriptionBlock = {
  kind: 'text' | 'image' | 'link';
  value: string;
  label?: string;
};

function parseDescriptionBlocks(input: string | null | undefined): DescriptionBlock[] {
  const raw = String(input || '').trim();
  if (!raw) return [];

  const blocks: DescriptionBlock[] = [];
  const pattern = /(!?)\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    const textChunk = raw.slice(lastIndex, match.index).trim();
    if (textChunk) {
      blocks.push({
        kind: 'text',
        value: textChunk,
      });
    }

    const isImage = match[1] === '!';
    const label = String(match[2] || '').trim();
    const url = String(match[3] || '').trim();
    if (url && isImage) {
      blocks.push({
        kind: 'image',
        value: url,
      });
    } else if (url) {
      blocks.push({
        kind: 'link',
        label: label || '관련자료 다운로드',
        value: url,
      });
    }
    lastIndex = match.index + match[0].length;
  }

  const tail = raw.slice(lastIndex).trim();
  if (tail) {
    blocks.push({
      kind: 'text',
      value: tail,
    });
  }

  return blocks;
}

function mergeAdditionalImagesIntoBlocks(blocks: DescriptionBlock[], imageUrls: string[] | null | undefined): DescriptionBlock[] {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return blocks;
  if (blocks.some((block) => block.kind === 'image')) return blocks;
  const merged = [...blocks];
  const seen = new Set(
    merged.filter((block) => block.kind === 'image').map((block) => String(block.value || '').trim()),
  );
  for (const value of imageUrls) {
    const imageUrl = String(value || '').trim();
    if (!/^https?:\/\//i.test(imageUrl)) continue;
    if (seen.has(imageUrl)) continue;
    seen.add(imageUrl);
    merged.push({
      kind: 'image',
      value: imageUrl,
    });
  }
  return merged;
}

export default function ExhibitionDetailPage({
  exhibition,
  source,
  warning,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { user, session } = useAuthSession();
  const [reviews, setReviews] = useState<ExhibitionReview[]>(exhibition?.reviews ?? []);
  const [reviewSort, setReviewSort] = useState<ReviewSortOption>('latest');
  const [hasLocalReviewMutation, setHasLocalReviewMutation] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteSubmitting, setFavoriteSubmitting] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState<string | null>(null);
  const [hasStartAlert, setHasStartAlert] = useState(false);
  const [startAlertLoading, setStartAlertLoading] = useState(false);
  const [startAlertSubmitting, setStartAlertSubmitting] = useState(false);
  const [startAlertMessage, setStartAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    setReviews(exhibition?.reviews ?? []);
    setReviewSort('latest');
    setHasLocalReviewMutation(false);
    setIsFavorite(false);
    setFavoriteLoading(false);
    setFavoriteSubmitting(false);
    setFavoriteMessage(null);
    setHasStartAlert(false);
    setStartAlertLoading(false);
    setStartAlertSubmitting(false);
    setStartAlertMessage(null);
  }, [exhibition?.id]);

  useEffect(() => {
    if (!exhibition) return;
    trackEvent('exhibition_detail_view', {
      exhibition_id: exhibition.id,
      slug: exhibition.slug,
      source,
    });
  }, [exhibition?.id, exhibition?.slug, source]);

  useEffect(() => {
    if (!exhibition || !user || source !== 'supabase') {
      setIsFavorite(false);
      setFavoriteLoading(false);
      return;
    }

    let mounted = true;
    const loadFavorite = async () => {
      setFavoriteLoading(true);
      const { data, error } = await supabase
        .from('exhibition_favorites')
        .select('id')
        .eq('exhibition_id', exhibition.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setFavoriteMessage(error.message);
        setIsFavorite(false);
      } else {
        setFavoriteMessage(null);
        setIsFavorite(Boolean(data));
      }
      setFavoriteLoading(false);
    };

    void loadFavorite();
    return () => {
      mounted = false;
    };
  }, [exhibition?.id, source, user?.id]);

  useEffect(() => {
    if (!exhibition || !user || source !== 'supabase') {
      setHasStartAlert(false);
      setStartAlertLoading(false);
      return;
    }

    let mounted = true;
    const loadAlert = async () => {
      setStartAlertLoading(true);
      const { data, error } = await supabase
        .from('exhibition_start_alerts')
        .select('id')
        .eq('exhibition_id', exhibition.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setStartAlertMessage(error.message);
        setHasStartAlert(false);
      } else {
        setStartAlertMessage(null);
        setHasStartAlert(Boolean(data));
      }
      setStartAlertLoading(false);
    };

    void loadAlert();
    return () => {
      mounted = false;
    };
  }, [exhibition?.id, source, user?.id]);

  const myReview = useMemo(() => {
    if (!user) return null;
    return reviews.find((review) => review.authorId === user.id) ?? null;
  }, [reviews, user]);

  const sortedReviews = useMemo(() => sortExhibitionReviews(reviews, reviewSort), [reviews, reviewSort]);
  const descriptionBlocks = useMemo(() => {
    const parsed = parseDescriptionBlocks(exhibition?.description ?? exhibition?.summary ?? '');
    return mergeAdditionalImagesIntoBlocks(parsed, exhibition?.additionalImageUrls);
  }, [exhibition?.description, exhibition?.summary, exhibition?.additionalImageUrls]);

  const localSummary = useMemo(() => {
    if (reviews.length === 0) {
      return {
        averageRating: null as number | null,
        reviewCount: 0,
      };
    }
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return {
      averageRating: Number((sum / reviews.length).toFixed(1)),
      reviewCount: reviews.length,
    };
  }, [reviews]);

  const displayAverageRating =
    exhibition && hasLocalReviewMutation ? localSummary.averageRating : exhibition?.averageRating ?? null;
  const displayReviewCount = exhibition && hasLocalReviewMutation ? localSummary.reviewCount : exhibition?.reviewCount ?? 0;

  const handleReviewSaved = (savedReview: ExhibitionReview) => {
    setHasLocalReviewMutation(true);
    setReviews((prev) => {
      const filtered = prev.filter((review) => {
        if (review.id === savedReview.id) return false;
        if (savedReview.authorId && review.authorId === savedReview.authorId) return false;
        return true;
      });
      return [savedReview, ...filtered];
    });
  };

  const handleReviewDeleted = (reviewId: string) => {
    setHasLocalReviewMutation(true);
    setReviews((prev) => prev.filter((review) => review.id !== reviewId));
  };

  const handleFavoriteToggle = async () => {
    if (!exhibition) return;
    if (!user || !session?.access_token) {
      setFavoriteMessage('로그인 후 찜 기능을 사용할 수 있습니다.');
      return;
    }
    if (source !== 'supabase') {
      setFavoriteMessage('샘플 데이터에서는 찜 기능을 사용할 수 없습니다.');
      return;
    }

    setFavoriteSubmitting(true);
    setFavoriteMessage(null);
    try {
      if (isFavorite) {
        const response = await fetch(`/api/favorites/${exhibition.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (response.ok || response.status === 404) {
          setIsFavorite(false);
          trackEvent('favorite_toggle', {
            exhibition_id: exhibition.id,
            action: 'remove',
          });
          return;
        }
        const body = await response.json().catch(() => ({}));
        setFavoriteMessage(body?.error ?? '찜 해제에 실패했습니다.');
        return;
      }

      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          exhibitionId: exhibition.id,
        }),
      });

      if (response.ok || response.status === 409) {
        setIsFavorite(true);
        trackEvent('favorite_toggle', {
          exhibition_id: exhibition.id,
          action: 'add',
        });
        return;
      }
      const body = await response.json().catch(() => ({}));
      setFavoriteMessage(body?.error ?? '찜 저장에 실패했습니다.');
    } finally {
      setFavoriteSubmitting(false);
    }
  };

  const handleStartAlertToggle = async () => {
    if (!exhibition) return;
    if (!user || !session?.access_token) {
      setStartAlertMessage('로그인 후 시작 알림을 신청할 수 있습니다.');
      return;
    }
    if (source !== 'supabase') {
      setStartAlertMessage('샘플 데이터에서는 시작 알림을 사용할 수 없습니다.');
      return;
    }
    if (exhibition.status !== 'upcoming') {
      setStartAlertMessage('예정 전시에만 시작 알림을 신청할 수 있습니다.');
      return;
    }

    setStartAlertSubmitting(true);
    setStartAlertMessage(null);
    try {
      if (hasStartAlert) {
        const response = await fetch(`/api/start-alerts/${exhibition.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (response.ok || response.status === 404) {
          setHasStartAlert(false);
          trackEvent('start_alert_toggle', {
            exhibition_id: exhibition.id,
            action: 'remove',
          });
          return;
        }
        const body = await response.json().catch(() => ({}));
        setStartAlertMessage(body?.error ?? '시작 알림 해제에 실패했습니다.');
        return;
      }

      const response = await fetch('/api/start-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          exhibitionId: exhibition.id,
          notifyDaysBefore: 1,
        }),
      });
      if (response.ok || response.status === 409) {
        setHasStartAlert(true);
        trackEvent('start_alert_toggle', {
          exhibition_id: exhibition.id,
          action: 'add',
        });
        return;
      }
      const body = await response.json().catch(() => ({}));
      setStartAlertMessage(body?.error ?? '시작 알림 신청에 실패했습니다.');
    } finally {
      setStartAlertSubmitting(false);
    }
  };

  if (!exhibition) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <h1 className="text-3xl font-semibold">전시를 찾을 수 없습니다.</h1>
          <p className="mt-3 text-zinc-300">전시가 삭제되었거나 URL이 변경되었을 수 있습니다.</p>
          <Link
            href="/"
            className="mt-8 rounded-full border border-zinc-700 px-5 py-2 text-sm text-zinc-200 hover:border-zinc-500"
          >
            전시 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{`${exhibition.title} | ArtTomato`}</title>
        <meta
          name="description"
          content={exhibition.summary ?? `${exhibition.title} 전시 정보와 관람객 리뷰를 확인하세요.`}
        />
      </Head>

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
          <AuthTopBar />

          <Link href="/" className="mb-6 inline-block text-sm text-zinc-400 hover:text-zinc-200">
            ← 전시 목록으로
          </Link>

          {warning ? (
            <div className="mb-6 rounded-xl border border-amber-800 bg-amber-950/70 px-4 py-3 text-sm text-amber-200">
              {warning}
            </div>
          ) : null}

          <article className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
            <div className="relative h-72 bg-zinc-800 md:h-96">
              {exhibition.posterImageUrl ? (
                <img src={exhibition.posterImageUrl} alt={exhibition.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">포스터 준비중</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-6 md:p-8">
                <p className="text-xs uppercase tracking-[0.2em] text-lime-300">ArtTomato Exhibition</p>
                <h1 className="mt-2 text-2xl font-semibold md:text-4xl">{exhibition.title}</h1>
                {exhibition.subtitle ? <p className="mt-2 text-zinc-200">{exhibition.subtitle}</p> : null}
              </div>
            </div>

            <div className="grid gap-8 p-6 md:grid-cols-[1.6fr_1fr] md:p-8">
              <section>
                <h2 className="text-lg font-medium">전시 소개</h2>
                <div className="mt-3 space-y-4 leading-7 text-zinc-300">
                  {descriptionBlocks.length > 0 ? (
                    descriptionBlocks.map((block, index) =>
                      block.kind === 'image' ? (
                        <a
                          key={`description-image-${index}-${block.value}`}
                          href={block.value}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70"
                        >
                          <img
                            src={block.value}
                            alt={`${exhibition.title} 상세 이미지 ${index + 1}`}
                            className="h-auto w-full object-cover"
                            loading="lazy"
                          />
                        </a>
                      ) : block.kind === 'link' ? (
                        <a
                          key={`description-link-${index}-${block.value}`}
                          href={block.value}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="inline-flex rounded-full border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-100 hover:border-lime-400 hover:text-lime-200"
                        >
                          {block.label || '관련자료 다운로드'}
                        </a>
                      ) : (
                        <p key={`description-text-${index}`} className="whitespace-pre-line">
                          {block.value}
                        </p>
                      ),
                    )
                  ) : (
                    <p className="whitespace-pre-line">전시 소개 준비중입니다.</p>
                  )}
                </div>

                {exhibition.tags.length > 0 ? (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {exhibition.tags.map((tag) => (
                      <span key={tag.id} className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                ) : null}

                {exhibition.externalReviews.length > 0 ? (
                  <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <h3 className="text-base font-medium">외부 후기 큐레이션</h3>
                    <p className="mt-1 text-xs text-zinc-400">관리자가 선별한 외부 리뷰 링크입니다.</p>
                    <div className="mt-3 space-y-3">
                      {exhibition.externalReviews.map((externalReview) => (
                        <article key={externalReview.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                          <p className="text-sm font-medium text-zinc-100">{externalReview.title}</p>
                          <p className="mt-1 text-xs text-zinc-400">출처: {externalReview.sourceName}</p>
                          {externalReview.summary ? (
                            <p className="mt-2 whitespace-pre-line text-sm text-zinc-300">{externalReview.summary}</p>
                          ) : null}
                          <a
                            href={externalReview.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
                          >
                            원문 보기
                          </a>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                <ReviewComposer
                  exhibitionId={exhibition.id}
                  session={session}
                  user={user}
                  myReview={myReview}
                  onReviewSaved={handleReviewSaved}
                  onReviewDeleted={handleReviewDeleted}
                />

                <div className="mt-10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-medium">관람객 한줄 후기</h3>
                    <select
                      value={reviewSort}
                      onChange={(event) => setReviewSort(event.target.value as ReviewSortOption)}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:border-lime-400 focus:outline-none"
                    >
                      {REVIEW_SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {sortedReviews.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-400">아직 등록된 리뷰가 없습니다.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {sortedReviews.map((review) => (
                        <div key={review.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                            <span>{review.authorId && review.authorId === user?.id ? '나' : review.authorName}</span>
                            <span>{formatReviewDate(review.createdAt)}</span>
                          </div>
                          <p className="mb-2 text-sm text-lime-300">평점 {review.rating.toFixed(1)} / 5.0</p>
                          <p className="text-sm leading-6 text-zinc-200">{review.oneLineReview}</p>
                          {review.longReview ? (
                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-300">
                              {review.longReview}
                            </p>
                          ) : null}
                          {review.reviewImagePaths.some((_, index) => Boolean(review.reviewImageUrls[index])) ? (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {review.reviewImagePaths.map((path, index) => {
                                const imageUrl = review.reviewImageUrls[index] ?? '';
                                if (!imageUrl) {
                                  return null;
                                }
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
                                      alt={`${review.authorName} 리뷰 사진 ${index + 1}`}
                                      className="h-40 w-full object-cover"
                                      loading="lazy"
                                    />
                                  </a>
                                );
                              })}
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                            {review.recommendedFor ? <span>추천 대상: {review.recommendedFor}</span> : null}
                            {review.visitDuration ? <span>관람 시간: {review.visitDuration}</span> : null}
                            {review.revisitIntent ? <span>재방문: {review.revisitIntent}</span> : null}
                            {review.crowdLevel ? <span>혼잡도: {review.crowdLevel}</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <aside>
                <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <div>
                    <p className="text-xs text-zinc-400">장소</p>
                    <p className="mt-1 text-sm text-zinc-200">{exhibition.venue.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">전시 기간</p>
                    <p className="mt-1 text-sm text-zinc-200">
                      {formatDateTime(exhibition.startDate)} - {formatDateTime(exhibition.endDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">운영 시간</p>
                    <p className="mt-1 text-sm text-zinc-200">{exhibition.operatingHours ?? '정보 준비중'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">관람료</p>
                    <p className="mt-1 text-sm text-zinc-200">{exhibition.admissionFee ?? '정보 준비중'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">평균 평점</p>
                    <p className="mt-1 text-sm text-lime-300">{ratingText(displayAverageRating, displayReviewCount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">찜</p>
                    <button
                      type="button"
                      onClick={handleFavoriteToggle}
                      disabled={favoriteSubmitting || favoriteLoading}
                      className="mt-2 inline-flex rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-70"
                    >
                      {favoriteLoading
                        ? '찜 상태 확인 중...'
                        : favoriteSubmitting
                          ? '처리 중...'
                          : isFavorite
                            ? '찜 해제'
                            : '찜하기'}
                    </button>
                    {favoriteMessage ? <p className="mt-2 text-xs text-rose-300">{favoriteMessage}</p> : null}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">전시 시작 알림</p>
                    <button
                      type="button"
                      onClick={handleStartAlertToggle}
                      disabled={
                        startAlertSubmitting || startAlertLoading || source !== 'supabase' || exhibition.status !== 'upcoming'
                      }
                      className="mt-2 inline-flex rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-70"
                    >
                      {startAlertLoading
                        ? '알림 상태 확인 중...'
                        : startAlertSubmitting
                          ? '처리 중...'
                          : hasStartAlert
                            ? '시작 알림 해제'
                            : '시작 알림 받기'}
                    </button>
                    {startAlertMessage ? <p className="mt-2 text-xs text-rose-300">{startAlertMessage}</p> : null}
                  </div>
                  {exhibition.officialUrl ? (
                    <a
                      href={exhibition.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
                    >
                      공식 페이지 이동
                    </a>
                  ) : null}
                  {exhibition.bookingUrl ? (
                    <a
                      href={exhibition.bookingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
                    >
                      예매 페이지 이동
                    </a>
                  ) : null}
                </div>

                <p className="mt-3 text-xs text-zinc-500">
                  데이터 출처: {source === 'supabase' ? 'Supabase' : 'Fallback Sample'}
                </p>
              </aside>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ExhibitionDetailPageProps> = async (context) => {
  const slug = context.params?.slug;
  const safeSlug = Array.isArray(slug) ? slug[0] : slug;

  if (!safeSlug) {
    return {
      props: {
        exhibition: null,
        source: 'fallback',
        warning: '잘못된 접근입니다.',
      },
    };
  }

  const result = await getExhibitionBySlug(safeSlug);
  return {
    props: {
      exhibition: result.data,
      source: result.source,
      warning: result.warning,
    },
  };
};
