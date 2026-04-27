import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminSubNav from '../../components/AdminSubNav';
import AuthTopBar from '../../components/AuthTopBar';
import { useAuthSession } from '../../hooks/useAuthSession';
import { supabase } from '../../lib/supabase';
import { formatDateOnlyLocal } from '../../lib/date-time';

type CandidateItem = {
  id: string;
  slug: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  publishedAt: string | null;
  venueName: string;
};

type MergeApiResponse = {
  data?: {
    primaryId?: string;
    hiddenIds?: string[];
  };
  primaryId?: string;
  hiddenIds?: string[];
  error?: string;
};

type DuplicateGroup = {
  key: string;
  normalizedTitle: string;
  venueName: string;
  primaryId: string;
  duplicateIds: string[];
  items: CandidateItem[];
};

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatDate(value: string): string {
  return formatDateOnlyLocal(value);
}

function statusLabel(status: string): string {
  if (status === 'pending_review') return '검수 대기';
  if (status === 'ongoing') return '진행 중';
  if (status === 'upcoming') return '예정';
  if (status === 'ended') return '종료';
  if (status === 'rejected') return '반려';
  if (status === 'hidden') return '숨김';
  return status;
}

function buildDuplicateGroups(items: CandidateItem[]): DuplicateGroup[] {
  const candidates = items.filter((item) => item.status !== 'hidden');
  const map = new Map<string, CandidateItem[]>();

  for (const item of candidates) {
    const key = `${normalizeTitle(item.title)}::${item.venueName.trim().toLowerCase()}`;
    const prev = map.get(key) ?? [];
    map.set(key, [...prev, item]);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, groupItems] of Array.from(map.entries())) {
    if (groupItems.length <= 1) continue;

    const sorted = [...groupItems].sort((a, b) => {
      const aPublished = a.publishedAt ? 1 : 0;
      const bPublished = b.publishedAt ? 1 : 0;
      if (aPublished !== bPublished) return bPublished - aPublished;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const primary = sorted[0];
    const duplicates = sorted.slice(1).map((item) => item.id);
    groups.push({
      key,
      normalizedTitle: normalizeTitle(primary.title),
      venueName: primary.venueName,
      primaryId: primary.id,
      duplicateIds: duplicates,
      items: sorted,
    });
  }

  groups.sort((a, b) => b.items.length - a.items.length);
  return groups;
}

export default function AdminDuplicatePage() {
  const { user, role, session, loading } = useAuthSession();
  const [items, setItems] = useState<CandidateItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [workingGroupKey, setWorkingGroupKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user || role !== 'admin') return;

    const load = async () => {
      setFetching(true);
      setError(null);
      setMessage(null);

      const { data, error: loadError } = await supabase
        .from('exhibitions')
        .select(
          `
            id,
            slug,
            title,
            status,
            start_date,
            end_date,
            created_at,
            published_at,
            venues (
              name
            )
          `,
        )
        .order('created_at', { ascending: false })
        .limit(500);

      if (loadError) {
        setError(loadError.message);
        setFetching(false);
        return;
      }

      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        startDate: row.start_date,
        endDate: row.end_date,
        createdAt: row.created_at,
        publishedAt: row.published_at ?? null,
        venueName: Array.isArray(row.venues) ? row.venues[0]?.name ?? '장소 정보 없음' : row.venues?.name ?? '장소 정보 없음',
      })) as CandidateItem[];

      setItems(mapped);
      setFetching(false);
    };

    load();
  }, [role, user]);

  const groups = useMemo(() => buildDuplicateGroups(items), [items]);

  const handleMerge = async (group: DuplicateGroup) => {
    if (!session?.access_token) {
      setError('로그인이 필요합니다.');
      return;
    }

    const confirmed = window.confirm(
      `대표 전시 1건을 제외하고 ${group.duplicateIds.length}건을 숨김 처리할까요?`,
    );
    if (!confirmed) return;

    setWorkingGroupKey(group.key);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/exhibitions/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          primaryId: group.primaryId,
          duplicateIds: group.duplicateIds,
        }),
      });

      const body = ((await response.json().catch(() => ({}))) ?? {}) as MergeApiResponse;
      const hiddenIds = body.data?.hiddenIds ?? body.hiddenIds;
      if (!response.ok || !hiddenIds) {
        setError(body.error ?? '중복 처리에 실패했습니다.');
        return;
      }

      const hiddenSet = new Set(hiddenIds);
      setItems((prev) =>
        prev.map((item) =>
          hiddenSet.has(item.id)
            ? {
                ...item,
                status: 'hidden',
                publishedAt: null,
              }
            : item,
        ),
      );
      setMessage(`중복 전시 ${hiddenIds.length}건을 숨김 처리했습니다.`);
    } finally {
      setWorkingGroupKey(null);
    }
  };

  return (
    <>
      <Head>
        <title>중복 의심 전시 처리 | ArtTomato Admin</title>
        <meta name="description" content="중복 의심 전시를 병합 처리합니다." />
      </Head>

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
          <AuthTopBar />

          <header className="mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-lime-300">Admin Duplicates</p>
              <h1 className="mt-2 text-2xl font-semibold md:text-3xl">중복 의심 전시 병합 처리</h1>
              <p className="mt-2 text-sm text-zinc-400">
                동일한 전시명과 장소 기준으로 후보를 묶어 대표 1건만 남기고 나머지를 숨김 처리합니다.
              </p>
            </div>
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
              {message ? (
                <div className="mb-4 rounded-xl border border-lime-900 bg-lime-950/40 px-4 py-3 text-sm text-lime-300">
                  {message}
                </div>
              ) : null}
              {error ? (
                <div className="mb-4 rounded-xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              {fetching ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-400">
                  중복 후보를 계산하는 중...
                </div>
              ) : groups.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-400">
                  현재 중복 의심 전시가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <article key={group.key} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h2 className="text-base font-medium">{group.items[0]?.title ?? group.normalizedTitle}</h2>
                          <p className="mt-1 text-xs text-zinc-400">
                            {group.venueName} · 후보 {group.items.length}건
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMerge(group)}
                          disabled={workingGroupKey === group.key}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-70"
                        >
                          {workingGroupKey === group.key ? '처리 중...' : `중복 ${group.duplicateIds.length}건 숨김`}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {group.items.map((item) => {
                          const isPrimary = item.id === group.primaryId;
                          return (
                            <div
                              key={item.id}
                              className={`rounded-lg border px-3 py-2 ${
                                isPrimary ? 'border-lime-800 bg-lime-950/20' : 'border-zinc-800 bg-zinc-950/50'
                              }`}
                            >
                              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="text-zinc-100">{item.title}</span>
                                <span className="text-xs text-zinc-400">
                                  {isPrimary ? '대표 유지' : '중복 후보'}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400">
                                기간: {formatDate(item.startDate)} - {formatDate(item.endDate)} · 상태:{' '}
                                {statusLabel(item.status)}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                <Link href={`/admin/exhibitions/${item.id}`} className="underline text-zinc-300">
                                  검수 상세
                                </Link>
                                <Link href={`/exhibitions/${item.slug}`} className="underline text-zinc-300">
                                  공개 상세
                                </Link>
                              </div>
                            </div>
                          );
                        })}
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
