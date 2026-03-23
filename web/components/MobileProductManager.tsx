import { useEffect, useMemo, useState } from 'react';
import {
  MobileCategoryOption,
  findMobileCategoryLabel,
  getFallbackMobileCategories,
  sortMobileCategories,
} from '../lib/mobile-categories';
import { supabase } from '../lib/supabase';
import { PartnerOption, formatPartnerLabel } from '../lib/partners';
import {
  BenefitTrackerDisplayMode,
  Carrier,
  ManagedSeedPreset,
  MobileCatalogCategory,
  PaymentCycle,
  PaymentMethodType,
  ProductType,
  ReminderRepeatUnit,
  SeedPreset,
  SeedSubProduct,
  UsageEntryMode,
  buildSubscriptionPresetRowInput,
  getSubscriptionSamplePresets,
  isMobileSubscriptionPreset,
} from '../lib/user-membership';

type EditableProductType = Exclude<ProductType, 'telecom'>;
type SubProductType = SeedSubProduct['type'];

interface MobileProductManagerProps {
  products: ManagedSeedPreset[];
  categories: MobileCategoryOption[];
  partners: PartnerOption[];
  loading: boolean;
  onReload: () => Promise<void>;
}

interface ProductDraft {
  dbId: string;
  seedKey: string;
  name: string;
  provider: string;
  description: string;
  productType: EditableProductType;
  carrier: Carrier;
  partnerId: string;
  mobileCategory: MobileCatalogCategory;
  mobileEnabled: boolean;
  photos: string[];
  sourceUrls: string[];
  sourceCheckedAt: string;
  tierSuggestionsText: string;
  defaultTier: string;
  defaultPrice: string;
  defaultBillingCycle: PaymentCycle;
  defaultPaymentMethodType: PaymentMethodType;
  defaultPaymentMethodLabel: string;
  membershipGrade: string;
  usageCycleUnit: ReminderRepeatUnit;
  usageCycleLimit: string;
  annualLimit: string;
  usageHistoryTitle: string;
  usageHistoryEntryMode: UsageEntryMode;
  usageOverflowMessage: string;
  benefitAmountText: string;
  benefitConditionText: string;
  subProducts: SubProductDraft[];
  benefitTrackers: BenefitTrackerDraft[];
  homeFeatured: boolean;
  homeFeaturedOrder: string;
  recommendVisible: boolean;
  recommendOrder: string;
}

interface SubProductDraft {
  name: string;
  type: SubProductType;
  description: string;
  quantity: string;
  validityPeriod: string;
}

interface BenefitTrackerDraft {
  id: string;
  title: string;
  description: string;
  groupTitle: string;
  displayMode: BenefitTrackerDisplayMode;
  cycleUnit: ReminderRepeatUnit;
  cycleLimit: string;
  annualLimit: string;
  entryMode: UsageEntryMode;
  overflowMessage: string;
}

const inputClassName =
  'w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500';

const textAreaClassName = `${inputClassName} min-h-[112px] resize-y`;

const productTypeOptions: Array<{ value: EditableProductType; label: string }> = [
  { value: 'A', label: '타입 A' },
  { value: 'B', label: '타입 B' },
  { value: 'C', label: '타입 C' },
  { value: 'D', label: '타입 D' },
];

const carrierOptions: Array<{ value: Carrier; label: string }> = [
  { value: 'general', label: '일반 서비스' },
  { value: 'kt', label: 'KT' },
  { value: 'skt', label: 'SKT' },
  { value: 'lguplus', label: 'LG U+' },
];

const cycleOptions: Array<{ value: ReminderRepeatUnit; label: string }> = [
  { value: 'day', label: '일' },
  { value: 'week', label: '주' },
  { value: 'month', label: '월' },
  { value: 'year', label: '년' },
  { value: 'event_window', label: '이벤트 기간' },
];

const paymentCycleOptions: Array<{ value: PaymentCycle; label: string }> = [
  { value: 'monthly', label: '월 결제' },
  { value: 'yearly', label: '연간 결제' },
];

const paymentMethodOptions: Array<{ value: PaymentMethodType; label: string }> = [
  { value: 'card', label: '카드' },
  { value: 'account', label: '계좌' },
];

