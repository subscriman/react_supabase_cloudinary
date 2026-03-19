export type Carrier = 'kt' | 'skt' | 'lguplus' | 'general';
export type ProductType = 'A' | 'B' | 'C' | 'telecom';
export type CatalogKind = 'subscription' | 'telecom';
export type ReminderRepeatUnit =
  | 'day'
  | 'week'
  | 'month'
  | 'year'
  | 'event_window';
export type PaymentCycle = 'monthly' | 'yearly';
export type PaymentMethodType = 'card' | 'account';
export type UsageEntryMode = 'checkbox' | 'amount';

export interface SeedSubProduct {
  name: string;
  type: 'coupon' | 'benefit' | 'service';
  quantity?: number;
  validityPeriod?: number;
  isUsed?: boolean;
  description?: string;
}

export interface SeedReminder {
  type?: string;
  enabled?: boolean;
  repeatUnit?: ReminderRepeatUnit;
  daysBefore?: number;
  message?: string;
}

export interface BenefitTrackerSeed {
  id: string;
  title: string;
  description: string;
  cycleUnit: ReminderRepeatUnit;
  cycleLimit?: number | null;
  annualLimit?: number | null;
  entryMode?: UsageEntryMode;
  overflowMessage?: string;
  cycleAmountLimit?: number | null;
  sharedBudgetKey?: string | null;
  notePlaceholder?: string;
  photos?: string[];
}

export interface SeedMeta {
  carrier?: Carrier;
  membershipGrade?: string;
  presetType?: string;
  programType?: string;
  benefitCategory?: string;
  photos?: string[];
  defaultEnabled?: boolean;
  displayWhenOff?: boolean;
  offStateBehavior?: string;
  usageManualCheckable?: boolean;
  remainingCountModel?: string;
  usageCycleUnit?: ReminderRepeatUnit;
  usageCycleLimit?: number | null;
  annualLimit?: number | null;
  annualLimitOptions?: number[];
  eventWindowRule?: string | null;
  couponValidityRule?: string | null;
  benefitAmountText?: string | null;
  benefitConditionText?: string | null;
  reminder?: SeedReminder;
  sourceUrls?: string[];
  sourceCheckedAt?: string;
  catalogKind?: CatalogKind;
  productType?: ProductType;
  supportsBilling?: boolean;
  tierSuggestions?: string[];
  defaultTier?: string | null;
  defaultPrice?: number | null;
  defaultBillingCycle?: PaymentCycle;
  defaultPaymentMethodType?: PaymentMethodType;
  defaultPaymentMethodLabel?: string;
  usageHistoryTitle?: string;
  usageHistoryEntryMode?: UsageEntryMode;
  usageOverflowMessage?: string;
  usageCycleAmountLimit?: number | null;
  benefitTrackers?: BenefitTrackerSeed[];
}

export interface SeedPreset {
  seedKey: string;
  name: string;
  provider: string;
  description: string;
  isOfficial: boolean;
  createdBy: string;
  likes: number;
  downloads: number;
  template: {
    subscription: {
      name: string;
      provider: string;
      isActive: boolean;
      subProducts: unknown[];
    };
    subProducts: SeedSubProduct[];
    seedMeta?: SeedMeta;
  };
}

export interface SeedData {
  version: string;
  generatedFrom: {
    documentPath: string;
    sourceCheckedAt: string;
  };
  limitations: string[];
  sources: Record<string, string[]>;
  catalogs: Record<string, unknown>;
  recommendedInitialPresetKeys: string[];
  presets: SeedPreset[];
}

export interface UsageEntry {
  id: string;
  checkedAt: string;
  amount?: number | null;
}

export interface BenefitTrackerState extends BenefitTrackerSeed {
  note: string;
  photos: string[];
  entries: UsageEntry[];
}

