export type ExhibitionStatus =
  | 'upcoming'
  | 'ongoing'
  | 'ended'
  | 'hidden'
  | 'pending_review'
  | 'rejected';

export type ReviewRecommendedFor = '혼자' | '친구와' | '데이트' | '가족';
export type ReviewVisitDuration = '30분' | '1시간' | '2시간 이상';
export type ReviewRevisitIntent = '있음' | '보통' | '없음';
export type ReviewCrowdLevel = '여유' | '보통' | '혼잡';
export type ReviewSortOption = 'latest' | 'rating';

export interface VenueSummary {
  name: string;
  city: string | null;
  district: string | null;
  address: string | null;
  websiteUrl: string | null;
}

export interface ExhibitionListItem {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  startDate: string;
  endDate: string;
  status: ExhibitionStatus;
  posterImageUrl: string | null;
  venueName: string;
  venueCity: string | null;
  averageRating: number | null;
  reviewCount: number;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
  }>;
}

export interface ExhibitionReview {
  id: string;
  rating: number;
  oneLineReview: string;
  longReview: string | null;
  recommendedFor: ReviewRecommendedFor | null;
  visitDuration: ReviewVisitDuration | null;
  revisitIntent: ReviewRevisitIntent | null;
  crowdLevel: ReviewCrowdLevel | null;
  reviewImagePaths: string[];
  reviewImageUrls: string[];
  createdAt: string;
  authorName: string;
  authorId: string | null;
}

export interface ExhibitionExternalReview {
  id: string;
  title: string;
  sourceName: string;
  url: string;
  summary: string | null;
  sortOrder: number;
}

export interface ExhibitionDetail extends ExhibitionListItem {
  summary: string | null;
  description: string | null;
  operatingHours: string | null;
  admissionFee: string | null;
  officialUrl: string | null;
  bookingUrl: string | null;
  venue: VenueSummary;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
  }>;
  reviews: ExhibitionReview[];
  externalReviews: ExhibitionExternalReview[];
}

export interface ExhibitionFetchResult<T> {
  source: 'supabase' | 'fallback';
  warning: string | null;
  data: T;
}

export type ExhibitionListStatusFilter = 'all' | 'ongoing' | 'upcoming' | 'ending';
export type ExhibitionListSortOption = 'latest' | 'rating' | 'ending';

export interface ExhibitionListFilters {
  q: string;
  status: ExhibitionListStatusFilter;
  city: string;
  tag: string;
  sort: ExhibitionListSortOption;
}

export interface ExhibitionListMeta {
  availableCities: string[];
  availableTags: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
  }>;
  totalCount: number;
  filteredCount: number;
}
