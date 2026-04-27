import { supabase } from './supabase';
import { STORAGE_BUCKETS } from './storage-policy';
import { createSupabaseServiceRoleClient } from './supabase-server';
import type {
  ExhibitionDetail,
  ExhibitionExternalReview,
  ExhibitionFetchResult,
  ExhibitionListFilters,
  ExhibitionListMeta,
  ExhibitionListItem,
  ExhibitionListSortOption,
  ExhibitionListStatusFilter,
  ExhibitionReview,
  ExhibitionStatus,
  ReviewCrowdLevel,
  ReviewRecommendedFor,
  ReviewRevisitIntent,
  ReviewVisitDuration,
  VenueSummary,
} from './shared-types';
import { dateOnlyToUtcMs, daysUntilDateOnly } from './date-time';

type ExhibitionRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  start_date: string;
  end_date: string;
  status: ExhibitionStatus;
  poster_image_url: string | null;
  additional_image_urls?: string[] | null;
  summary?: string | null;
  description?: string | null;
  operating_hours?: string | null;
  admission_fee?: string | null;
  official_url?: string | null;
  booking_url?: string | null;
  venues?:
    | {
        name?: string | null;
        city?: string | null;
        district?: string | null;
        address?: string | null;
        website_url?: string | null;
      }
    | Array<{
        name?: string | null;
        city?: string | null;
        district?: string | null;
        address?: string | null;
        website_url?: string | null;
      }>
    | null;
};

type RatingRow = {
  exhibition_id: string;
  average_rating: number | string | null;
  review_count: number | string | null;
};

type ExhibitionTagRow = {
  tag:
    | {
        id: string;
        name: string;
        slug: string;
        type: string;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        type: string;
      }>
    | null;
};

type ReviewRow = {
  id: string;
  user_id: string;
  rating: number | string;
  one_line_review: string;
  detailed_review: string | null;
  recommended_for: ReviewRecommendedFor | null;
  visit_duration: ReviewVisitDuration | null;
  revisit_intent: ReviewRevisitIntent | null;
  crowd_level: ReviewCrowdLevel | null;
  review_image_paths: string[] | null;
  created_at: string;
};

type ExternalReviewRow = {
  id: string;
  title: string;
  source_name: string;
  url: string;
  summary: string | null;
  sort_order: number;
};

type ExhibitionListTagRow = {
  exhibition_id: string;
  tag:
    | {
        id: string;
        name: string;
        slug: string;
        type: string;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        type: string;
      }>
    | null;
};

type PublishedExhibitionsData = {
  items: ExhibitionListItem[];
  meta: ExhibitionListMeta;
  filters: ExhibitionListFilters;
};

const DEFAULT_FILTERS: ExhibitionListFilters = {
  q: '',
  status: 'all',
  city: '',
  tag: '',
  sort: 'latest',
};

const ENDING_SOON_DAYS = 14;