export interface UserMembershipConfig {
  id: string;
  seedKey: string;
  carrier: Carrier;
  provider: string;
  catalogKind: CatalogKind;
  productType: ProductType;
  displayName: string;
  description: string;
  photos: string[];
  isActive: boolean;
  reminder: {
    enabled: boolean;
    repeatUnit: ReminderRepeatUnit;
    daysBefore: number;
    message: string;
  };
  customRules: {
    usageCycleUnit: ReminderRepeatUnit;
    usageCycleLimit: number | null;
    annualLimit: number | null;
    eventWindowRule: string;
    couponValidityRule: string;
    benefitAmountText: string;
    benefitConditionText: string;
    remainingCountModel: string;
  };
  subProducts: SeedSubProduct[];
  sourceUrls: string[];
  sourceCheckedAt: string;
  supportsBilling: boolean;
  tierSuggestions: string[];
  selectedTier: string;
  price: number | null;
  billingCycle: PaymentCycle;
  paymentDate: string;
  renewalDate: string;
  paymentMethodType: PaymentMethodType;
  paymentMethodLabel: string;
  usageHistoryTitle: string;
  usageHistoryEntryMode: UsageEntryMode;
  usageOverflowMessage: string;
  usageCycleAmountLimit: number | null;
  usageEntries: UsageEntry[];
  benefitTrackers: BenefitTrackerState[];
  createdAt: string;
  updatedAt: string;
}

const LEGACY_STORAGE_KEY = 'subscriman:user-membership-presets:v1';
export const USER_MEMBERSHIP_STORAGE_KEY = 'subscriman:user-membership-presets:v2';

export function buildCatalogPresets(seedData: SeedData): SeedPreset[] {
  return [
    ...buildSampleProductPresets(),
    ...seedData.presets.map<SeedPreset>((preset) => ({
      ...preset,
      template: {
        ...preset.template,
        seedMeta: {
          ...(preset.template.seedMeta || {}),
          catalogKind: 'telecom' as CatalogKind,
          productType: 'telecom' as ProductType,
          supportsBilling: false,
        },
      },
    })),
  ];
}

export function createDraftFromSeedPreset(preset: SeedPreset): UserMembershipConfig {
  const meta = preset.template.seedMeta || {};
  const now = new Date().toISOString();

  return {
    id: `draft-${preset.seedKey}-${Date.now()}`,
    seedKey: preset.seedKey,
    carrier: meta.carrier || inferCarrierFromProvider(preset.provider),
    provider: preset.provider,
    catalogKind: meta.catalogKind || 'telecom',
    productType: meta.productType || 'telecom',
    displayName: preset.name,
    description: preset.description,
    photos: normalizePhotos(meta.photos || []),
    isActive: meta.defaultEnabled ?? true,
    reminder: {
      enabled: meta.reminder?.enabled ?? true,
      repeatUnit: meta.reminder?.repeatUnit || meta.usageCycleUnit || 'month',
      daysBefore: meta.reminder?.daysBefore ?? 1,
      message: meta.reminder?.message || `${preset.name} 혜택 사용 여부를 확인하세요.`,
    },
    customRules: {
      usageCycleUnit: meta.usageCycleUnit || 'month',
      usageCycleLimit: meta.usageCycleLimit ?? null,
      annualLimit: meta.annualLimit ?? null,
      eventWindowRule: meta.eventWindowRule || '',
      couponValidityRule: meta.couponValidityRule || '',
      benefitAmountText: meta.benefitAmountText || '',
      benefitConditionText: meta.benefitConditionText || '',
      remainingCountModel: meta.remainingCountModel || 'monthly_counter',
    },
    subProducts: cloneSubProducts(preset.template.subProducts || []),
    sourceUrls: [...(meta.sourceUrls || [])],
    sourceCheckedAt: meta.sourceCheckedAt || '',
    supportsBilling: meta.supportsBilling ?? meta.catalogKind === 'subscription',
    tierSuggestions: [...(meta.tierSuggestions || [])],
    selectedTier: meta.defaultTier || meta.tierSuggestions?.[0] || '',
    price: meta.defaultPrice ?? null,
    billingCycle: meta.defaultBillingCycle || 'monthly',
    paymentDate: '',
    renewalDate: '',
    paymentMethodType: meta.defaultPaymentMethodType || 'card',
    paymentMethodLabel: meta.defaultPaymentMethodLabel || '',
    usageHistoryTitle: meta.usageHistoryTitle || `${preset.name} 사용 기록`,
    usageHistoryEntryMode: meta.usageHistoryEntryMode || 'checkbox',
    usageOverflowMessage:
      meta.usageOverflowMessage ||
      `${preset.name}는 ${formatCycleLimit(meta.usageCycleUnit || 'month', meta.usageCycleLimit)} 혜택입니다. 그래도 기록할까요?`,
    usageCycleAmountLimit: meta.usageCycleAmountLimit ?? null,
    usageEntries: [],
    benefitTrackers: cloneBenefitTrackers(meta.benefitTrackers || []),
    createdAt: now,
    updatedAt: now,
  };
}

