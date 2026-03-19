export type Carrier = 'kt' | 'skt' | 'lguplus';
export type ReminderRepeatUnit = 'day' | 'week' | 'month' | 'year' | 'event_window';

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

export interface UserMembershipConfig {
  id: string;
  seedKey: string;
  carrier: Carrier;
  provider: string;
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
  createdAt: string;
  updatedAt: string;
}

export const USER_MEMBERSHIP_STORAGE_KEY = 'subscriman:user-membership-presets:v1';

export function createDraftFromSeedPreset(preset: SeedPreset): UserMembershipConfig {
  const meta = preset.template.seedMeta || {};
  const now = new Date().toISOString();

  return {
    id: `draft-${preset.seedKey}-${Date.now()}`,
    seedKey: preset.seedKey,
    carrier: meta.carrier || inferCarrierFromProvider(preset.provider),
    provider: preset.provider,
    displayName: preset.name,
    description: preset.description,
    photos: normalizePhotos(meta.photos || []),
    isActive: meta.defaultEnabled ?? true,
    reminder: {
      enabled: meta.reminder?.enabled ?? true,
      repeatUnit: meta.reminder?.repeatUnit || meta.usageCycleUnit || 'month',
      daysBefore: meta.reminder?.daysBefore ?? 1,
      message:
        meta.reminder?.message ||
        `${preset.name} 혜택 사용 여부를 확인하세요.`,
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
    createdAt: now,
    updatedAt: now,
  };
}

export function inferCarrierFromProvider(provider: string): Carrier {
  const normalized = provider.toLowerCase();
  if (normalized.includes('kt')) return 'kt';
  if (normalized.includes('lg')) return 'lguplus';
  return 'skt';
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

export function loadSavedMembershipConfigs(): UserMembershipConfig[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(USER_MEMBERSHIP_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as UserMembershipConfig[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
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