const FALLBACK_EXHIBITIONS: ExhibitionDetail[] = [
  {
    id: 'fallback-mmca-seoul-2026',
    slug: 'mmca-seoul-collection-highlight-2026',
    title: 'MMCA 서울 컬렉션 하이라이트 2026',
    subtitle: '현대미술 주요 소장품을 다시 읽는 기획전',
    startDate: '2026-03-01',
    endDate: '2026-06-30',
    status: 'ongoing',
    posterImageUrl:
      'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80',
    venueName: '국립현대미술관 서울',
    venueCity: '서울',
    averageRating: 4.4,
    reviewCount: 12,
    summary:
      '국립현대미술관 주요 소장품을 중심으로 한국 현대미술 흐름을 훑어보는 전시.',
    description:
      '회화, 설치, 영상 작품을 통해 시대별 미술 언어의 변화를 소개한다. 초심자도 감상 포인트를 따라가기 쉽도록 섹션별 안내를 강화했다.',
    operatingHours: '화-일 10:00-18:00 (수, 토 21:00까지)',
    admissionFee: '성인 5,000원',
    officialUrl: 'https://www.mmca.go.kr/exhibitions/progressList.do',
    bookingUrl: null,
    additionalImageUrls: [],
    venue: {
      name: '국립현대미술관 서울',
      city: '서울',
      district: '종로구',
      address: '서울 종로구 삼청로 30',
      websiteUrl: 'https://www.mmca.go.kr',
    },
    tags: [
      { id: 'tag-modern-korean', name: '한국현대미술', slug: 'korean-modern-art', type: 'movement' },
      { id: 'tag-museum', name: '미술관', slug: 'museum', type: 'genre' },
    ],
    reviews: [
      {
        id: 'review-fallback-1',
        rating: 4.5,
        oneLineReview: '작품 설명이 친절해서 전시 초보도 보기 편했어요.',
        longReview: null,
        recommendedFor: '혼자',
        visitDuration: '1시간',
        revisitIntent: '있음',
        crowdLevel: '보통',
        reviewImagePaths: [],
        reviewImageUrls: [],
        createdAt: '2026-03-25T12:20:00+09:00',
        authorName: '아트토마토 유저',
        authorId: null,
      },
    ],
    externalReviews: [
      {
        id: 'external-review-fallback-1',
        title: 'MMCA 전시 심층 리뷰',
        sourceName: 'Art Journal KR',
        url: 'https://www.mmca.go.kr/exhibitions/progressList.do',
        summary: '큐레이터 관점에서 전시 동선과 주요 작품 맥락을 정리한 읽을거리.',
        sortOrder: 100,
      },
    ],
  },
  {
    id: 'fallback-sac-van-gogh-2026',
    slug: 'sac-van-gogh-great-passion-2026',
    title: '불멸의 화가 반 고흐: THE GREAT PASSION',
    subtitle: '반 고흐의 생애와 작품 세계를 따라가는 몰입형 전시',
    startDate: '2026-04-10',
    endDate: '2026-08-16',
    status: 'upcoming',
    posterImageUrl:
      'https://images.unsplash.com/photo-1579783901586-d88db74b4fe4?auto=format&fit=crop&w=1200&q=80',
    venueName: '예술의전당 한가람미술관',
    venueCity: '서울',
    averageRating: null,
    reviewCount: 0,
    summary: '고흐의 주요 작품을 중심으로 작가의 시기별 변화와 편지 기록을 함께 소개.',
    description: '전시 오픈 전이며, 관람객 리뷰는 오픈 후 순차적으로 노출된다.',
    operatingHours: '매일 10:00-19:00',
    admissionFee: '성인 22,000원',
    officialUrl: 'https://www.sac.or.kr/site/main/program/schedule?tab=3',
    bookingUrl: null,
    additionalImageUrls: [],
    venue: {
      name: '예술의전당 한가람미술관',
      city: '서울',
      district: '서초구',
      address: '서울 서초구 남부순환로 2406',
      websiteUrl: 'https://www.sac.or.kr',
    },
    tags: [
      { id: 'tag-van-gogh', name: '반 고흐', slug: 'van-gogh', type: 'artist' },
      { id: 'tag-post-impressionism', name: '후기인상주의', slug: 'post-impressionism', type: 'movement' },
    ],
    reviews: [],
    externalReviews: [],
  },
  {
    id: 'fallback-ddp-media-art-2026',
    slug: 'ddp-media-art-now-2026',
    title: '미디어아트 나우: Seoul Digital Canvas',
    subtitle: '디지털 아트와 인터랙티브 설치를 한 자리에서',
    startDate: '2026-02-14',
    endDate: '2026-05-18',
    status: 'ongoing',
    posterImageUrl:
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80',
    venueName: 'DDP 디자인랩',
    venueCity: '서울',
    averageRating: 4.1,
    reviewCount: 7,
    summary: '디자인과 미디어 기술이 결합된 전시를 통해 최신 창작 트렌드를 소개한다.',
    description: '사진 촬영 가능 구역과 불가능 구역이 구분되어 있으니 현장 안내를 확인해야 한다.',
    operatingHours: '화-일 10:00-20:00',
    admissionFee: '성인 15,000원',
    officialUrl: 'https://ddp.or.kr/index.html?menu_id=2',
    bookingUrl: null,
    additionalImageUrls: [],
    venue: {
      name: 'DDP 디자인랩',
      city: '서울',
      district: '중구',
      address: '서울 중구 을지로 281',
      websiteUrl: 'https://ddp.or.kr',
    },
    tags: [
      { id: 'tag-media-art', name: '미디어아트', slug: 'media-art', type: 'genre' },
      { id: 'tag-interactive', name: '인터랙티브', slug: 'interactive', type: 'style' },
    ],
    reviews: [
      {
        id: 'review-fallback-2',
        rating: 4,
        oneLineReview: '작품 체험이 재미있고 사진 스팟이 많아요.',
        longReview: null,
        recommendedFor: '데이트',
        visitDuration: '2시간 이상',
        revisitIntent: '보통',
        crowdLevel: '혼잡',
        reviewImagePaths: [],
        reviewImageUrls: [],
        createdAt: '2026-03-20T19:05:00+09:00',
        authorName: '디지털아트팬',
        authorId: null,
      },
    ],
    externalReviews: [],
  },
];