export function inferCarrierFromProvider(provider: string): Carrier {
  const normalized = provider.toLowerCase();
  if (normalized.includes('kt')) return 'kt';
  if (normalized.includes('lg')) return 'lguplus';
  if (normalized.includes('skt') || normalized.includes('t ')) return 'skt';
  return 'general';
}

export function normalizePhotos(photos: string[]): string[] {
  const cleaned = photos
    .map((photo) => photo.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (cleaned.length === 0) {
    return [''];
  }

  return cleaned;
}

export function cloneSubProducts(subProducts: SeedSubProduct[]): SeedSubProduct[] {
  return subProducts.map((subProduct) => ({
    ...subProduct,
  }));
}

export function cloneBenefitTrackers(
  trackers: BenefitTrackerSeed[]
): BenefitTrackerState[] {
  return trackers.map((tracker) => ({
    ...tracker,
    photos: normalizePhotos(tracker.photos || []),
    note: '',
    entries: [],
  }));
}

export function loadSavedMembershipConfigs(): UserMembershipConfig[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const currentRaw = window.localStorage.getItem(USER_MEMBERSHIP_STORAGE_KEY);
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw) as UserMembershipConfig[];
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeSavedConfig);
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      return [];
    }

    const legacyParsed = JSON.parse(legacyRaw) as unknown[];
    if (!Array.isArray(legacyParsed)) {
      return [];
    }

    return legacyParsed.map(migrateLegacyConfig).filter(Boolean) as UserMembershipConfig[];
  } catch (error) {
    console.error('Failed to load saved membership configs:', error);
    return [];
  }
}

export function persistMembershipConfigs(configs: UserMembershipConfig[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    USER_MEMBERSHIP_STORAGE_KEY,
    JSON.stringify(configs)
  );
}

function normalizeSavedConfig(config: UserMembershipConfig): UserMembershipConfig {
  return {
    ...config,
    carrier: config.carrier || 'general',
    catalogKind: config.catalogKind || 'telecom',
    productType: config.productType || 'telecom',
    photos: normalizePhotos(config.photos || []),
    sourceUrls: config.sourceUrls || [],
    sourceCheckedAt: config.sourceCheckedAt || '',
    supportsBilling: config.supportsBilling ?? false,
    tierSuggestions: config.tierSuggestions || [],
    selectedTier: config.selectedTier || '',
    price: config.price ?? null,
    billingCycle: config.billingCycle || 'monthly',
    paymentDate: config.paymentDate || '',
    renewalDate: config.renewalDate || '',
    paymentMethodType: config.paymentMethodType || 'card',
    paymentMethodLabel: config.paymentMethodLabel || '',
    usageHistoryTitle: config.usageHistoryTitle || `${config.displayName} 사용 기록`,
    usageHistoryEntryMode: config.usageHistoryEntryMode || 'checkbox',
    usageOverflowMessage: config.usageOverflowMessage || '',
    usageCycleAmountLimit: config.usageCycleAmountLimit ?? null,
    usageEntries: Array.isArray(config.usageEntries) ? config.usageEntries : [],
    benefitTrackers: Array.isArray(config.benefitTrackers)
      ? config.benefitTrackers.map((tracker) => ({
          ...tracker,
          photos: normalizePhotos(tracker.photos || []),
          entries: Array.isArray(tracker.entries) ? tracker.entries : [],
          note: tracker.note || '',
        }))
      : [],
  };
}