const usageEntryModeOptions: Array<{ value: UsageEntryMode; label: string }> = [
  { value: 'checkbox', label: '체크박스' },
  { value: 'amount', label: '금액 기록' },
];

const trackerDisplayOptions: Array<{
  value: BenefitTrackerDisplayMode;
  label: string;
}> = [
  { value: 'check', label: '체크형' },
  { value: 'info', label: '정보형' },
];

function createEmptySubProduct(): SubProductDraft {
  return {
    name: '',
    type: 'benefit',
    description: '',
    quantity: '',
    validityPeriod: '',
  };
}

function createEmptyTracker(): BenefitTrackerDraft {
  const timestamp = Date.now().toString(36);
  return {
    id: `tracker-${timestamp}`,
    title: '',
    description: '',
    groupTitle: '',
    displayMode: 'check',
    cycleUnit: 'month',
    cycleLimit: '',
    annualLimit: '',
    entryMode: 'checkbox',
    overflowMessage: '',
  };
}

function createEmptyDraft(defaultCategory: MobileCatalogCategory = 'ott'): ProductDraft {
  return {
    dbId: '',
    seedKey: '',
    name: '',
    provider: '',
    description: '',
    productType: 'A',
    carrier: 'general',
    partnerId: '',
    mobileCategory: defaultCategory,
    mobileEnabled: true,
    photos: [''],
    sourceUrls: [''],
    sourceCheckedAt: '',
    tierSuggestionsText: '',
    defaultTier: '',
    defaultPrice: '',
    defaultBillingCycle: 'monthly',
    defaultPaymentMethodType: 'card',
    defaultPaymentMethodLabel: '',
    membershipGrade: '',
    usageCycleUnit: 'month',
    usageCycleLimit: '',
    annualLimit: '',
    usageHistoryTitle: '',
    usageHistoryEntryMode: 'checkbox',
    usageOverflowMessage: '',
    benefitAmountText: '',
    benefitConditionText: '',
    subProducts: [createEmptySubProduct()],
    benefitTrackers: [createEmptyTracker()],
    homeFeatured: false,
    homeFeaturedOrder: '',
    recommendVisible: false,
    recommendOrder: '',
  };
}

function slugifySeedKey(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return normalized || `mobile-${Date.now()}`;
}

function parseCsvList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ensureAtLeastOne(values: string[]) {
  return values.length ? values : [''];
}

