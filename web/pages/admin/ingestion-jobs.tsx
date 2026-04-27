import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminSubNav from '../../components/AdminSubNav';
import AuthTopBar from '../../components/AuthTopBar';
import { useAuthSession } from '../../hooks/useAuthSession';
import { formatDateTimeLocal } from '../../lib/date-time';
import { supabase } from '../../lib/supabase';

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
type StatusFilter = 'all' | JobStatus;
type RawItemStatus = 'raw' | 'validated' | 'accepted' | 'rejected';
type ModerationAction = 'approve' | 'reject' | 'hold';

type IngestionJobItem = {
  id: string;
  status: JobStatus;
  rawCount: number;
  insertedCount: number;
  updatedCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  sourceSiteName: string | null;
};

type SourceSiteOption = {
  key: string;
  name: string;
};

type IngestionRawItem = {
  id: string;
  status: RawItemStatus;
  sourceSiteId: string | null;
  sourceExternalId: string | null;
  sourceDetailUrl: string | null;
  validationErrors: string[];
  createdAt: string;
  sourceSiteName: string | null;
  title: string | null;
  venueName: string | null;
  startDate: string | null;
  endDate: string | null;
  exhibitionId: string | null;
  exhibitionSlug: string | null;
  exhibitionStatus: string | null;
  exhibitionPublishedAt: string | null;
};

type IngestionRawItemState = {
  loading: boolean;
  loaded: boolean;
  error: string | null;
  items: IngestionRawItem[];
  totalCount: number | null;
};

type IngestionRunApiResponse = {
  data?: {
    message?: string;
    durationMs?: number;
    startedAt?: string;
    finishedAt?: string;
    site?: string;
    dryRun?: boolean;
    limit?: number;
  };
  error?: string;
};

type ModerateApiResponse = {
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

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'failed', label: '실패' },
  { value: 'running', label: '실행 중' },
  { value: 'queued', label: '대기' },
  { value: 'succeeded', label: '성공' },
];

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return formatDateTimeLocal(value);
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (startDate && endDate) return `${startDate} ~ ${endDate}`;
  if (startDate) return `${startDate} ~ -`;
  if (endDate) return `- ~ ${endDate}`;
  return '기간 미확인';
}

function buildSourcePairKey(sourceSiteId: string | null, sourceExternalId: string | null): string | null {
  const siteId = String(sourceSiteId || '').trim();
  const externalId = String(sourceExternalId || '').trim();
  if (!siteId || !externalId) return null;
  return `${siteId}::${externalId}`;
}

function buildRunProgressText(input: {
  elapsedSec: number;
  siteLabel: string;
  dryRun: boolean;
}): string {
  const elapsed = Math.max(0, Math.floor(input.elapsedSec));
  const modeLabel = input.dryRun ? 'dry-run' : '실수집';
  if (elapsed < 2) return `${input.siteLabel} (${modeLabel}) 실행 요청을 준비 중입니다...`;
  if (elapsed < 6) return `${input.siteLabel} (${modeLabel}) 서버에서 수집 작업을 시작하는 중입니다...`;
  if (elapsed < 20) return `${input.siteLabel} 목록 페이지를 수집하는 중입니다...`;
  if (elapsed < 45) return `${input.siteLabel} 상세 페이지/이미지를 처리하는 중입니다...`;
  return `${input.siteLabel} 수집 결과를 저장하고 마무리하는 중입니다...`;
}

