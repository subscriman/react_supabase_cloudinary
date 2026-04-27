import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import AdminSubNav from '../../components/AdminSubNav';
import AuthTopBar from '../../components/AuthTopBar';
import { useAuthSession } from '../../hooks/useAuthSession';

type CrawlTestItem = {
  index: number;
  sourceExternalId: string | null;
  title: string | null;
  venueName: string | null;
  startDateRaw: string | null;
  endDateRaw: string | null;
  detailUrl: string | null;
  listUrl: string | null;
  imageUrl: string | null;
  summary: string | null;
  rawType: string | null;
  detailPreferredPosterImageUrl: string | null;
  detailImageUrls: string[];
  detailImageCount: number;
  detailDescriptionPreview: string | null;
  detailDescriptionLength: number;
  detailFetchError: string | null;
};

type CrawlTestData = {
  requestedUrl: string;
  fetchedUrl: string;
  fetchedStatus: number;
  fetchedOk: boolean;
  fetchedBytes: number;
  resolvedSiteKey: string;
  resolvedSiteName: string;
  matchMode: 'auto' | 'manual';
  includeDetail: boolean;
  detailLimit: number;
  limit: number;
  extractedCount: number;
  items: CrawlTestItem[];
  warnings: string[];
};

type CrawlTestResponse = {
  data?: CrawlTestData;
  error?: string;
};

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatDateRange(startDateRaw: string | null, endDateRaw: string | null): string {
  if (startDateRaw && endDateRaw) return `${startDateRaw} ~ ${endDateRaw}`;
  if (startDateRaw) return `${startDateRaw} ~ -`;
  if (endDateRaw) return `- ~ ${endDateRaw}`;
  return '기간 미확인';
}