function migrateLegacyConfig(value: unknown): UserMembershipConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const legacy = value as {
    id: string;
    seedKey: string;
    carrier?: Carrier;
    provider?: string;
    displayName?: string;
    description?: string;
    photos?: string[];
    isActive?: boolean;
    reminder?: SeedReminder;
    customRules?: {
      usageCycleUnit?: ReminderRepeatUnit;
      usageCycleLimit?: number | null;
      annualLimit?: number | null;
      eventWindowRule?: string;
      couponValidityRule?: string;
      benefitAmountText?: string;
      benefitConditionText?: string;
      remainingCountModel?: string;
    };
    subProducts?: SeedSubProduct[];
    createdAt?: string;
    updatedAt?: string;
  };

  return {
    id: legacy.id || `migrated-${Date.now()}`,
    seedKey: legacy.seedKey || 'legacy',
    carrier: legacy.carrier || inferCarrierFromProvider(legacy.provider || ''),
    provider: legacy.provider || '',
    catalogKind: 'telecom',
    productType: 'telecom',
    displayName: legacy.displayName || '이전 저장 상품',
    description: legacy.description || '',
    photos: normalizePhotos(legacy.photos || []),
    isActive: legacy.isActive ?? true,
    reminder: {
      enabled: legacy.reminder?.enabled ?? true,
      repeatUnit: legacy.reminder?.repeatUnit || 'month',
      daysBefore: legacy.reminder?.daysBefore ?? 1,
      message: legacy.reminder?.message || '혜택 사용 여부를 확인하세요.',
    },
    customRules: {
      usageCycleUnit: legacy.customRules?.usageCycleUnit || 'month',
      usageCycleLimit: legacy.customRules?.usageCycleLimit ?? null,
      annualLimit: legacy.customRules?.annualLimit ?? null,
      eventWindowRule: legacy.customRules?.eventWindowRule || '',
      couponValidityRule: legacy.customRules?.couponValidityRule || '',
      benefitAmountText: legacy.customRules?.benefitAmountText || '',
      benefitConditionText: legacy.customRules?.benefitConditionText || '',
      remainingCountModel:
        legacy.customRules?.remainingCountModel || 'monthly_counter',
    },
    subProducts: cloneSubProducts(legacy.subProducts || []),
    sourceUrls: [],
    sourceCheckedAt: '',
    supportsBilling: false,
    tierSuggestions: [],
    selectedTier: '',
    price: null,
    billingCycle: 'monthly',
    paymentDate: '',
    renewalDate: '',
    paymentMethodType: 'card',
    paymentMethodLabel: '',
    usageHistoryTitle: `${legacy.displayName || '이전 저장 상품'} 사용 기록`,
    usageHistoryEntryMode: 'checkbox',
    usageOverflowMessage: '',
    usageCycleAmountLimit: null,
    usageEntries: [],
    benefitTrackers: [],
    createdAt: legacy.createdAt || new Date().toISOString(),
    updatedAt: legacy.updatedAt || new Date().toISOString(),
  };
}

function formatCycleLimit(
  cycleUnit: ReminderRepeatUnit,
  cycleLimit?: number | null
): string {
  if (!cycleLimit) {
    return '제한 확인 필요';
  }

  const labelMap: Record<ReminderRepeatUnit, string> = {
    day: '일',
    week: '주',
    month: '월',
    year: '년',
    event_window: '이벤트 기간',
  };

  return `${labelMap[cycleUnit]} ${cycleLimit}회`;
}

