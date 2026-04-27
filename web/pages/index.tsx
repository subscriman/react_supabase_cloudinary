import Head from 'next/head';
import Link from 'next/link';
import { useEffect } from 'react';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import type {
  ExhibitionListFilters,
  ExhibitionListItem,
  ExhibitionListMeta,
  ExhibitionListSortOption,
  ExhibitionListStatusFilter,
} from '../lib/shared-types';
import { getPublishedExhibitions } from '../lib/exhibitions';
import AuthTopBar from '../components/AuthTopBar';
import { trackEvent } from '../lib/analytics';
import { formatDateOnlyLocal } from '../lib/date-time';

type HomePageProps = {
  exhibitions: ExhibitionListItem[];
  source: 'supabase' | 'fallback';
  warning: string | null;
  filters: ExhibitionListFilters;
  meta: ExhibitionListMeta;
};

const statusLabel: Record<string, string> = {
  upcoming: '예정',
  ongoing: '진행 중',
  ended: '종료',
  hidden: '숨김',
  pending_review: '검수 대기',
  rejected: '반려',
};

const statusFilterLabel: Record<ExhibitionListStatusFilter, string> = {
  all: '전체',
  ongoing: '진행 중',
  upcoming: '예정',
  ending: '종료 임박',
};

const sortLabel: Record<ExhibitionListSortOption, string> = {
  latest: '최신순',
  rating: '평점순',
  ending: '종료 임박순',
};

function formatPeriod(startDate: string, endDate: string) {
  return `${formatDateOnlyLocal(startDate)} - ${formatDateOnlyLocal(endDate)}`;
}

function renderRating(item: ExhibitionListItem) {
  if (item.averageRating === null || item.reviewCount === 0) {
    return '리뷰 준비중';
  }
  return `평점 ${item.averageRating.toFixed(1)} (${item.reviewCount})`;
}

function buildQueryHref(current: ExhibitionListFilters, update: Partial<ExhibitionListFilters>) {
  const merged: ExhibitionListFilters = {
    ...current,
    ...update,
  };

  const params = new URLSearchParams();
  if (merged.q) params.set('q', merged.q);
  if (merged.status !== 'all') params.set('status', merged.status);
  if (merged.city) params.set('city', merged.city);
  if (merged.tag) params.set('tag', merged.tag);
  if (merged.sort !== 'latest') params.set('sort', merged.sort);

  const query = params.toString();
  return query.length > 0 ? `/?${query}` : '/';
}