function uniqueUrls(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const url = String(value || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export default function AdminCrawlingTestPage() {
  const { user, role, loading, session } = useAuthSession();
  const [inputUrl, setInputUrl] = useState('');
  const [siteKey, setSiteKey] = useState('');
  const [limit, setLimit] = useState('10');
  const [includeDetail, setIncludeDetail] = useState(true);
  const [detailLimit, setDetailLimit] = useState('5');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrawlTestData | null>(null);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    return inputUrl.trim().length > 0;
  }, [inputUrl, submitting]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.access_token) {
      setError('로그인 세션을 확인해 주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/ingestion/crawl-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          url: inputUrl.trim(),
          siteKey: siteKey.trim() || 'auto',
          limit: Number(limit),
          includeDetail,
          detailLimit: Number(detailLimit),
        }),
      });

      const payload = (await response.json().catch(() => null)) as CrawlTestResponse | null;
      if (!response.ok) {
        setError(payload?.error || `요청 실패 (${response.status})`);
        setSubmitting(false);
        return;
      }

      if (!payload?.data) {
        setError('테스트 결과를 받지 못했습니다.');
        setSubmitting(false);
        return;
      }

      setResult(payload.data);
      setSubmitting(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '요청 중 오류가 발생했습니다.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>관리자 크롤링 테스트 | ArtTomato</title>
        <meta name="description" content="사이트 URL로 수집 어댑터 동작을 즉시 검증합니다." />
      </Head>

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
          <AuthTopBar />

          <header className="mb-4">
            <p className="text-xs uppercase tracking-[0.18em] text-lime-300">Admin</p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">크롤링 테스트</h1>
            <p className="mt-2 text-sm text-zinc-400">
              수집 대상 사이트 URL을 입력하면 현재 어댑터/상세 파싱 로직으로 즉시 테스트 결과를 생성합니다.
            </p>
          </header>

          <AdminSubNav />

          {loading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">세션 확인 중...</div>
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
              <form onSubmit={onSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <label htmlFor="crawl-test-url" className="mb-2 block text-sm text-zinc-300">
                  테스트 URL
                </label>
                <input
                  id="crawl-test-url"
                  value={inputUrl}
                  onChange={(event) => setInputUrl(event.target.value)}
                  placeholder="예: https://www.mmca.go.kr/exhibitions/progressList.do"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-lime-300/40 placeholder:text-zinc-500 focus:ring-2"
                />

                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <label className="block text-xs text-zinc-400">
                    siteKey(선택)
                    <input
                      value={siteKey}
                      onChange={(event) => setSiteKey(event.target.value)}
                      placeholder="auto / mmca / sema ..."
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-lime-300/40 placeholder:text-zinc-500 focus:ring-2"
                    />
                  </label>

                  <label className="block text-xs text-zinc-400">
                    최대 항목 수
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={limit}
                      onChange={(event) => setLimit(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-lime-300/40 focus:ring-2"
                    />
                  </label>

                  <label className="block text-xs text-zinc-400">
                    상세 파싱 건수
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={detailLimit}
                      disabled={!includeDetail}
                      onChange={(event) => setDetailLimit(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-lime-300/40 focus:ring-2 disabled:opacity-50"
                    />
                  </label>

                  <label className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={includeDetail}
                      onChange={(event) => setIncludeDetail(event.target.checked)}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-950"
                    />
                    상세 페이지 파싱 포함
                  </label>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="rounded-lg bg-lime-300 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? '테스트 실행 중...' : '크롤링 테스트 실행'}
                  </button>
                </div>
              </form>

              {error ? (
                <div className="mt-4 rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">{error}</div>
              ) : null}

              {result ? (
                <section className="mt-4 space-y-4">
                  <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <h2 className="text-base font-medium">테스트 요약</h2>
                    <div className="mt-3 grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
                      <p>
                        사이트: <span className="font-medium text-zinc-100">{result.resolvedSiteName}</span> (
                        {result.resolvedSiteKey})
                      </p>
                      <p>매칭 방식: {result.matchMode === 'auto' ? 'URL 자동 판별' : '수동 지정'}</p>
                      <p>
                        목록 요청: {result.fetchedStatus} ({result.fetchedOk ? 'OK' : '비정상'})
                      </p>
                      <p>응답 크기: {formatBytes(result.fetchedBytes)}</p>
                      <p>추출 건수: {result.extractedCount}건</p>
                      <p>
                        상세 파싱: {result.includeDetail ? `활성 (최대 ${result.detailLimit}건)` : '비활성'}
                      </p>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-zinc-400">
                      <p>요청 URL: {result.requestedUrl}</p>
                      <p>실제 응답 URL: {result.fetchedUrl}</p>
                    </div>
                  </article>

                  {result.warnings.length > 0 ? (
                    <article className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
                      {result.warnings.map((warning, index) => (
                        <p key={`${warning}-${index}`}>{warning}</p>
                      ))}
                    </article>
                  ) : null}

                  <article className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <h2 className="text-base font-medium">크롤링 결과 ({result.items.length}건 표시)</h2>

                    {result.items.length === 0 ? (
                      <p className="mt-3 text-sm text-zinc-400">표시할 결과가 없습니다.</p>
                    ) : (
                      <div className="mt-3 space-y-4">
                        {result.items.map((item) => {
                          const previewImages = uniqueUrls([
                            item.imageUrl,
                            item.detailPreferredPosterImageUrl,
                            ...item.detailImageUrls,
                          ]).slice(0, 8);

                          return (
                            <article
                              key={`${item.index}-${item.sourceExternalId || item.detailUrl || item.title || 'item'}`}
                              className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                                <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-200">#{item.index}</span>
                                {item.rawType ? <span>{item.rawType}</span> : null}
                                {item.sourceExternalId ? <span>externalId: {item.sourceExternalId}</span> : null}
                              </div>

                              <h3 className="mt-2 text-lg font-medium text-zinc-100">{item.title || '제목 없음'}</h3>
                              <p className="mt-1 text-sm text-zinc-400">
                                {item.venueName || '장소 미확인'} · {formatDateRange(item.startDateRaw, item.endDateRaw)}
                              </p>

                              <div className="mt-2 space-y-1 text-xs text-zinc-400">
                                {item.detailUrl ? (
                                  <p>
                                    상세 URL:{' '}
                                    <a href={item.detailUrl} target="_blank" rel="noreferrer" className="underline text-zinc-300">
                                      {item.detailUrl}
                                    </a>
                                  </p>
                                ) : null}
                                {item.detailFetchError ? <p className="text-rose-300">상세 파싱 오류: {item.detailFetchError}</p> : null}
                                {item.summary ? <p>요약: {item.summary}</p> : null}
                              </div>

                              {previewImages.length > 0 ? (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                  {previewImages.map((imageUrl, index) => (
                                    <a
                                      key={`${imageUrl}-${index}`}
                                      href={imageUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60"
                                    >
                                      <img
                                        src={imageUrl}
                                        alt={`${item.title || '전시'} 이미지 ${index + 1}`}
                                        className="h-36 w-full object-cover"
                                        loading="lazy"
                                      />
                                    </a>
                                  ))}
                                </div>
                              ) : null}

                              {item.detailDescriptionPreview ? (
                                <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                                  <summary className="cursor-pointer text-sm text-zinc-300">
                                    상세 본문 미리보기 ({item.detailDescriptionLength.toLocaleString()} chars)
                                  </summary>
                                  <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-zinc-400">
                                    {item.detailDescriptionPreview}
                                  </pre>
                                </details>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </article>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