function toDraft(
  preset: SeedPreset & Partial<ManagedSeedPreset>,
  defaultCategory: MobileCatalogCategory = 'ott'
): ProductDraft {
  const meta = preset.template.seedMeta || {};

  return {
    dbId: 'dbId' in preset ? preset.dbId || '' : '',
    seedKey: preset.seedKey,
    name: preset.name,
    provider: preset.provider,
    description: preset.description,
    productType: (meta.productType || 'A') as EditableProductType,
    carrier: meta.carrier || 'general',
    partnerId: meta.partnerId || '',
    mobileCategory: meta.mobileCategory || defaultCategory,
    mobileEnabled: meta.mobileEnabled ?? meta.defaultEnabled ?? true,
    photos: ensureAtLeastOne([...(meta.photos || [])]),
    sourceUrls: ensureAtLeastOne([...(meta.sourceUrls || [])]),
    sourceCheckedAt: meta.sourceCheckedAt || '',
    tierSuggestionsText: (meta.tierSuggestions || []).join(', '),
    defaultTier: meta.defaultTier || '',
    defaultPrice: meta.defaultPrice != null ? String(meta.defaultPrice) : '',
    defaultBillingCycle: meta.defaultBillingCycle || 'monthly',
    defaultPaymentMethodType: meta.defaultPaymentMethodType || 'card',
    defaultPaymentMethodLabel: meta.defaultPaymentMethodLabel || '',
    membershipGrade: meta.membershipGrade || '',
    usageCycleUnit: meta.usageCycleUnit || 'month',
    usageCycleLimit: meta.usageCycleLimit != null ? String(meta.usageCycleLimit) : '',
    annualLimit: meta.annualLimit != null ? String(meta.annualLimit) : '',
    usageHistoryTitle: meta.usageHistoryTitle || '',
    usageHistoryEntryMode: meta.usageHistoryEntryMode || 'checkbox',
    usageOverflowMessage: meta.usageOverflowMessage || '',
    benefitAmountText: meta.benefitAmountText || '',
    benefitConditionText: meta.benefitConditionText || '',
    subProducts:
      preset.template.subProducts.length > 0
        ? preset.template.subProducts.map((subProduct) => ({
            name: subProduct.name || '',
            type: subProduct.type,
            description: subProduct.description || '',
            quantity:
              subProduct.quantity != null ? String(subProduct.quantity) : '',
            validityPeriod:
              subProduct.validityPeriod != null
                ? String(subProduct.validityPeriod)
                : '',
          }))
        : [createEmptySubProduct()],
    benefitTrackers:
      meta.benefitTrackers && meta.benefitTrackers.length > 0
        ? meta.benefitTrackers.map((tracker) => ({
            id: tracker.id,
            title: tracker.title,
            description: tracker.description,
            groupTitle: tracker.groupTitle || '',
            displayMode: tracker.displayMode || 'check',
            cycleUnit: tracker.cycleUnit,
            cycleLimit:
              tracker.cycleLimit != null ? String(tracker.cycleLimit) : '',
            annualLimit:
              tracker.annualLimit != null ? String(tracker.annualLimit) : '',
            entryMode: tracker.entryMode || 'checkbox',
            overflowMessage: tracker.overflowMessage || '',
          }))
        : [createEmptyTracker()],
    homeFeatured: meta.homeFeatured ?? false,
    homeFeaturedOrder:
      meta.homeFeaturedOrder != null ? String(meta.homeFeaturedOrder) : '',
    recommendVisible: meta.recommendVisible ?? false,
    recommendOrder:
      meta.recommendOrder != null ? String(meta.recommendOrder) : '',
  };
}

function toSeedPreset(draft: ProductDraft): SeedPreset {
  const tierSuggestions = parseCsvList(draft.tierSuggestionsText);
  const defaultPrice = parseNullableNumber(draft.defaultPrice);
  const subProducts = draft.subProducts
    .filter((item) => item.name.trim() || item.description.trim())
    .map<SeedSubProduct>((item) => ({
      name: item.name.trim(),
      type: item.type,
      description: item.description.trim() || undefined,
      quantity: parseNullableNumber(item.quantity) ?? undefined,
      validityPeriod: parseNullableNumber(item.validityPeriod) ?? undefined,
    }));
  const benefitTrackers =
    draft.productType === 'C'
      ? draft.benefitTrackers
          .filter((tracker) => tracker.title.trim())
          .map((tracker) => ({
            id: tracker.id || slugifySeedKey(`${draft.name}-${tracker.title}`),
            title: tracker.title.trim(),
            description: tracker.description.trim(),
            groupTitle: tracker.groupTitle.trim() || undefined,
            displayMode: tracker.displayMode,
            cycleUnit: tracker.cycleUnit,
            cycleLimit: parseNullableNumber(tracker.cycleLimit),
            annualLimit: parseNullableNumber(tracker.annualLimit),
            entryMode: tracker.entryMode,
            overflowMessage: tracker.overflowMessage.trim() || undefined,
          }))
      : [];

  const meta = {
    seedKey: draft.seedKey || slugifySeedKey(`${draft.name}-${draft.productType}`),
    partnerId: draft.partnerId || null,
    carrier: draft.carrier,
    partnerName: null,
    catalogKind: 'subscription' as const,
    productType: draft.productType,
    mobileCategory: draft.mobileCategory,
    mobileEnabled: draft.mobileEnabled,
    homeFeatured: draft.homeFeatured,
    homeFeaturedOrder: parseNullableNumber(draft.homeFeaturedOrder),
    recommendVisible: draft.recommendVisible,
    recommendOrder: parseNullableNumber(draft.recommendOrder),
    supportsBilling: true,
    photos: ensureAtLeastOne(
      draft.photos.map((photo) => photo.trim()).filter(Boolean)
    ),
    sourceUrls: draft.sourceUrls.map((url) => url.trim()).filter(Boolean),
    sourceCheckedAt: draft.sourceCheckedAt.trim(),
    tierSuggestions,
    defaultTier: draft.defaultTier.trim(),
    defaultPrice,
    defaultBillingCycle: draft.defaultBillingCycle,
    defaultPaymentMethodType: draft.defaultPaymentMethodType,
    defaultPaymentMethodLabel: draft.defaultPaymentMethodLabel.trim(),
    membershipGrade: draft.membershipGrade.trim() || undefined,
    usageManualCheckable:
      draft.productType === 'B' ||
      draft.productType === 'C' ||
      draft.productType === 'D',
    usageCycleUnit: draft.productType === 'B' ? draft.usageCycleUnit : undefined,
    usageCycleLimit:
      draft.productType === 'B'
        ? parseNullableNumber(draft.usageCycleLimit)
        : null,
    annualLimit:
      draft.productType === 'B' ? parseNullableNumber(draft.annualLimit) : null,
    usageHistoryTitle:
      draft.productType === 'B'
        ? draft.usageHistoryTitle.trim()
        : '',
    usageHistoryEntryMode:
      draft.productType === 'B' ? draft.usageHistoryEntryMode : undefined,
    usageOverflowMessage:
      draft.productType === 'B'
        ? draft.usageOverflowMessage.trim()
        : '',
    benefitAmountText:
      draft.productType === 'B' ? draft.benefitAmountText.trim() : '',
    benefitConditionText:
      draft.productType === 'B' ? draft.benefitConditionText.trim() : '',
    benefitTrackers,
  };

  return {
    seedKey: meta.seedKey,
    name: draft.name.trim(),
    provider: draft.provider.trim(),
    description: draft.description.trim(),
    isOfficial: true,
    createdBy: 'admin',
    likes: 0,
    downloads: 0,
    template: {
      subscription: {
        name: draft.name.trim(),
        provider: draft.provider.trim(),
        isActive: draft.mobileEnabled,
        subProducts: [],
      },
      subProducts,
      seedMeta: meta,
    },
  };
}