export default function IngestionJobsPage() {
  const { user, role, session, loading } = useAuthSession();
  const [items, setItems] = useState<IngestionJobItem[]>([]);
  const [sourceSiteOptions, setSourceSiteOptions] = useState<SourceSiteOption[]>([]);
  const [runSiteKey, setRunSiteKey] = useState<string>('mmca');
  const [runLimit, setRunLimit] = useState<string>('20');
  const [runDryRun, setRunDryRun] = useState<boolean>(false);
  const [runSubmitting, setRunSubmitting] = useState<boolean>(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [runProgressText, setRunProgressText] = useState<string | null>(null);
  const [runElapsedSec, setRunElapsedSec] = useState<number>(0);
  const [runStartedAtMs, setRunStartedAtMs] = useState<number | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [rawItemsByJobId, setRawItemsByJobId] = useState<Record<string, IngestionRawItemState>>({});
  const [workingModerationRawId, setWorkingModerationRawId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || role !== 'admin') return;

    const load = async () => {
      setFetching(true);
      setError(null);

      let query = supabase
        .from('ingestion_jobs')
        .select(
          `
            id,
            status,
            raw_count,
            inserted_count,
            updated_count,
            error_message,
            started_at,
            finished_at,
            created_at,
            source_sites (
              name
            )
          `,
        )
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error: loadError } = await query;
      if (loadError) {
        setError(loadError.message);
        setFetching(false);
        return;
      }

      const mapped = (data ?? []).map((row: any) => {
        const source = Array.isArray(row.source_sites) ? row.source_sites[0] : row.source_sites;
        return {
          id: row.id,
          status: row.status,
          rawCount: Number(row.raw_count ?? 0),
          insertedCount: Number(row.inserted_count ?? 0),
          updatedCount: Number(row.updated_count ?? 0),
          errorMessage: row.error_message ?? null,
          startedAt: row.started_at ?? null,
          finishedAt: row.finished_at ?? null,
          createdAt: row.created_at,
          sourceSiteName: source?.name ?? null,
        } as IngestionJobItem;
      });

      setItems(mapped);
      setFetching(false);
    };

    load();
  }, [refreshSeed, role, statusFilter, user]);

  useEffect(() => {
    if (!user || role !== 'admin') return;

    const loadSites = async () => {
      const { data, error: loadError } = await supabase
        .from('source_sites')
        .select('name, collector_key, is_active, priority')
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (loadError) {
        setRunError(loadError.message);
        return;
      }

      const options = (data ?? [])
        .map((row: any) => {
          const collectorKey = String(row.collector_key ?? '').trim().toLowerCase();
          const name = String(row.name ?? '').trim();
          if (!collectorKey || !name) return null;
          return {
            key: collectorKey,
            name,
          } as SourceSiteOption;
        })
        .filter((item: SourceSiteOption | null): item is SourceSiteOption => Boolean(item));

      setSourceSiteOptions(options);
      if (runSiteKey !== 'all' && options.length > 0 && !options.some((item) => item.key === runSiteKey)) {
        setRunSiteKey(options[0].key);
      }
    };

    void loadSites();
  }, [role, runSiteKey, user]);

  const handleRunIngestion = async () => {
    if (!session?.access_token) {
      setRunError('수집 실행을 위해 로그인 세션이 필요합니다.');
      return;
    }

    const parsedLimit = Number(runLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
      setRunError('limit 값은 1~200 정수여야 합니다.');
      return;
    }

    setRunSubmitting(true);
    setRunError(null);
    setRunMessage(null);
    const startedAtMs = Date.now();
    setRunStartedAtMs(startedAtMs);
    setRunElapsedSec(0);
    const initialSiteLabel = runSiteKey === 'all' ? '전체 사이트' : runSiteKey;
    setRunProgressText(
      buildRunProgressText({
        elapsedSec: 0,
        siteLabel: initialSiteLabel,
        dryRun: runDryRun,
      }),
    );
    try {
      const response = await fetch('/api/admin/ingestion/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          siteKey: runSiteKey,
          limit: parsedLimit,
          dryRun: runDryRun,
        }),
      });

      const body = ((await response.json().catch(() => ({}))) ?? {}) as IngestionRunApiResponse;
      if (!response.ok) {
        setRunError(body.error ?? '수집 실행에 실패했습니다.');
        return;
      }

      const message = body.data?.message ?? '수집 실행이 완료되었습니다.';
      const durationMs = body.data?.durationMs;
      if (typeof durationMs === 'number') {
        setRunMessage(`${message} (${(durationMs / 1000).toFixed(1)}초)`);
      } else {
        setRunMessage(message);
      }
      setRefreshSeed((prev) => prev + 1);
    } finally {
      setRunSubmitting(false);
      setRunProgressText(null);
      setRunStartedAtMs(null);
    }
  };

  const runSiteLabel = useMemo(() => {
    if (runSiteKey === 'all') return '전체 사이트';
    const matched = sourceSiteOptions.find((option) => option.key === runSiteKey);
    return matched ? `${matched.name}` : runSiteKey;
  }, [runSiteKey, sourceSiteOptions]);

  useEffect(() => {
    if (!runSubmitting || runStartedAtMs === null) return;

    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - runStartedAtMs) / 1000));
      setRunElapsedSec(elapsed);
      setRunProgressText(
        buildRunProgressText({
          elapsedSec: elapsed,
          siteLabel: runSiteLabel,
          dryRun: runDryRun,
        }),
      );
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [runDryRun, runSiteLabel, runStartedAtMs, runSubmitting]);

  const summary = useMemo(() => {
    return {
      queued: items.filter((item) => item.status === 'queued').length,
      running: items.filter((item) => item.status === 'running').length,
      succeeded: items.filter((item) => item.status === 'succeeded').length,
      failed: items.filter((item) => item.status === 'failed').length,
    };
  }, [items]);

  const statusLabel: Record<JobStatus, string> = {
    queued: '대기',
    running: '실행 중',
    succeeded: '성공',
    failed: '실패',
  };

  const rawItemStatusLabel: Record<RawItemStatus, string> = {
    raw: '원문',
    validated: '검증',
    accepted: '채택',
    rejected: '제외',
  };

  const rawItemStatusClass: Record<RawItemStatus, string> = {
    raw: 'border-zinc-700 text-zinc-300',
    validated: 'border-sky-700 text-sky-200',
    accepted: 'border-lime-700 text-lime-200',
    rejected: 'border-rose-700 text-rose-200',
  };

  const exhibitionStatusLabel: Record<string, string> = {
    pending_review: '검수 대기',
    rejected: '반려',
    hidden: '숨김',
    upcoming: '예정',
    ongoing: '진행 중',
    ended: '종료',
  };

  const handleRawItemModeration = async (
    jobId: string,
    rawItemId: string,
    exhibitionId: string | null,
    action: ModerationAction,
  ) => {
    if (!exhibitionId) {
      setError('해당 수집 항목과 연결된 전시가 없어 검수 처리를 할 수 없습니다.');
      return;
    }
    if (!session?.access_token) {
      setError('검수 처리를 위해 로그인 세션이 필요합니다.');
      return;
    }

    setWorkingModerationRawId(rawItemId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/exhibitions/${exhibitionId}/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action }),
      });
      const body = ((await response.json().catch(() => ({}))) ?? {}) as ModerateApiResponse;
      const exhibition = body.data?.exhibition ?? body.exhibition;
      if (!response.ok || !exhibition) {
        setError(body.error ?? '검수 상태 변경에 실패했습니다.');
        return;
      }

      setRawItemsByJobId((prev) => {
        const current = prev[jobId];
        if (!current) return prev;
        return {
          ...prev,
          [jobId]: {
            ...current,
            items: current.items.map((item) =>
              item.id === rawItemId
                ? {
                    ...item,
                    exhibitionStatus: exhibition.status ?? item.exhibitionStatus,
                    exhibitionPublishedAt: exhibition.published_at ?? null,
                  }
                : item,
            ),
          },
        };
      });
    } finally {
      setWorkingModerationRawId(null);
    }
  };

  const loadRawItemsByJob = async (jobId: string) => {
    const current = rawItemsByJobId[jobId];
    if (current?.loading || current?.loaded) return;

    setRawItemsByJobId((prev) => ({
      ...prev,
      [jobId]: {
        loading: true,
        loaded: false,
        error: null,
        items: [],
        totalCount: null,
      },
    }));

    const { data, error: loadError, count } = await supabase
      .from('ingestion_raw_items')
      .select(
        `
          id,
          status,
          source_site_id,
          source_external_id,
          source_detail_url,
          validation_errors,
          created_at,
          raw_payload,
          normalized_payload,
          source_sites (
            name
          )
        `,
        { count: 'exact' },
      )
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(120);

    if (loadError) {
      setRawItemsByJobId((prev) => ({
        ...prev,
        [jobId]: {
          loading: false,
          loaded: true,
          error: loadError.message,
          items: [],
          totalCount: 0,
        },
      }));
      return;
    }

    const mappedBase = (data ?? []).map((row: any) => {
      const normalized = toObject(row.normalized_payload);
      const raw = toObject(row.raw_payload);
      const sourceSite = Array.isArray(row.source_sites) ? row.source_sites[0] : row.source_sites;

      const title = pickString(
        normalized?.title,
        raw?.title,
        raw?.name,
        raw?.exhTitle,
      );
      const venueName = pickString(
        normalized?.venueName,
        raw?.venueName,
        raw?.location,
        raw?.exhPlaNm,
      );
      const startDate = pickString(normalized?.startDate, raw?.startDateRaw);
      const endDate = pickString(normalized?.endDate, raw?.endDateRaw);

      return {
        id: String(row.id),
        status: String(row.status || 'raw') as RawItemStatus,
        sourceSiteId: pickString(row.source_site_id),
        sourceExternalId: pickString(row.source_external_id),
        sourceDetailUrl: pickString(row.source_detail_url),
        validationErrors: Array.isArray(row.validation_errors) ? row.validation_errors.filter((v: unknown) => typeof v === 'string') : [],
        createdAt: String(row.created_at),
        sourceSiteName: pickString(sourceSite?.name),
        title,
        venueName,
        startDate,
        endDate,
        exhibitionId: null,
        exhibitionSlug: null,
        exhibitionStatus: null,
        exhibitionPublishedAt: null,
      } as IngestionRawItem;
    });

    let mapped = mappedBase;
    const sourceSiteIds = Array.from(
      new Set(mappedBase.map((item) => item.sourceSiteId).filter((value): value is string => Boolean(value))),
    );
    const sourceExternalIds = Array.from(
      new Set(mappedBase.map((item) => item.sourceExternalId).filter((value): value is string => Boolean(value))),
    );

    if (sourceSiteIds.length > 0 && sourceExternalIds.length > 0) {
      const { data: exhibitionRows, error: exhibitionError } = await supabase
        .from('exhibitions')
        .select('id, slug, status, published_at, source_site_id, source_external_id')
        .in('source_site_id', sourceSiteIds)
        .in('source_external_id', sourceExternalIds)
        .limit(2000);

      if (exhibitionError) {
        setError(`수집 결과 전시 매칭 조회 실패: ${exhibitionError.message}`);
      } else {
        const exhibitionByPair = new Map<string, any>();
        for (const row of exhibitionRows ?? []) {
          const pairKey = buildSourcePairKey(row.source_site_id ?? null, row.source_external_id ?? null);
          if (!pairKey || exhibitionByPair.has(pairKey)) continue;
          exhibitionByPair.set(pairKey, row);
        }

        mapped = mappedBase.map((item) => {
          const pairKey = buildSourcePairKey(item.sourceSiteId, item.sourceExternalId);
          const exhibition = pairKey ? exhibitionByPair.get(pairKey) : null;
          if (!exhibition) return item;
          return {
            ...item,
            exhibitionId: pickString(exhibition.id),
            exhibitionSlug: pickString(exhibition.slug),
            exhibitionStatus: pickString(exhibition.status),
            exhibitionPublishedAt: pickString(exhibition.published_at),
          };
        });
      }
    }

    setRawItemsByJobId((prev) => ({
      ...prev,
      [jobId]: {
        loading: false,
        loaded: true,
        error: null,
        items: mapped,
        totalCount: count ?? mapped.length,
      },
    }));
  };

  return (
    <>
      <Head>
        <title>수집 이력 및 실패 로그 | ArtTomato Admin</title>
        <meta name="description" content="수집 잡 실행 이력과 실패 로그를 확인합니다." />
      </Head>

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
          <AuthTopBar />

          <header className="mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-lime-300">Admin Jobs</p>
              <h1 className="mt-2 text-2xl font-semibold md:text-3xl">수집 이력 및 실패 로그</h1>
              <p className="mt-2 text-sm text-zinc-400">사이트별 수집 실행 상태, 처리 건수, 오류 메시지를 확인합니다.</p>
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
              <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                    <span className="rounded-full border border-zinc-700 px-3 py-1">대기 {summary.queued}</span>
                    <span className="rounded-full border border-zinc-700 px-3 py-1">실행 중 {summary.running}</span>
                    <span className="rounded-full border border-zinc-700 px-3 py-1">성공 {summary.succeeded}</span>
                    <span className="rounded-full border border-zinc-700 px-3 py-1">실패 {summary.failed}</span>
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-lime-400 focus:outline-none"
                  >
                    {FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 md:grid-cols-[1.2fr_120px_auto_auto]">
                  <select
                    value={runSiteKey}
                    onChange={(event) => setRunSiteKey(event.target.value)}
                    disabled={runSubmitting}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-lime-400 focus:outline-none disabled:opacity-70"
                  >
                    <option value="all">전체 사이트</option>
                    {sourceSiteOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.name} ({option.key})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    value={runLimit}
                    onChange={(event) => setRunLimit(event.target.value)}
                    disabled={runSubmitting}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-lime-400 focus:outline-none disabled:opacity-70"
                    placeholder="limit"
                  />
                  <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      checked={runDryRun}
                      onChange={(event) => setRunDryRun(event.target.checked)}
                      disabled={runSubmitting}
                      className="h-4 w-4 accent-lime-400"
                    />
                    dry-run
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      void handleRunIngestion();
                    }}
                    disabled={runSubmitting || sourceSiteOptions.length === 0}
                    className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-lime-300 disabled:opacity-70"
                  >
                    {runSubmitting ? '수집 실행 중...' : '수집 실행'}
                  </button>
                </div>

                {runSubmitting ? (
                  <div className="mt-3 rounded-lg border border-lime-900/70 bg-lime-950/30 px-3 py-3">
                    <div className="mb-2 flex items-center gap-2 text-sm text-lime-300">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-lime-300 border-t-transparent" />
                      <span>{runProgressText ?? '수집 작업을 실행하는 중입니다...'}</span>
                    </div>
                    <p className="text-xs text-lime-200/80">경과 시간: {runElapsedSec}초</p>
                  </div>
                ) : null}
              </section>

              {error ? (
                <div className="mb-4 rounded-xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}
              {runError ? (
                <div className="mb-4 rounded-xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
                  {runError}
                </div>
              ) : null}
              {runMessage ? (
                <div className="mb-4 rounded-xl border border-lime-900 bg-lime-950/40 px-4 py-3 text-sm text-lime-300">
                  {runMessage}
                </div>
              ) : null}

              {fetching ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-400">
                  수집 이력을 불러오는 중...
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-400">
                  조건에 맞는 수집 이력이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((job) => {
                    const isExpanded = expandedJobId === job.id;
                    const rawState = rawItemsByJobId[job.id];

                    return (
                    <article key={job.id} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-zinc-300">{job.sourceSiteName ?? '출처 미지정'}</p>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                            {statusLabel[job.status]}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedJobId(null);
                                return;
                              }
                              setExpandedJobId(job.id);
                              if (!rawState?.loaded && !rawState?.loading) {
                                void loadRawItemsByJob(job.id);
                              }
                            }}
                            className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                          >
                            {isExpanded ? '수집 결과 숨기기' : '수집 결과 보기'}
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-500">job id: {job.id}</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        raw {job.rawCount} · inserted {job.insertedCount} · updated {job.updatedCount}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        시작: {formatDateTime(job.startedAt)} · 종료: {formatDateTime(job.finishedAt)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">생성: {formatDateTime(job.createdAt)}</p>

                      {job.errorMessage ? (
                        <div className="mt-3 rounded-lg border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-200">
                          {job.errorMessage}
                        </div>
                      ) : null}

                      {isExpanded ? (
                        <section className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-zinc-300">
                              수집 결과 {rawState?.totalCount ?? 0}건
                            </p>
                            {rawState?.totalCount !== null && rawState.totalCount > (rawState.items?.length ?? 0) ? (
                              <p className="text-[11px] text-zinc-500">최근 {rawState.items.length}건 표시</p>
                            ) : null}
                          </div>

                          {!rawState || rawState.loading ? (
                            <p className="text-xs text-zinc-400">수집 결과를 불러오는 중...</p>
                          ) : rawState.error ? (
                            <div className="rounded-lg border border-rose-900 bg-rose-950/30 p-2 text-xs text-rose-200">
                              {rawState.error}
                            </div>
                          ) : rawState.items.length === 0 ? (
                            <p className="text-xs text-zinc-500">해당 수집 실행의 원문 항목이 없습니다.</p>
                          ) : (
                            <div className="space-y-2">
                              {rawState.items.map((rawItem) => (
                                <article key={rawItem.id} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm text-zinc-100">{rawItem.title ?? '(제목 없음)'}</p>
                                    <span
                                      className={`rounded-full border px-2 py-1 text-[11px] ${rawItemStatusClass[rawItem.status] ?? 'border-zinc-700 text-zinc-300'}`}
                                    >
                                      {rawItemStatusLabel[rawItem.status] ?? rawItem.status}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-zinc-400">
                                    {rawItem.venueName ?? '장소 미확인'} · {formatDateRange(rawItem.startDate, rawItem.endDate)}
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-500">
                                    source id: {rawItem.sourceExternalId ?? '-'} · 생성: {formatDateTime(rawItem.createdAt)}
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-500">
                                    전시 상태:{' '}
                                    {rawItem.exhibitionStatus
                                      ? exhibitionStatusLabel[rawItem.exhibitionStatus] ?? rawItem.exhibitionStatus
                                      : '연결된 전시 없음'}
                                    {rawItem.exhibitionPublishedAt
                                      ? ` · 공개 시각: ${formatDateTime(rawItem.exhibitionPublishedAt)}`
                                      : ''}
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {rawItem.exhibitionId ? (
                                      <Link
                                        href={`/admin/exhibitions/${rawItem.exhibitionId}`}
                                        className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-zinc-500"
                                      >
                                        검수 상세
                                      </Link>
                                    ) : (
                                      <span className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-500">
                                        검수 상세
                                      </span>
                                    )}
                                    {rawItem.exhibitionSlug ? (
                                      <Link
                                        href={`/exhibitions/${rawItem.exhibitionSlug}`}
                                        className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-zinc-500"
                                      >
                                        공개 상세
                                      </Link>
                                    ) : (
                                      <span className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-500">
                                        공개 상세
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleRawItemModeration(job.id, rawItem.id, rawItem.exhibitionId, 'approve');
                                      }}
                                      disabled={workingModerationRawId === rawItem.id || !rawItem.exhibitionId}
                                      className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-lime-300 disabled:opacity-70"
                                    >
                                      승인
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleRawItemModeration(job.id, rawItem.id, rawItem.exhibitionId, 'reject');
                                      }}
                                      disabled={workingModerationRawId === rawItem.id || !rawItem.exhibitionId}
                                      className="rounded-lg border border-rose-900 px-3 py-2 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-70"
                                    >
                                      반려
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleRawItemModeration(job.id, rawItem.id, rawItem.exhibitionId, 'hold');
                                      }}
                                      disabled={workingModerationRawId === rawItem.id || !rawItem.exhibitionId}
                                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-70"
                                    >
                                      보류
                                    </button>
                                  </div>
                                  {rawItem.validationErrors.length > 0 ? (
                                    <p className="mt-1 text-xs text-rose-200">
                                      검증 오류: {rawItem.validationErrors.join(', ')}
                                    </p>
                                  ) : null}
                                  {rawItem.sourceDetailUrl ? (
                                    <a
                                      href={rawItem.sourceDetailUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 inline-block text-xs text-lime-300 underline"
                                    >
                                      원본 상세 링크
                                    </a>
                                  ) : null}
                                </article>
                              ))}
                            </div>
                          )}
                        </section>
                      ) : null}
                    </article>
                  );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
