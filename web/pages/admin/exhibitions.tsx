import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminSubNav from '../../components/AdminSubNav';
import AuthTopBar from '../../components/AuthTopBar';
import { useAuthSession } from '../../hooks/useAuthSession';
import {
  aiDecisionLabel,
  extractAiReview,
  formatConfidencePercent,
  type AiReviewResult,
} from '../../lib/admin-ai-review';
import { supabase } from '../../lib/supabase';
import { trackEvent } from '../../lib/analytics';
import { formatDateOnlyLocal, formatDateTimeLocal } from '../../lib/date-time';

type ModerationAction = 'approve' | 'reject' | 'hold';

type AdminExhibitionItem = {
  id: string;
  slug: string;
  title: string;
  sourceSiteId: string | null;
  sourceExternalId: string | null;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  venueName: string;
  venueCity: string | null;
  aiReview: AiReviewResult | null;
  aiReviewedAt: string | null;
};

type QueueStatus = 'pending_review' | 'rejected' | 'hidden';

type ApiResponse = {
  data?: {
    exhibition?: {
      id: string;
      status: string;
      published_at: string | null;
      updated_at: string;
    };
  };
  exhibition?: {
    id: string;
    status: string;
    published_at: string | null;
    updated_at: string;
  };
  error?: string;
};

const STATUS_FILTERS: Array<{ value: QueueStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'pending_review', label: '검수 대기' },
  { value: 'rejected', label: '반려' },
  { value: 'hidden', label: '숨김' },
];

function formatDate(date: string): string {
  return formatDateOnlyLocal(date);
}

function formatDateTime(date: string): string {
  return formatDateTimeLocal(date);
}

function buildSourcePairKey(sourceSiteId: string | null | undefined, sourceExternalId: string | null | undefined): string | null {
  if (!sourceSiteId || !sourceExternalId) return null;
  const siteId = sourceSiteId.trim();
  const externalId = sourceExternalId.trim();
  if (!siteId || !externalId) return null;
  return `${siteId}::${externalId}`;
}