export default function HomePage({
  exhibitions,
  source,
  warning,
  filters,
  meta,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  useEffect(() => {
    const query = filters.q.trim();
    if (query.length > 0) {
      trackEvent('search_used', {
        query,
        result_count: meta.filteredCount,
      });
    }

    const hasFilter = filters.status !== 'all' || filters.city.length > 0 || filters.tag.length > 0 || filters.sort !== 'latest';
    if (hasFilter) {
      trackEvent('filter_used', {
        status: filters.status,
        city: filters.city || 'all',
        tag: filters.tag || 'all',
        sort: filters.sort,
      });
    }
  }, [filters.city, filters.q, filters.sort, filters.status, filters.tag, meta.filteredCount]);

  return (
    <>
      <Head>
        <title>ArtTomato | 지금 열리는 전시 리뷰</title>
        <meta
          name="description"
          content="현재 진행 중이거나 곧 열릴 전시를 찾고, 실제 관람객 리뷰를 확인하세요."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="awwwards-canvas min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute left-[-120px] top-[110px] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,92,54,0.28),transparent_66%)] blur-2xl" />
        <div className="pointer-events-none absolute right-[-100px] top-[45%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(8,116,242,0.26),transparent_62%)] blur-2xl" />

        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-8 md:px-8 md:pb-20 md:pt-12">
          <AuthTopBar />

          <header className="reveal-up mb-8 grid gap-6 rounded-[28px] border border-black/15 bg-white/68 p-6 shadow-[0_20px_50px_rgba(9,12,20,0.08)] backdrop-blur-sm md:grid-cols-[1.65fr_1fr] md:p-10">
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.28em] text-[color:var(--art-ink-muted)]">ArtTomato Curation Feed</p>
              <h1 className="art-display max-w-3xl text-4xl leading-[0.98] text-[color:var(--art-ink-strong)] md:text-6xl">
                좋은 전시를 찾는
                <br />
                가장 감각적인
                <br />
                리뷰 인덱스
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-[color:var(--art-ink-muted)] md:text-base">
                전시 기간, 장소, 실제 관람자의 한줄 리뷰와 관람 팁을 한 화면에서 비교해보세요.
              </p>
            </div>

            <div className="grid gap-3 md:pl-3">
              <div className="reveal-up reveal-delay-1 rounded-2xl border border-black/15 bg-black px-4 py-4 text-white">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Live Index</p>
                <p className="mt-2 art-display text-3xl">{meta.totalCount}</p>
                <p className="mt-1 text-xs text-white/70">등록 전시</p>
              </div>
              <div className="reveal-up reveal-delay-2 rounded-2xl border border-black/15 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--art-ink-muted)]">Filtered</p>
                <p className="mt-2 art-display text-3xl text-[color:var(--art-accent)]">{meta.filteredCount}</p>
                <p className="mt-1 text-xs text-[color:var(--art-ink-muted)]">조건 일치 전시</p>
              </div>
            </div>
          </header>

          <section className="reveal-up reveal-delay-1 mb-6 rounded-[24px] border border-black/15 bg-white/72 p-4 shadow-[0_16px_35px_rgba(9,12,20,0.08)] backdrop-blur-sm md:p-5">
            <form method="get" className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <label htmlFor="q" className="mb-1 block text-xs text-[color:var(--art-ink-muted)]">
                  검색어
                </label>
                <input
                  id="q"
                  name="q"
                  defaultValue={filters.q}
                  placeholder="전시명, 장소명, 태그"
                  className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-[color:var(--art-ink-strong)] placeholder:text-black/35 focus:border-black/40 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="status" className="mb-1 block text-xs text-[color:var(--art-ink-muted)]">
                  상태
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={filters.status}
                  className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-[color:var(--art-ink-strong)] focus:border-black/40 focus:outline-none"
                >
                  {Object.entries(statusFilterLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="city" className="mb-1 block text-xs text-[color:var(--art-ink-muted)]">
                  지역
                </label>
                <select
                  id="city"
                  name="city"
                  defaultValue={filters.city}
                  className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-[color:var(--art-ink-strong)] focus:border-black/40 focus:outline-none"
                >
                  <option value="">전체</option>
                  {meta.availableCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="sort" className="mb-1 block text-xs text-[color:var(--art-ink-muted)]">
                  정렬
                </label>
                <select
                  id="sort"
                  name="sort"
                  defaultValue={filters.sort}
                  className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-[color:var(--art-ink-strong)] focus:border-black/40 focus:outline-none"
                >
                  {Object.entries(sortLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <input type="hidden" name="tag" value={filters.tag} />

              <div className="flex items-end gap-2 md:col-span-1">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[color:var(--art-ink-strong)] px-3 py-2 text-sm font-semibold text-white transition hover:-translate-y-[1px] hover:bg-black"
                >
                  적용
                </button>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--art-ink-muted)]">
              <span>
                검색 결과 {meta.filteredCount}개 / 전체 {meta.totalCount}개
              </span>
              {(filters.q || filters.city || filters.tag || filters.status !== 'all' || filters.sort !== 'latest') && (
                <Link
                  href="/"
                  className="rounded-full border border-black/15 px-3 py-1 text-[color:var(--art-ink-strong)] transition hover:border-black/35"
                >
                  필터 초기화
                </Link>
              )}
            </div>
          </section>

          {meta.availableTags.length > 0 ? (
            <section className="reveal-up reveal-delay-2 mb-6">
              <div className="mb-2 text-xs text-[color:var(--art-ink-muted)]">태그 탐색</div>
              <div className="flex flex-wrap gap-2">
                {meta.availableTags.slice(0, 30).map((tag) => {
                  const active = filters.tag === tag.slug;
                  return (
                    <Link
                      key={tag.id}
                      href={buildQueryHref(filters, { tag: active ? '' : tag.slug })}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? 'border-black bg-black text-white'
                          : 'border-black/15 bg-white/75 text-[color:var(--art-ink-strong)] hover:border-black/35'
                      }`}
                    >
                      #{tag.name}
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {warning ? (
            <div className="mb-6 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">{warning}</div>
          ) : null}

          <div className="reveal-up reveal-delay-2 mb-6 flex items-center justify-between">
            <h2 className="art-display text-2xl md:text-3xl">진행/예정 전시</h2>
            <p className="text-xs text-[color:var(--art-ink-muted)]">
              데이터 출처: {source === 'supabase' ? 'Supabase' : 'Fallback Sample'}
            </p>
          </div>

          {exhibitions.length === 0 ? (
            <div className="rounded-2xl border border-black/15 bg-white/70 p-8 text-center text-[color:var(--art-ink-muted)]">
              조건에 맞는 전시가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {exhibitions.map((item, index) => (
                <Link
                  key={item.id}
                  href={`/exhibitions/${item.slug}`}
                  className="group reveal-up overflow-hidden rounded-[24px] border border-black/15 bg-white/72 shadow-[0_18px_34px_rgba(9,12,20,0.08)] transition hover:-translate-y-1 hover:border-black/35"
                  style={{ animationDelay: `${110 + index * 45}ms` }}
                >
                  <div className="relative h-56 overflow-hidden bg-[linear-gradient(120deg,rgba(255,92,54,0.16),rgba(8,116,242,0.16))]">
                    {item.posterImageUrl ? (
                      <img
                        src={item.posterImageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105 group-hover:rotate-[0.5deg]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-[color:var(--art-ink-muted)]">
                        포스터 준비중
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute left-3 top-3 rounded-full border border-white/50 bg-white/80 px-3 py-1 text-xs text-[color:var(--art-ink-strong)] backdrop-blur">
                      {statusLabel[item.status] ?? item.status}
                    </div>
                  </div>
                  <div className="space-y-2 p-4">
                    <h3 className="art-display line-clamp-2 text-lg leading-tight text-[color:var(--art-ink-strong)]">{item.title}</h3>
                    <p className="text-sm text-[color:var(--art-ink-muted)]">
                      {item.venueName}
                      {item.venueCity ? ` · ${item.venueCity}` : ''}
                    </p>
                    <p className="text-xs text-[color:var(--art-ink-muted)]">{formatPeriod(item.startDate, item.endDate)}</p>
                    <p className="text-xs font-semibold text-[color:var(--art-accent)]">{renderRating(item)}</p>
                    {item.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full border border-black/15 bg-black/[0.03] px-2 py-0.5 text-[10px] text-[color:var(--art-ink-muted)]"
                          >
                            #{tag.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}

          <footer className="mt-12 border-t border-black/10 pt-5 text-xs text-[color:var(--art-ink-muted)]">
            <p>ArtTomato는 전시 관람 결정을 돕기 위한 정보/리뷰 서비스입니다.</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link href="/privacy" className="underline hover:text-[color:var(--art-ink-strong)]">
                개인정보처리방침
              </Link>
              <Link href="/terms" className="underline hover:text-[color:var(--art-ink-strong)]">
                이용약관
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}

function toSingle(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export const getServerSideProps: GetServerSideProps<HomePageProps> = async (context) => {
  const result = await getPublishedExhibitions({
    q: toSingle(context.query.q),
    status: toSingle(context.query.status) as ExhibitionListStatusFilter,
    city: toSingle(context.query.city),
    tag: toSingle(context.query.tag),
    sort: toSingle(context.query.sort) as ExhibitionListSortOption,
  });

  return {
    props: {
      exhibitions: result.data.items,
      source: result.source,
      warning: result.warning,
      filters: result.data.filters,
      meta: result.data.meta,
    },
  };
};