function buildSampleProductPresets(): SeedPreset[] {
  const typeAPresets = [
    createSamplePreset({
      seedKey: 'sample-netflix-type-a',
      name: '넷플릭스',
      provider: 'Netflix',
      description:
        '결제일, 갱신일, 가격, 티어, 결제수단을 저장해 관리하는 타입 A 샘플',
      carrier: 'general',
      productType: 'A',
      tierSuggestions: ['광고형 스탠다드', '스탠다드', '프리미엄'],
      supportsBilling: true,
    }),
    createSamplePreset({
      seedKey: 'sample-wavve-type-a',
      name: '웨이브',
      provider: 'Wavve',
      description:
        '갱신일과 결제정보 중심으로 관리하는 국내 OTT 타입 A 샘플',
      carrier: 'general',
      productType: 'A',
      supportsBilling: true,
    }),
    createSamplePreset({
      seedKey: 'sample-tving-type-a',
      name: '티빙',
      provider: 'TVING',
      description: '메모, 이미지, 결제일을 함께 저장하는 타입 A 샘플',
      carrier: 'general',
      productType: 'A',
      supportsBilling: true,
    }),
    createSamplePreset({
      seedKey: 'sample-baemin-type-a',
      name: '배민클럽',
      provider: '배달의민족',
      description: '배달 멤버십의 결제일과 결제수단을 저장하는 타입 A 샘플',
      carrier: 'general',
      productType: 'A',
      supportsBilling: true,
    }),
    createSamplePreset({
      seedKey: 'sample-yogiyo-type-a',
      name: '요기요',
      provider: '요기요',
      description: '배송/할인 구독형 상품을 관리하는 타입 A 샘플',
      carrier: 'general',
      productType: 'A',
      supportsBilling: true,
    }),
    createSamplePreset({
      seedKey: 'sample-coupang-type-a',
      name: '쿠팡',
      provider: '쿠팡',
      description:
        '정기결제형 상품을 결제주기와 결제수단 중심으로 기록하는 타입 A 샘플',
      carrier: 'general',
      productType: 'A',
      supportsBilling: true,
    }),
  ];

  const typeBPreset = createSamplePreset({
    seedKey: 'sample-kt-vip-choice-type-b',
    name: 'KT VIP 초이스',
    provider: 'KT 멤버십',
    description:
      '월 1회, 연 6회 사용 조건을 체크박스와 타임스탬프로 관리하는 타입 B 샘플',
    carrier: 'kt',
    productType: 'B',
    supportsBilling: false,
    sourceUrls: [
      'https://membership.kt.com/vip/choice/ChoiceInfo.do',
      'https://membership.kt.com/vip/choice/VipListHtml.json',
    ],
    sourceCheckedAt: '2026-03-18',
    membershipGrade: 'VIP',
    usageCycleUnit: 'month',
    usageCycleLimit: 1,
    annualLimit: 6,
    usageHistoryTitle: '총 6회 사용 체크',
    usageHistoryEntryMode: 'checkbox',
    usageOverflowMessage:
      'KT VIP 초이스는 월 1회만 사용 가능합니다. 그래도 기록하시겠습니까?',
    benefitAmountText: '월 1회, 연 6회',
    benefitConditionText: '사용 직후 직접 체크해 관리하는 용도',
  });

  const typeCPreset = createSamplePreset({
    seedKey: 'sample-t-universe-life-type-c',
    name: 'T 우주패스 life',
    provider: 'T 우주패스',
    description:
      '기본 결제 정보와 제휴 브랜드별 체크/금액 기록을 함께 관리하는 타입 C 샘플',
    carrier: 'skt',
    productType: 'C',
    supportsBilling: true,
    tierSuggestions: ['월간 결제', '연간 결제'],
    defaultTier: '월간 결제',
    defaultPrice: 9900,
    defaultBillingCycle: 'monthly',
    sourceUrls: [
      'https://m.sktuniverse.co.kr/netfunnel?path=%2Fproduct%2Fdetail%3FprdId%3DPR00000758',
    ],
    sourceCheckedAt: '2026-03-19',
    benefitTrackers: [
      {
        id: 'seven-eleven',
        title: '세븐일레븐 30% 할인',
        description: '일 1회, 투썸플레이스와 합산해 월 3만 원 한도',
        cycleUnit: 'day',
        cycleLimit: 1,
        entryMode: 'amount',
        cycleAmountLimit: 30000,
        sharedBudgetKey: 't-universe-life-cafe-budget',
        overflowMessage:
          '세븐일레븐 혜택은 일 1회 제한입니다. 그래도 기록하시겠습니까?',
        notePlaceholder: '예: 오늘 할인 적용한 영수증 메모',
      },
      {
        id: 'a-twosome-place',
        title: '투썸플레이스 30% 할인',
        description: '일 1회, 세븐일레븐과 합산해 월 3만 원 한도',
        cycleUnit: 'day',
        cycleLimit: 1,
        entryMode: 'amount',
        cycleAmountLimit: 30000,
        sharedBudgetKey: 't-universe-life-cafe-budget',
        overflowMessage:
          '투썸플레이스 혜택은 일 1회 제한입니다. 그래도 기록하시겠습니까?',
        notePlaceholder: '예: 지난달 누락분 소급 체크',
      },
      {
        id: 'starbucks',
        title: '스타벅스 카페라떼 Tall 1잔 무료',
        description: '월 1회 사용 여부 체크',
        cycleUnit: 'month',
        cycleLimit: 1,
        entryMode: 'checkbox',
        overflowMessage:
          '스타벅스 혜택은 월 1회 제공 혜택입니다. 그래도 기록하시겠습니까?',
        notePlaceholder: '예: 바코드 캡처 위치 메모',
      },
      {
        id: 'olive-young',
        title: '올리브영 기프트카드 1만 원권',
        description: '월 1회 번호 등록 및 사용 완료 체크',
        cycleUnit: 'month',
        cycleLimit: 1,
        entryMode: 'checkbox',
        overflowMessage:
          '올리브영 혜택은 월 1회 제공 혜택입니다. 그래도 기록하시겠습니까?',
        notePlaceholder: '예: 카드 번호 또는 등록 메모',
      },
      {
        id: 'emart24',
        title: '이마트24 3,000원권 2매',
        description: '월 2회 각각의 쿠폰 사용 여부 체크',
        cycleUnit: 'month',
        cycleLimit: 2,
        entryMode: 'checkbox',
        overflowMessage:
          '이마트24 혜택은 월 2회 제공 혜택입니다. 그래도 기록하시겠습니까?',
        notePlaceholder: '예: 쿠폰 1장은 삼각김밥 결제에 사용',
      },
    ],
    subProducts: [
      { name: '세븐일레븐 30% 할인', type: 'benefit', description: '일 1회 / 월 3만 원 한도 공유' },
      { name: '투썸플레이스 30% 할인', type: 'benefit', description: '일 1회 / 월 3만 원 한도 공유' },
      { name: '스타벅스 무료 쿠폰', type: 'coupon', description: '월 1회' },
      { name: '올리브영 1만 원권', type: 'coupon', description: '월 1회' },
      { name: '이마트24 3,000원권 2매', type: 'coupon', description: '월 2회' },
    ],
  });

  return [...typeAPresets, typeBPreset, typeCPreset];
}