function toNumber(input: number | string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeReviewImagePaths(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((path): path is string => typeof path === 'string' && path.trim().length > 0);
}

function normalizeAdditionalImageUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0),
    ),
  ).slice(0, 2);
}

async function buildReviewImageSignedUrlMap(paths: string[]): Promise<Map<string, string>> {
  const picked = Array.from(new Set(paths.filter((path) => path.length > 0)));
  const urlMap = new Map<string, string>();
  if (picked.length === 0) {
    return urlMap;
  }

  try {
    const supabaseService = createSupabaseServiceRoleClient();
    const { data, error } = await supabaseService.storage
      .from(STORAGE_BUCKETS.reviewImages)
      .createSignedUrls(picked, 60 * 60);

    if (error) {
      return urlMap;
    }

    for (let index = 0; index < picked.length; index += 1) {
      urlMap.set(picked[index], data?.[index]?.signedUrl ?? '');
    }
  } catch (_error) {
    return urlMap;
  }

  return urlMap;
}

function withFallbackVenue(venue?: ExhibitionRow['venues']): VenueSummary {
  const picked = Array.isArray(venue) ? venue[0] : venue;
  return {
    name: picked?.name ?? '장소 정보 준비중',
    city: picked?.city ?? null,
    district: picked?.district ?? null,
    address: picked?.address ?? null,
    websiteUrl: picked?.website_url ?? null,
  };
}

function mapRowToListItem(
  row: ExhibitionRow,
  ratingMap: Map<string, { averageRating: number | null; reviewCount: number }>,
): ExhibitionListItem {
  const rating = ratingMap.get(row.id) ?? { averageRating: null, reviewCount: 0 };
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    posterImageUrl: row.poster_image_url ?? null,
    venueName: withFallbackVenue(row.venues).name,
    venueCity: withFallbackVenue(row.venues).city,
    averageRating: rating.averageRating,
    reviewCount: rating.reviewCount,
    tags: [],
  };
}

function mapFallbackToList(items: ExhibitionDetail[]): ExhibitionListItem[] {
  return items.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle,
    startDate: item.startDate,
    endDate: item.endDate,
    status: item.status,
    posterImageUrl: item.posterImageUrl,
    venueName: item.venueName,
    venueCity: item.venueCity,
    averageRating: item.averageRating,
    reviewCount: item.reviewCount,
    tags: item.tags,
  }));
}

function toStatusFilter(input?: string): ExhibitionListStatusFilter {
  const value = (input ?? '').trim();
  if (value === 'ongoing' || value === 'upcoming' || value === 'ending') return value;
  return 'all';
}

function toSortOption(input?: string): ExhibitionListSortOption {
  const value = (input ?? '').trim();
  if (value === 'rating' || value === 'ending') return value;
  return 'latest';
}

function normalizeFilters(filters?: Partial<ExhibitionListFilters>): ExhibitionListFilters {
  return {
    q: (filters?.q ?? '').trim(),
    status: toStatusFilter(filters?.status),
    city: (filters?.city ?? '').trim(),
    tag: (filters?.tag ?? '').trim(),
    sort: toSortOption(filters?.sort),
  };
}

function uniqueBySlug<T extends { slug: string }>(items: T[]): T[] {
  return items.filter((item, index, array) => array.findIndex((target) => target.slug === item.slug) === index);
}

function isEndingSoon(item: ExhibitionListItem): boolean {
  if (item.status !== 'ongoing') return false;
  const daysUntil = daysUntilDateOnly(item.endDate);
  if (daysUntil === null) return false;
  return daysUntil >= 0 && daysUntil <= ENDING_SOON_DAYS;
}

function applyListFilters(items: ExhibitionListItem[], filters: ExhibitionListFilters): ExhibitionListItem[] {
  const q = filters.q.toLowerCase();

  const filtered = items.filter((item) => {
    const matchesQ =
      q.length === 0 ||
      item.title.toLowerCase().includes(q) ||
      (item.subtitle ?? '').toLowerCase().includes(q) ||
      item.venueName.toLowerCase().includes(q) ||
      item.tags.some((tag) => tag.name.toLowerCase().includes(q));

    const matchesStatus =
      filters.status === 'all' ||
      (filters.status === 'ongoing' && item.status === 'ongoing') ||
      (filters.status === 'upcoming' && item.status === 'upcoming') ||
      (filters.status === 'ending' && isEndingSoon(item));

    const matchesCity = filters.city.length === 0 || (item.venueCity ?? '') === filters.city;
    const matchesTag = filters.tag.length === 0 || item.tags.some((tag) => tag.slug === filters.tag);

    return matchesQ && matchesStatus && matchesCity && matchesTag;
  });

  if (filters.sort === 'rating') {
    filtered.sort((a, b) => {
      const aRating = a.averageRating ?? -1;
      const bRating = b.averageRating ?? -1;
      if (bRating !== aRating) return bRating - aRating;
      return b.reviewCount - a.reviewCount;
    });
  } else if (filters.sort === 'ending') {
    filtered.sort((a, b) => {
      const aMs = dateOnlyToUtcMs(a.endDate) ?? Number.MAX_SAFE_INTEGER;
      const bMs = dateOnlyToUtcMs(b.endDate) ?? Number.MAX_SAFE_INTEGER;
      return aMs - bMs;
    });
  } else {
    filtered.sort((a, b) => {
      const aMs = dateOnlyToUtcMs(a.startDate) ?? 0;
      const bMs = dateOnlyToUtcMs(b.startDate) ?? 0;
      return bMs - aMs;
    });
  }

  return filtered;
}

