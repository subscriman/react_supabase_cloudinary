import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminSubNav from '../../components/AdminSubNav';
import AuthTopBar from '../../components/AuthTopBar';
import { useAuthSession } from '../../hooks/useAuthSession';
import { supabase } from '../../lib/supabase';

type MetricState = {
  weeklyNewExhibitions: number;
  publishedExhibitions: number;
  reviewedExhibitions: number;
  reviewCoverage: number;
  weeklyNewReviews: number;
  averageRating: number | null;
};

const DEFAULT_METRICS: MetricState = {
  weeklyNewExhibitions: 0,
  publishedExhibitions: 0,
  reviewedExhibitions: 0,
  reviewCoverage: 0,
  weeklyNewReviews: 0,
  averageRating: null,
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function AdminDashboardPage() {
  const { user, role, loading } = useAuthSession();
  const [metrics, setMetrics] = useState<MetricState>(DEFAULT_METRICS);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || role !== 'admin') return;

    const loadMetrics = async () => {
      setFetching(true);
      setError(null);

      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const weekAgoIso = sevenDaysAgo.toISOString();

      const publishedQuery = supabase
        .from('exhibitions')
        .select('id, published_at', { count: 'exact' })
        .in('status', ['upcoming', 'ongoing', 'ended'])
        .not('published_at', 'is', null);

      const weeklyExhibitionQuery = supabase
        .from('exhibitions')
        .select('id', { count: 'exact', head: true })
        .in('status', ['upcoming', 'ongoing', 'ended'])
        .not('published_at', 'is', null)
        .gte('published_at', weekAgoIso);

      const weeklyReviewQuery = supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('is_hidden', false)
        .gte('created_at', weekAgoIso);

      const ratingSummaryQuery = supabase.from('exhibition_rating_summary').select('average_rating');

      const [publishedResult, weeklyExhibitionResult, weeklyReviewResult, ratingSummaryResult] = await Promise.all([
        publishedQuery,
        weeklyExhibitionQuery,
        weeklyReviewQuery,
        ratingSummaryQuery,
      ]);

      if (publishedResult.error || weeklyExhibitionResult.error || weeklyReviewResult.error || ratingSummaryResult.error) {
        setError(
          publishedResult.error?.message ||
            weeklyExhibitionResult.error?.message ||
            weeklyReviewResult.error?.message ||
            ratingSummaryResult.error?.message ||
            '지표를 불러오지 못했습니다.',
        );
        setFetching(false);
        return;
      }

      const publishedIds = new Set((publishedResult.data ?? []).map((item: any) => item.id as string));
      const publishedExhibitions = publishedIds.size;

      let reviewedExhibitions = 0;
      if (publishedExhibitions > 0) {
        const { data: reviewRows, error: reviewError } = await supabase
          .from('reviews')
          .select('exhibition_id')
          .eq('is_hidden', false)
          .in('exhibition_id', Array.from(publishedIds));

        if (reviewError) {
          setError(reviewError.message);
          setFetching(false);
          return;
        }

        reviewedExhibitions = new Set((reviewRows ?? []).map((row: any) => row.exhibition_id as string)).size;
      }

      const avgRows = (ratingSummaryResult.data ?? []) as Array<{ average_rating: number | string | null }>;
      const validRatings = avgRows
        .map((row) => (row.average_rating === null ? null : Number(row.average_rating)))
        .filter((value): value is number => value !== null && Number.isFinite(value));
      const averageRating =
        validRatings.length > 0 ? Number((validRatings.reduce((acc, value) => acc + value, 0) / validRatings.length).toFixed(2)) : null;

      setMetrics({
        weeklyNewExhibitions: weeklyExhibitionResult.count ?? 0,
        publishedExhibitions,
        reviewedExhibitions,
        reviewCoverage: publishedExhibitions > 0 ? reviewedExhibitions / publishedExhibitions : 0,
        weeklyNewReviews: weeklyReviewResult.count ?? 0,
        averageRating,
      });
      setFetching(false);
    };

    loadMetrics();
  }, [role, user]);

  const metricCards = useMemo(
    () => [
      { label: '주간 신규 전시 등록 수', value: `${metrics.weeklyNewExhibitions}개` },
      {
        label: '전시별 리뷰 작성 비율',
        value: `${metrics.reviewedExhibitions}/${metrics.publishedExhibitions} (${formatPercent(metrics.reviewCoverage)})`,
      },
      { label: '주간 신규 리뷰 수', value: `${metrics.weeklyNewReviews}개` },
      {
        label: '평균 평점(전체 전시)',
        value: metrics.averageRating === null ? '데이터 없음' : `${metrics.averageRating.toFixed(2)} / 5.0`,
      },
    ],
    [metrics],
  );

  return (
    <>
      <Head>
        <title>관리자 지표 대시보드 | ArtTomato</title>
        <meta name="description" content="MVP 핵심 운영 지표를 확인합니다." />
      </Head>

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
          <AuthTopBar />

          <header className="mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-lime-300">Admin</p>
              <h1 className="mt-2 text-2xl font-semibold md:text-3xl">MVP 운영 지표 대시보드</h1>
              <p className="mt-2 text-sm text-zinc-400">출시 후 핵심 지표를 빠르게 확인하기 위한 기본 보드입니다.</p>
            </div>
          </header>
          <AdminSubNav />

          {loading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
              세션 확인 중...
            </div>
          ) : !user ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-300">
              로그인 후 이용할 수 있습니다.{' '}
              <Link href="/auth" className="underline">
                로그인하러 가기
              </Link>
            </div>
          ) : role !== 'admin' ? (
            <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">
              관리자 권한이 없습니다.
            </div>
          ) : (
            <>
              {fetching ? (
                <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
                  지표를 계산하는 중...
                </div>
              ) : null}
              {error ? (
                <div className="mb-4 rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <section className="mb-6 grid gap-3 md:grid-cols-2">
                {metricCards.map((card) => (
                  <article key={card.label} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <p className="text-xs text-zinc-400">{card.label}</p>
                    <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                  </article>
                ))}
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <h2 className="text-base font-medium">핵심 지표 정의</h2>
                <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                  <li>주간 신규 전시 등록 수: 최근 7일 내 `published_at`이 설정된 전시 수</li>
                  <li>전시별 리뷰 작성 비율: 공개 전시 중 리뷰가 1개 이상인 전시 비율</li>
                  <li>상세 조회 대비 리뷰 작성 전환율: `review_submit_success / exhibition_detail_view` (이벤트 집계 연동 예정)</li>
                  <li>재방문 사용자 비율: 사용자별 주간 활성 로그 기준으로 별도 이벤트 집계 예정</li>
                  <li>검색 후 상세 페이지 이동률: `search_used` 이후 상세 조회 이벤트 연계 집계 예정</li>
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