function createSamplePreset(input: {
  seedKey: string;
  name: string;
  provider: string;
  description: string;
  carrier: Carrier;
  productType: ProductType;
  supportsBilling: boolean;
  tierSuggestions?: string[];
  defaultTier?: string;
  defaultPrice?: number | null;
  defaultBillingCycle?: PaymentCycle;
  sourceUrls?: string[];
  sourceCheckedAt?: string;
  membershipGrade?: string;
  usageCycleUnit?: ReminderRepeatUnit;
  usageCycleLimit?: number | null;
  annualLimit?: number | null;
  usageHistoryTitle?: string;
  usageHistoryEntryMode?: UsageEntryMode;
  usageOverflowMessage?: string;
  benefitAmountText?: string | null;
  benefitConditionText?: string | null;
  benefitTrackers?: BenefitTrackerSeed[];
  subProducts?: SeedSubProduct[];
}): SeedPreset {
  return {
    seedKey: input.seedKey,
    name: input.name,
    provider: input.provider,
    description: input.description,
    isOfficial: true,
    createdBy: 'admin',
    likes: 0,
    downloads: 0,
    template: {
      subscription: {
        name: input.name,
        provider: input.provider,
        isActive: true,
        subProducts: [],
      },
      subProducts: input.subProducts || [],
      seedMeta: {
        carrier: input.carrier,
        catalogKind: 'subscription',
        productType: input.productType,
        supportsBilling: input.supportsBilling,
        tierSuggestions: input.tierSuggestions || [],
        defaultTier: input.defaultTier || input.tierSuggestions?.[0] || '',
        defaultPrice: input.defaultPrice ?? null,
        defaultBillingCycle: input.defaultBillingCycle || 'monthly',
        defaultPaymentMethodType: 'card',
        defaultEnabled: true,
        sourceUrls: input.sourceUrls || [],
        sourceCheckedAt: input.sourceCheckedAt || '',
        membershipGrade: input.membershipGrade,
        usageManualCheckable: input.productType === 'B' || input.productType === 'C',
        usageCycleUnit: input.usageCycleUnit,
        usageCycleLimit: input.usageCycleLimit ?? null,
        annualLimit: input.annualLimit ?? null,
        usageHistoryTitle: input.usageHistoryTitle,
        usageHistoryEntryMode: input.usageHistoryEntryMode,
        usageOverflowMessage: input.usageOverflowMessage,
        benefitAmountText: input.benefitAmountText ?? '',
        benefitConditionText: input.benefitConditionText ?? '',
        benefitTrackers: input.benefitTrackers || [],
      },
    },
  };
}