function updateStringArray(
  values: string[],
  index: number,
  nextValue: string
) {
  return values.map((value, valueIndex) => (valueIndex === index ? nextValue : value));
}

export default function MobileProductManager({
  products,
  categories,
  partners,
  loading,
  onReload,
}: MobileProductManagerProps) {
  const availableCategories = useMemo(
    () =>
      sortMobileCategories(
        categories.length ? categories : getFallbackMobileCategories()
      ),
    [categories]
  );
  const defaultCategoryKey = availableCategories[0]?.key || 'ott';
  const [draft, setDraft] = useState<ProductDraft>(() =>
    createEmptyDraft(defaultCategoryKey)
  );
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const samplePresets = useMemo(
    () => getSubscriptionSamplePresets().filter(isMobileSubscriptionPreset),
    []
  );

  useEffect(() => {
    if (!message) return;

    const timeoutId = window.setTimeout(() => setMessage(''), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    setDraft((prev) => {
      if (
        prev.mobileCategory &&
        availableCategories.some((category) => category.key === prev.mobileCategory)
      ) {
        return prev;
      }

      return {
        ...prev,
        mobileCategory: defaultCategoryKey,
      };
    });
  }, [availableCategories, defaultCategoryKey]);

  const startNewDraft = () => {
    setDraft(createEmptyDraft(defaultCategoryKey));
  };

  const handleLoadPreset = (preset: SeedPreset | ManagedSeedPreset) => {
    setDraft(toDraft(preset, defaultCategoryKey));
  };

  const handleSave = async () => {
    if (!draft.name.trim() || !draft.provider.trim()) {
      alert('상품명과 제공업체를 입력해 주세요.');
      return;
    }

    setSaving(true);

    try {
      const selectedPartner =
        partners.find((partner) => partner.id === draft.partnerId) || null;
      const nextPreset = toSeedPreset({
        ...draft,
        seedKey: draft.seedKey || slugifySeedKey(`${draft.name}-${draft.productType}`),
        partnerId: selectedPartner?.id || '',
      });
      if (nextPreset.template.seedMeta) {
        nextPreset.template.seedMeta.partnerId = selectedPartner?.id || null;
        nextPreset.template.seedMeta.partnerName = selectedPartner?.partnerName || null;
      }
      const payload = buildSubscriptionPresetRowInput(nextPreset);

      if (draft.dbId) {
        const { error } = await supabase
          .from('subscription_presets')
          .update({
            name: payload.name,
            provider: payload.provider,
            description: payload.description,
            template: payload.template,
            is_official: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft.dbId);

        if (error) throw error;

        setMessage('상품 정보를 수정했습니다.');
      } else {
        const { data, error } = await supabase
          .from('subscription_presets')
          .insert([
            {
              ...payload,
            },
          ])
          .select('*')
          .single();

        if (error) throw error;

        setDraft((prev) => ({
          ...prev,
          dbId: data.id,
          seedKey: prev.seedKey || slugifySeedKey(`${prev.name}-${prev.productType}`),
        }));
        setMessage('상품을 새로 등록했습니다.');
      }

      await onReload();
    } catch (error) {
      console.error('Failed to save mobile product:', error);
      alert('상품 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft.dbId) {
      startNewDraft();
      return;
    }

    if (!confirm(`"${draft.name}" 상품을 삭제할까요?`)) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('subscription_presets')
        .delete()
        .eq('id', draft.dbId);

      if (error) throw error;

      setMessage('상품을 삭제했습니다.');
      startNewDraft();
      await onReload();
    } catch (error) {
      console.error('Failed to delete mobile product:', error);
      alert('상품 삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
      <aside className="space-y-6">
        <section className="rounded-[28px] border border-white/60 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">상품 관리</h2>
              <p className="mt-1 text-sm text-slate-500">
                모바일 `/m`에 노출할 상품을 등록하고 수정합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={startNewDraft}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              새 상품
            </button>
          </div>

          {message ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                등록된 상품을 불러오는 중입니다.
              </div>
            ) : products.length ? (
              products.map((product) => {
                const meta = product.template.seedMeta || {};
                const isSelected = draft.dbId === product.dbId;

                return (
                  <button
                    key={product.dbId}
                    type="button"
                    onClick={() => handleLoadPreset(product)}
                    className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{product.name}</p>
                        <p
                          className={`mt-1 text-xs ${
                            isSelected ? 'text-white/75' : 'text-slate-500'
                          }`}
                        >
                          {product.provider}
                        </p>
                        {meta.partnerName ? (
                          <p
                            className={`mt-1 text-[11px] ${
                              isSelected ? 'text-white/65' : 'text-slate-400'
                            }`}
                          >
                            파트너: {meta.partnerName}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2 text-[11px]">
                        <span className="rounded-full border border-current/20 px-2 py-1">
                          타입 {meta.productType || 'A'}
                        </span>
                        <span className="rounded-full border border-current/20 px-2 py-1">
                          {findMobileCategoryLabel(
                            availableCategories,
                            meta.mobileCategory
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                아직 저장된 모바일 상품이 없습니다.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/60 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h3 className="text-base font-semibold text-slate-900">현재 모바일 샘플 불러오기</h3>
          <p className="mt-1 text-sm text-slate-500">
            지금 `/m`에 보이는 기본 샘플을 편집 폼으로 불러옵니다.
          </p>
          <div className="mt-4 space-y-3">
            {samplePresets.map((preset) => (
              <button
                key={preset.seedKey}
                type="button"
                onClick={() => handleLoadPreset(preset)}
                className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-slate-300"
              >
                <p className="text-sm font-semibold text-slate-900">{preset.name}</p>
                <p className="mt-1 text-xs text-slate-500">{preset.description}</p>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="rounded-[28px] border border-white/60 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-teal)]">
              Mobile Product
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              {draft.dbId ? '상품 수정' : '새 상품 등록'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              타입 A~D에 맞는 모듈만 열어 편집하고, 저장하면 모바일 `/m`에 반영됩니다.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
            >
              {draft.dbId ? '삭제' : '초기화'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        <div className="mt-8 space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">상품명</label>
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                className={inputClassName}
                placeholder="예: 넷플릭스"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">제공업체</label>
              <input
                value={draft.provider}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, provider: event.target.value }))
                }
                className={inputClassName}
                placeholder="예: Netflix"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">상품 타입</label>
              <select
                value={draft.productType}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    productType: event.target.value as EditableProductType,
                  }))
                }
                className={inputClassName}
              >
                {productTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">카테고리</label>
              <select
                value={draft.mobileCategory}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    mobileCategory: event.target.value as MobileCatalogCategory,
                  }))
                }
                className={inputClassName}
              >
                {availableCategories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">통신사</label>
              <select
                value={draft.carrier}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    carrier: event.target.value as Carrier,
                  }))
                }
                className={inputClassName}
              >
                {carrierOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                파트너사
              </label>
              <select
                value={draft.partnerId}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    partnerId: event.target.value,
                  }))
                }
                className={inputClassName}
              >
                <option value="">선택 안 함</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {formatPartnerLabel(partner)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">시드 키</label>
              <input
                value={draft.seedKey}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, seedKey: event.target.value }))
                }
                className={inputClassName}
                placeholder="비워두면 자동 생성"
              />
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={draft.mobileEnabled}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    mobileEnabled: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-slate-900"
              />
              모바일 노출
            </label>
          </section>

          <section>
            <label className="mb-2 block text-sm font-medium text-slate-700">상품 설명</label>
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value }))
              }
              className={textAreaClassName}
              placeholder="모바일 카드와 상세 화면에 들어갈 설명"
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  대표 이미지 URL
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, photos: [...prev.photos, ''] }))
                  }
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  + 추가
                </button>
              </div>
              <div className="space-y-3">
                {draft.photos.map((photo, index) => (
                  <div key={`photo-${index}`} className="flex gap-3">
                    <input
                      value={photo}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          photos: updateStringArray(prev.photos, index, event.target.value),
                        }))
                      }
                      className={inputClassName}
                      placeholder={`이미지 URL ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          photos:
                            prev.photos.length === 1
                              ? ['']
                              : prev.photos.filter((_, valueIndex) => valueIndex !== index),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 px-3 text-sm text-slate-500"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  공식 안내 URL
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, sourceUrls: [...prev.sourceUrls, ''] }))
                  }
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  + 추가
                </button>
              </div>
              <div className="space-y-3">
                {draft.sourceUrls.map((url, index) => (
                  <div key={`url-${index}`} className="flex gap-3">
                    <input
                      value={url}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          sourceUrls: updateStringArray(
                            prev.sourceUrls,
                            index,
                            event.target.value
                          ),
                        }))
                      }
                      className={inputClassName}
                      placeholder={`공식 URL ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          sourceUrls:
                            prev.sourceUrls.length === 1
                              ? ['']
                              : prev.sourceUrls.filter(
                                  (_, valueIndex) => valueIndex !== index
                                ),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 px-3 text-sm text-slate-500"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  정보 확인일
                </label>
                <input
                  type="date"
                  value={draft.sourceCheckedAt}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      sourceCheckedAt: event.target.value,
                    }))
                  }
                  className={inputClassName}
                />
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-semibold text-slate-900">기본 결제 / 플랜 정보</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="xl:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  티어 목록
                </label>
                <input
                  value={draft.tierSuggestionsText}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      tierSuggestionsText: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="예: 광고형 스탠다드, 스탠다드, 프리미엄"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">기본 티어</label>
                <input
                  value={draft.defaultTier}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, defaultTier: event.target.value }))
                  }
                  className={inputClassName}
                  placeholder="기본 선택값"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">기본 가격</label>
                <input
                  type="number"
                  min="0"
                  value={draft.defaultPrice}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, defaultPrice: event.target.value }))
                  }
                  className={inputClassName}
                  placeholder="9900"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">결제 주기</label>
                <select
                  value={draft.defaultBillingCycle}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      defaultBillingCycle: event.target.value as PaymentCycle,
                    }))
                  }
                  className={inputClassName}
                >
                  {paymentCycleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">결제 수단 유형</label>
                <select
                  value={draft.defaultPaymentMethodType}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      defaultPaymentMethodType: event.target.value as PaymentMethodType,
                    }))
                  }
                  className={inputClassName}
                >
                  {paymentMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  기본 결제 수단 라벨
                </label>
                <input
                  value={draft.defaultPaymentMethodLabel}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      defaultPaymentMethodLabel: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="예: 현대카드, 우리은행"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">서브 상품 / 혜택 목록</h3>
                <p className="mt-1 text-sm text-slate-500">
                  타입 C, D는 물론 다른 타입도 상세 정보로 함께 노출할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    subProducts: [...prev.subProducts, createEmptySubProduct()],
                  }))
                }
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
              >
                + 항목 추가
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {draft.subProducts.map((subProduct, index) => (
                <div
                  key={`sub-product-${index}`}
                  className="rounded-[22px] border border-white bg-white p-4"
                >
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),160px,120px,120px]">
                    <input
                      value={subProduct.name}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          subProducts: prev.subProducts.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: event.target.value }
                              : item
                          ),
                        }))
                      }
                      className={inputClassName}
                      placeholder="항목명"
                    />
                    <select
                      value={subProduct.type}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          subProducts: prev.subProducts.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  type: event.target.value as SubProductType,
                                }
                              : item
                          ),
                        }))
                      }
                      className={inputClassName}
                    >
                      <option value="coupon">쿠폰</option>
                      <option value="benefit">혜택</option>
                      <option value="service">서비스</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={subProduct.quantity}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          subProducts: prev.subProducts.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, quantity: event.target.value }
                              : item
                          ),
                        }))
                      }
                      className={inputClassName}
                      placeholder="수량"
                    />
                    <input
                      type="number"
                      min="0"
                      value={subProduct.validityPeriod}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          subProducts: prev.subProducts.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, validityPeriod: event.target.value }
                              : item
                          ),
                        }))
                      }
                      className={inputClassName}
                      placeholder="유효기간"
                    />
                  </div>
                  <textarea
                    value={subProduct.description}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        subProducts: prev.subProducts.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, description: event.target.value }
                            : item
                        ),
                      }))
                    }
                    className={`${textAreaClassName} mt-3 min-h-[88px]`}
                    placeholder="서브 상품 설명"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          subProducts:
                            prev.subProducts.length === 1
                              ? [createEmptySubProduct()]
                              : prev.subProducts.filter(
                                  (_, itemIndex) => itemIndex !== index
                                ),
                        }))
                      }
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {draft.productType === 'B' ? (
            <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold text-slate-900">타입 B 모듈</h3>
              <p className="mt-1 text-sm text-slate-500">
                월/연 사용 제한과 체크 기록 문구를 설정합니다.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">회원 등급</label>
                  <input
                    value={draft.membershipGrade}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        membershipGrade: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    placeholder="예: VIP"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">주기 단위</label>
                  <select
                    value={draft.usageCycleUnit}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        usageCycleUnit: event.target.value as ReminderRepeatUnit,
                      }))
                    }
                    className={inputClassName}
                  >
                    {cycleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">주기 한도</label>
                  <input
                    type="number"
                    min="0"
                    value={draft.usageCycleLimit}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        usageCycleLimit: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    placeholder="예: 1"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">연간 한도</label>
                  <input
                    type="number"
                    min="0"
                    value={draft.annualLimit}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        annualLimit: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    placeholder="예: 6"
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    사용 기록 제목
                  </label>
                  <input
                    value={draft.usageHistoryTitle}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        usageHistoryTitle: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    placeholder="예: 총 6회 사용 체크"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    기록 방식
                  </label>
                  <select
                    value={draft.usageHistoryEntryMode}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        usageHistoryEntryMode: event.target.value as UsageEntryMode,
                      }))
                    }
                    className={inputClassName}
                  >
                    {usageEntryModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">혜택 표시 문구</label>
                  <input
                    value={draft.benefitAmountText}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        benefitAmountText: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    placeholder="예: 월 1회, 연 6회"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">조건 설명</label>
                  <input
                    value={draft.benefitConditionText}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        benefitConditionText: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    placeholder="예: 사용 직후 직접 체크해 관리"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">초과 알럿 문구</label>
                <textarea
                  value={draft.usageOverflowMessage}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      usageOverflowMessage: event.target.value,
                    }))
                  }
                  className={`${textAreaClassName} min-h-[88px]`}
                />
              </div>
            </section>
          ) : null}

          {draft.productType === 'C' ? (
            <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">타입 C 모듈</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    체크형/정보형 제휴 혜택을 브랜드 단위로 관리합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      benefitTrackers: [...prev.benefitTrackers, createEmptyTracker()],
                    }))
                  }
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  + 혜택 추가
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {draft.benefitTrackers.map((tracker, index) => (
                  <div
                    key={tracker.id}
                    className="rounded-[22px] border border-white bg-white p-4"
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <input
                        value={tracker.title}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            benefitTrackers: prev.benefitTrackers.map(
                              (item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, title: event.target.value }
                                  : item
                            ),
                          }))
                        }
                        className={inputClassName}
                        placeholder="혜택명"
                      />
                      <input
                        value={tracker.groupTitle}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            benefitTrackers: prev.benefitTrackers.map(
                              (item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, groupTitle: event.target.value }
                                  : item
                            ),
                          }))
                        }
                        className={inputClassName}
                        placeholder="그룹명"
                      />
                      <select
                        value={tracker.displayMode}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            benefitTrackers: prev.benefitTrackers.map(
                              (item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      displayMode:
                                        event.target.value as BenefitTrackerDisplayMode,
                                    }
                                  : item
                            ),
                          }))
                        }
                        className={inputClassName}
                      >
                        {trackerDisplayOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={tracker.entryMode}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            benefitTrackers: prev.benefitTrackers.map(
                              (item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      entryMode: event.target.value as UsageEntryMode,
                                    }
                                  : item
                            ),
                          }))
                        }
                        className={inputClassName}
                      >
                        {usageEntryModeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={tracker.description}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          benefitTrackers: prev.benefitTrackers.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, description: event.target.value }
                              : item
                          ),
                        }))
                      }
                      className={`${textAreaClassName} mt-3 min-h-[88px]`}
                      placeholder="혜택 설명"
                    />
                    <div className="mt-3 grid gap-4 md:grid-cols-4">
                      <select
                        value={tracker.cycleUnit}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            benefitTrackers: prev.benefitTrackers.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    cycleUnit: event.target.value as ReminderRepeatUnit,
                                  }
                                : item
                            ),
                          }))
                        }
                        className={inputClassName}
                      >
                        {cycleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={tracker.cycleLimit}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            benefitTrackers: prev.benefitTrackers.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, cycleLimit: event.target.value }
                                : item
                            ),
                          }))
                        }
                        className={inputClassName}
                        placeholder="주기 한도"
                      />
                      <input
                        type="number"
                        min="0"
                        value={tracker.annualLimit}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            benefitTrackers: prev.benefitTrackers.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, annualLimit: event.target.value }
                                : item
                            ),
                          }))
                        }
                        className={inputClassName}
                        placeholder="연간 한도"
                      />
                      <input
                        value={tracker.id}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            benefitTrackers: prev.benefitTrackers.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, id: event.target.value }
                                : item
                            ),
                          }))
                        }
                        className={inputClassName}
                        placeholder="tracker id"
                      />
                    </div>
                    <textarea
                      value={tracker.overflowMessage}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          benefitTrackers: prev.benefitTrackers.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, overflowMessage: event.target.value }
                              : item
                          ),
                        }))
                      }
                      className={`${textAreaClassName} mt-3 min-h-[88px]`}
                      placeholder="제한 초과 알럿 문구"
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            benefitTrackers:
                              prev.benefitTrackers.length === 1
                                ? [createEmptyTracker()]
                                : prev.benefitTrackers.filter(
                                    (_, itemIndex) => itemIndex !== index
                                  ),
                          }))
                        }
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {draft.productType === 'D' ? (
            <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold text-slate-900">타입 D 모듈</h3>
              <p className="mt-1 text-sm text-slate-500">
                날짜별 메모는 사용자 화면에서 남기고, 관리자는 기본 안내 정보와 서브 쿠폰 구성을 정의합니다.
              </p>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}
