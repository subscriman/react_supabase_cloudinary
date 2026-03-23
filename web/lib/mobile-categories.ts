export interface MobileCategoryRecord {
  id: string;
  category_key: string;
  label: string;
  short_label: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface MobileCategoryOption {
  id: string;
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

const DEFAULT_MOBILE_CATEGORIES: MobileCategoryOption[] = [
  {
    id: 'ott',
    key: 'ott',
    label: 'OTT 스트리밍',
    shortLabel: 'OTT',
    description: '넷플릭스, 웨이브, 티빙 같은 영상/음악 스트리밍 상품',
    sortOrder: 10,
    isActive: true,
  },
  {
    id: 'delivery',
    key: 'delivery',
    label: '배달',
    shortLabel: '배달',
    description: '배민, 요기요처럼 배달/주문과 연동되는 상품',
    sortOrder: 20,
    isActive: true,
  },
  {
    id: 'telecom',
    key: 'telecom',
    label: '통신사 & 혜택',
    shortLabel: '통신사',
    description: 'KT, SKT, LG U+ 멤버십과 통신사 혜택 상품',
    sortOrder: 30,
    isActive: true,
  },
  {
    id: 't-universe',
    key: 't-universe',
    label: 'T우주 / 생활',
    shortLabel: 'T우주',
    description: 'T우주, 생활형 제휴 혜택, 쿠폰형 상품',
    sortOrder: 40,
    isActive: true,
  },
];

export function normalizeMobileCategoryOption(
  row: MobileCategoryRecord
): MobileCategoryOption {
  return {
    id: row.id,
    key: row.category_key,
    label: row.label,
    shortLabel: row.short_label || row.label,
    description: row.description || '',
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
  };
}

export function getFallbackMobileCategories(): MobileCategoryOption[] {
  return [...DEFAULT_MOBILE_CATEGORIES];
}

export function sortMobileCategories<T extends { sortOrder: number; label: string }>(
  categories: T[]
) {
  return [...categories].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, 'ko-KR')
  );
}

export function findMobileCategoryLabel(
  categories: MobileCategoryOption[],
  key?: string | null
) {
  if (!key) {
    return '카테고리 미지정';
  }

  return categories.find((category) => category.key === key)?.label || key;
}

export function slugifyMobileCategoryKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return normalized || `category-${Date.now()}`;
}