export default function AdminExhibitionsPage() {
  const { user, session, loading, role } = useAuthSession();
  const [items, setItems] = useState<AdminExhibitionItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'all'>('all');

  const loadQueue = useCallback(async () => {
    if (!user || role !== 'admin') return;

    setFetching(true);
    setError(null);

    const statusValues: QueueStatus[] =
      statusFilter === 'all' ? ['pending_review', 'rejected', 'hidden'] : [statusFilter];

    const { data, error: loadError } = await supabase
      .from('exhibitions')
      .select(
        `
          id,
          slug,
          title,
          source_site_id,
          source_external_id,
          start_date,
          end_date,
          status,
          created_at,
          published_at,
          venues (
            name,
            city
          )
        `,
      )
      .in('status', statusValues)
      .order('created_at', { ascending: false })
      .limit(100);

    if (loadError) {
      setError(loadError.message);
      setFetching(false);
      return;
    }

    const mapped: AdminExhibitionItem[] = (data ?? []).map((row: any) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      sourceSiteId: row.source_site_id ?? null,
      sourceExternalId: row.source_external_id ?? null,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      createdAt: row.created_at,
      publishedAt: row.published_at,
      venueName: Array.isArray(row.venues) ? row.venues[0]?.name ?? '장소 정보 없음' : row.venues?.name ?? '장소 정보 없음',
      venueCity: Array.isArray(row.venues) ? row.venues[0]?.city ?? null : row.venues?.city ?? null,
      aiReview: null,
      aiReviewedAt: null,
    }));

    const pairKeys = new Set<string>();
    const sourceSiteIds = new Set<string>();
    for (const item of mapped) {
      const pairKey = buildSourcePairKey(item.sourceSiteId, item.sourceExternalId);
      if (!pairKey) continue;
      pairKeys.add(pairKey);
      if (item.sourceSiteId) {
        sourceSiteIds.add(item.sourceSiteId);
      }
    }

    let mappedWithAiReview = mapped;
    if (pairKeys.size > 0 && sourceSiteIds.size > 0) {
      const { data: rawItems, error: rawError } = await supabase
        .from('ingestion_raw_items')
        .select('source_site_id, source_external_id, raw_payload, normalized_payload, created_at, updated_at')
        .in('source_site_id', Array.from(sourceSiteIds))
        .not('source_external_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (rawError) {
        setError(`AI 검수 정보 조회 실패: ${rawError.message}`);
      } else {
        const aiByPair = new Map<string, { review: AiReviewResult; reviewedAt: string | null }>();
        for (const row of rawItems ?? []) {
          const pairKey = buildSourcePairKey(row.source_site_id, row.source_external_id);
          if (!pairKey || !pairKeys.has(pairKey) || aiByPair.has(pairKey)) continue;
          const review = extractAiReview(row.normalized_payload, row.raw_payload);
          if (!review) continue;
          aiByPair.set(pairKey, {
            review,
            reviewedAt: row.updated_at ?? row.created_at ?? null,
          });
        }

        mappedWithAiReview = mapped.map((item) => {
          const pairKey = buildSourcePairKey(item.sourceSiteId, item.sourceExternalId);
          if (!pairKey) return item;
          const ai = aiByPair.get(pairKey);
          if (!ai) return item;
          return {
            ...item,
            aiReview: ai.review,
            aiReviewedAt: ai.reviewedAt,
          };
        });
      }
    }

    setItems(mappedWithAiReview);
    setFetching(false);
  }, [role, statusFilter, user]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const summary = useMemo(() => {
    return {
      pending: items.filter((item) => item.status === 'pending_review').length,
      rejected: items.filter((item) => item.status === 'rejected').length,
      hidden: items.filter((item) => item.status === 'hidden').length,
    };
  }, [items]);

  const handleModeration = async (id: string, action: ModerationAction) => {
    if (!session?.access_token) {
      setError('로그인이 필요합니다.');
      return;
    }

    setWorkingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/exhibitions/${id}/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action }),
      });

      const body = ((await response.json().catch(() => ({}))) ?? {}) as ApiResponse;
      const exhibition = body.data?.exhibition ?? body.exhibition;
      if (!response.ok || !exhibition) {
        setError(body.error ?? '승인 처리에 실패했습니다.');
        return;
      }

      trackEvent('admin_approval_action', {
        exhibition_id: exhibition.id,
        action,
        next_status: exhibition.status,
      });

      if (action === 'approve') {
        setItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: exhibition.status ?? item.status,
                  publishedAt: exhibition.published_at ?? item.publishedAt,
                }
              : item,
          ),
        );
      }
    } finally {
      setWorkingId(null);
    }
  };

  const statusLabel: Record<string, string> = {
    pending_review: '검수 대기',
    rejected: '반려',
    hidden: '숨김',
    upcoming: '예정',
    ongoing: '진행 중',
    ended: '종료',
  };

  const aiBadgeClass: Record<string, string> = {
    accept: 'border-lime-700 text-lime-300',
    reject: 'border-rose-800 text-rose-300',
    needs_human: 'border-amber-700 text-amber-300',
  };

  return (
    <>
      <Head>
        <title>관리자 전시 검수 | ArtTomato</title>
        <meta name="description" content="수집 대기 전시를 검수하고 승인/반려/보류 처리합니다." />
      </Head>

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
          <AuthTopBar />

          <header className="mb-4">
            <p className="text-xs uppercase tracking-[0.18em] text-lime-300">Admin</p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">수집 대기 전시 검수</h1>
            <p className="mt-2 text-sm text-zinc-400">자동 수집된 전시를 공개 전 검수하고 상태를 변경합니다.</p>
          </header>
          <AdminSubNav />

          {loading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
              세션 확인 중...
            </div>
          ) : !user ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-300">
              관리자 페이지는 로그인 후 이용할 수 있습니다.{' '}
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
              <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                  <span className="rounded-full border border-zinc-700 px-3 py-1">검수 대기 {summary.pending}</span>
                  <span className="rounded-full border border-zinc-700 px-3 py-1">반려 {summary.rejected}</span>
                  <span className="rounded-full border border-zinc-700 px-3 py-1">숨김 {summary.hidden}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as QueueStatus | 'all')}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-lime-400 focus:outline-none"
                  >
                    {STATUS_FILTERS.map((filter) => (
                      <option key={filter.value} value={filter.value}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={loadQueue}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500"
                  >
                    새로고침
                  </button>
                </div>
              </section>

              {error ? (
                <div className="mb-4 rounded-xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              {fetching ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-400">
                  검수 대기 목록을 불러오는 중...
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-400">
                  현재 필터 기준으로 검수할 전시가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <article key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-zinc-300">
                          {item.venueName}
                          {item.venueCity ? ` · ${item.venueCity}` : ''}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                            {statusLabel[item.status] ?? item.status}
                          </span>
                          {item.aiReview ? (
                            <span
                              className={`rounded-full border px-2 py-1 text-xs ${
                                aiBadgeClass[item.aiReview.decision] ?? 'border-zinc-700 text-zinc-300'
                              }`}
                            >
                              AI {aiDecisionLabel(item.aiReview.decision)}
                              {formatConfidencePercent(item.aiReview.confidence)
                                ? ` · ${formatConfidencePercent(item.aiReview.confidence)}`
                                : ''}
                            </span>
                          ) : (
                            <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-500">
                              AI 검수 없음
                            </span>
                          )}
                        </div>
                      </div>
                      <h2 className="text-lg font-medium">{item.title}</h2>
                      <p className="mt-2 text-xs text-zinc-400">
                        기간: {formatDate(item.startDate)} - {formatDate(item.endDate)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        수집 시각: {formatDateTime(item.createdAt)}
                        {item.publishedAt ? ` · 공개 시각: ${formatDateTime(item.publishedAt)}` : ''}
                      </p>
                      {item.aiReview ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          AI 근거: {item.aiReview.reasons[0] ?? item.aiReview.rationale ?? '근거 없음'}
                          {item.aiReviewedAt ? ` · 검수 시각: ${formatDateTime(item.aiReviewedAt)}` : ''}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/exhibitions/${item.id}`}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-zinc-500"
                        >
                          검수 상세
                        </Link>
                        <Link
                          href={`/exhibitions/${item.slug}`}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-zinc-500"
                        >
                          공개 상세
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleModeration(item.id, 'approve')}
                          disabled={workingId === item.id}
                          className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-lime-300 disabled:opacity-70"
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModeration(item.id, 'reject')}
                          disabled={workingId === item.id}
                          className="rounded-lg border border-rose-900 px-3 py-2 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-70"
                        >
                          반려
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModeration(item.id, 'hold')}
                          disabled={workingId === item.id}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-70"
                        >
                          보류
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