function buildListMeta(allItems: ExhibitionListItem[], filteredItems: ExhibitionListItem[]): ExhibitionListMeta {
  const citySet = new Set<string>();
  const tags: ExhibitionListMeta['availableTags'] = [];

  for (const item of allItems) {
    if (item.venueCity) {
      citySet.add(item.venueCity);
    }
    tags.push(...item.tags);
  }

  const availableCities = Array.from(citySet).sort((a, b) => a.localeCompare(b, 'ko-KR'));
  const availableTags = uniqueBySlug(tags).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

  return {
    availableCities,
    availableTags,
    totalCount: allItems.length,
    filteredCount: filteredItems.length,
  };
}

async function getRatingMap(): Promise<Map<string, { averageRating: number | null; reviewCount: number }>> {
  const map = new Map<string, { averageRating: number | null; reviewCount: number }>();

  const { data } = await supabase
    .from('exhibition_rating_summary')
    .select('exhibition_id, average_rating, review_count');

  for (const row of (data ?? []) as RatingRow[]) {
    map.set(row.exhibition_id, {
      averageRating: toNumber(row.average_rating),
      reviewCount: toNumber(row.review_count) ?? 0,
    });
  }

  return map;
}

export async function getPublishedExhibitions(
  rawFilters?: Partial<ExhibitionListFilters>,
): Promise<ExhibitionFetchResult<PublishedExhibitionsData>> {
  const filters = normalizeFilters(rawFilters);
  try {
    const { data, error } = await supabase
      .from('exhibitions')
      .select(
        `
          id,
          slug,
          title,
          subtitle,
          start_date,
          end_date,
          status,
          poster_image_url,
          venues (
            name,
            city
          )
        `,
      )
      .in('status', ['upcoming', 'ongoing'])
      .order('start_date', { ascending: true })
      .limit(100);

    if (error) throw error;

    const ratingMap = await getRatingMap();
    const baseItems = ((data ?? []) as ExhibitionRow[]).map((row) => mapRowToListItem(row, ratingMap));
    const exhibitionIds = baseItems.map((item) => item.id);

    const { data: listTagRows } = exhibitionIds.length
      ? await supabase
          .from('exhibition_tags')
          .select(
            `
              exhibition_id,
              tag:tags (
                id,
                name,
                slug,
                type
              )
            `,
          )
          .in('exhibition_id', exhibitionIds)
      : { data: [] as ExhibitionListTagRow[] };

    const tagMap = new Map<string, ExhibitionListItem['tags']>();
    for (const row of (listTagRows ?? []) as ExhibitionListTagRow[]) {
      const rowTags = Array.isArray(row.tag) ? row.tag : row.tag ? [row.tag] : [];
      const prev = tagMap.get(row.exhibition_id) ?? [];
      tagMap.set(row.exhibition_id, uniqueBySlug([...prev, ...rowTags]));
    }

    const itemsWithTags = baseItems.map((item) => ({
      ...item,
      tags: tagMap.get(item.id) ?? [],
    }));

    const filtered = applyListFilters(itemsWithTags, filters);
    const meta = buildListMeta(itemsWithTags, filtered);

    if (itemsWithTags.length > 0) {
      return {
        source: 'supabase',
        warning: null,
        data: {
          items: filtered,
          meta,
          filters,
        },
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '전시 목록을 불러오지 못했습니다.';
    const fallbackItems = mapFallbackToList(FALLBACK_EXHIBITIONS);
    const filtered = applyListFilters(fallbackItems, filters);
    const meta = buildListMeta(fallbackItems, filtered);
    return {
      source: 'fallback',
      warning: `${message} 기본 샘플 데이터를 표시합니다.`,
      data: {
        items: filtered,
        meta,
        filters,
      },
    };
  }

  const fallbackItems = mapFallbackToList(FALLBACK_EXHIBITIONS);
  const filtered = applyListFilters(fallbackItems, filters);
  const meta = buildListMeta(fallbackItems, filtered);
  return {
    source: 'fallback',
    warning: '등록된 전시가 아직 없어 기본 샘플 데이터를 표시합니다.',
    data: {
      items: filtered,
      meta,
      filters,
    },
  };
}

export async function getExhibitionBySlug(slug: string): Promise<ExhibitionFetchResult<ExhibitionDetail | null>> {
  try {
    const { data, error } = await supabase
      .from('exhibitions')
      .select(
        `
          id,
          slug,
          title,
          subtitle,
          start_date,
          end_date,
          status,
          poster_image_url,
          additional_image_urls,
          summary,
          description,
          operating_hours,
          admission_fee,
          official_url,
          booking_url,
          venues (
            name,
            city,
            district,
            address,
            website_url
          )
        `,
      )
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { source: 'supabase', warning: null, data: null };
    }

    const ratingMap = await getRatingMap();
    const listItem = mapRowToListItem(data as ExhibitionRow, ratingMap);

    const { data: reviewRows } = await supabase
      .from('reviews')
      .select(
        `
          id,
          user_id,
          rating,
          one_line_review,
          detailed_review,
          recommended_for,
          visit_duration,
          revisit_intent,
          crowd_level,
          review_image_paths,
          created_at
        `,
      )
      .eq('exhibition_id', listItem.id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(20);

    const reviewImagePathList = (reviewRows ?? []).flatMap((review: ReviewRow) =>
      normalizeReviewImagePaths(review.review_image_paths),
    );
    const reviewImageUrlMap = await buildReviewImageSignedUrlMap(reviewImagePathList);

    const { data: tagRows } = await supabase
      .from('exhibition_tags')
      .select(
        `
          tag:tags (
            id,
            name,
            slug,
            type
          )
        `,
      )
      .eq('exhibition_id', listItem.id);

    const { data: externalReviewRows } = await supabase
      .from('exhibition_external_reviews')
      .select('id, title, source_name, url, summary, sort_order')
      .eq('exhibition_id', listItem.id)
      .eq('is_hidden', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    const reviews: ExhibitionReview[] = (reviewRows ?? []).map((review: ReviewRow) => {
      const reviewImagePaths = normalizeReviewImagePaths(review.review_image_paths);
      const reviewImageUrls = reviewImagePaths.map((path) => reviewImageUrlMap.get(path) ?? '');
      return {
        id: review.id,
        rating: Number(review.rating),
        oneLineReview: review.one_line_review,
        longReview: review.detailed_review,
        recommendedFor: review.recommended_for,
        visitDuration: review.visit_duration,
        revisitIntent: review.revisit_intent,
        crowdLevel: review.crowd_level,
        reviewImagePaths,
        reviewImageUrls,
        createdAt: review.created_at,
        authorName: 'ArtTomato 유저',
        authorId: review.user_id,
      };
    });

    const tags = (tagRows ?? [])
      .flatMap((row: ExhibitionTagRow) => (Array.isArray(row.tag) ? row.tag : row.tag ? [row.tag] : []))
      .filter((item, index, arr) => arr.findIndex((target) => target.id === item.id) === index);

    const externalReviews: ExhibitionExternalReview[] = (externalReviewRows ?? []).map((row: ExternalReviewRow) => ({
      id: row.id,
      title: row.title,
      sourceName: row.source_name,
      url: row.url,
      summary: row.summary ?? null,
      sortOrder: row.sort_order,
    }));

    const detail: ExhibitionDetail = {
      ...listItem,
      summary: data.summary ?? null,
      description: data.description ?? null,
      operatingHours: data.operating_hours ?? null,
      admissionFee: data.admission_fee ?? null,
      officialUrl: data.official_url ?? null,
      bookingUrl: data.booking_url ?? null,
      additionalImageUrls: normalizeAdditionalImageUrls(data.additional_image_urls),
      venue: withFallbackVenue(data.venues),
      tags,
      reviews,
      externalReviews,
    };

    return { source: 'supabase', warning: null, data: detail };
  } catch (error) {
    const fallback = FALLBACK_EXHIBITIONS.find((item) => item.slug === slug) ?? null;
    const message = error instanceof Error ? error.message : '전시 상세를 불러오지 못했습니다.';
    return {
      source: 'fallback',
      warning: `${message} 기본 샘플 데이터를 표시합니다.`,
      data: fallback,
    };
  }
}
