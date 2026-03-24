import { useEffect, useMemo, useState } from 'react';
import {
  MobileCategoryOption,
  findMobileCategoryLabel,
  getFallbackMobileCategories,
  sortMobileCategories,
} from '../lib/mobile-categories';
import { supabase } from '../lib/supabase';
import {
  ManagedSeedPreset,
  buildSubscriptionPresetRowInput,
} from '../lib/user-membership';

interface MobileDisplayManagerProps {
  products: ManagedSeedPreset[];
  categories: MobileCategoryOption[];
  loading: boolean;
  onReload: () => Promise<void>;
}

interface DisplayDraft {
  dbId: string;
  name: string;
  provider: string;
  productType: string;
  categoryLabel: string;
  homeFeatured: boolean;
  homeFeaturedOrder: string;
  recommendVisible: boolean;
  recommendOrder: string;
}

type DisplayTarget = 'home' | 'recommend';

function toDisplayDraft(
  product: ManagedSeedPreset,
  categories: MobileCategoryOption[]
): DisplayDraft {
  const meta = product.template.seedMeta || {};

  return {
    dbId: product.dbId,
    name: product.name,
    provider: product.provider,
    productType: meta.productType || 'A',
    categoryLabel: findMobileCategoryLabel(categories, meta.mobileCategory),
    homeFeatured: meta.homeFeatured ?? false,
    homeFeaturedOrder:
      meta.homeFeaturedOrder != null ? String(meta.homeFeaturedOrder) : '',
    recommendVisible: meta.recommendVisible ?? false,
    recommendOrder:
      meta.recommendOrder != null ? String(meta.recommendOrder) : '',
  };
}

function parseNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function MobileDisplayManager({
  products,
  categories,
  loading,
  onReload,
}: MobileDisplayManagerProps) {
  const [drafts, setDrafts] = useState<DisplayDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTarget, setActiveTarget] = useState<DisplayTarget>('home');
  const [searchText, setSearchText] = useState('');
  const availableCategories = useMemo(
    () =>
      sortMobileCategories(
        categories.length ? categories : getFallbackMobileCategories()
      ),
    [categories]
  );

  useEffect(() => {
    setDrafts(products.map((product) => toDisplayDraft(product, availableCategories)));
  }, [availableCategories, products]);

  useEffect(() => {
    if (!message) return;

    const timeoutId = window.setTimeout(() => setMessage(''), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  const featuredCount = useMemo(
    () => drafts.filter((draft) => draft.homeFeatured).length,
    [drafts]
  );
  const recommendCount = useMemo(
    () => drafts.filter((draft) => draft.recommendVisible).length,
    [drafts]
  );

  const activeCount = activeTarget === 'home' ? featuredCount : recommendCount;

  const visibleDrafts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return drafts
      .filter((draft) => {
        if (!normalizedSearch) {
          return true;
        }

        const haystack =
          `${draft.name} ${draft.provider} ${draft.productType} ${draft.categoryLabel}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const leftSelected =
          activeTarget === 'home' ? left.homeFeatured : left.recommendVisible;
        const rightSelected =
          activeTarget === 'home' ? right.homeFeatured : right.recommendVisible;

        if (leftSelected !== rightSelected) {
          return leftSelected ? -1 : 1;
        }

        const leftOrder = parseNullableNumber(
          activeTarget === 'home' ? left.homeFeaturedOrder : left.recommendOrder
        );
        const rightOrder = parseNullableNumber(
          activeTarget === 'home' ? right.homeFeaturedOrder : right.recommendOrder
        );

        return (
          (leftOrder ?? Number.MAX_SAFE_INTEGER) -
            (rightOrder ?? Number.MAX_SAFE_INTEGER) ||
          left.name.localeCompare(right.name, 'ko-KR')
        );
      });
  }, [activeTarget, drafts, searchText]);

  const handleToggleTarget = (dbId: string, checked: boolean) => {
    setDrafts((prev) =>
      prev.map((item) =>
        item.dbId === dbId
          ? activeTarget === 'home'
            ? { ...item, homeFeatured: checked }
            : { ...item, recommendVisible: checked }
          : item
      )
    );
  };

  const handleUpdateOrder = (dbId: string, value: string) => {
    setDrafts((prev) =>
      prev.map((item) =>
        item.dbId === dbId
          ? activeTarget === 'home'
            ? { ...item, homeFeaturedOrder: value }
            : { ...item, recommendOrder: value }
          : item
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await Promise.all(
        drafts.map(async (draft) => {
          const currentProduct = products.find((product) => product.dbId === draft.dbId);
          if (!currentProduct) return;

          const nextPreset = {
            ...currentProduct,
            template: {
              ...currentProduct.template,
              seedMeta: {
                ...(currentProduct.template.seedMeta || {}),
                homeFeatured: draft.homeFeatured,
                homeFeaturedOrder: parseNullableNumber(draft.homeFeaturedOrder),
                recommendVisible: draft.recommendVisible,
                recommendOrder: parseNullableNumber(draft.recommendOrder),
              },
            },
          };
          const payload = buildSubscriptionPresetRowInput(nextPreset);

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

          if (error) {
            throw error;
          }
        })
      );

      setMessage('추천 노출 설정을 저장했습니다.');
      await onReload();
    } catch (error) {
      console.error('Failed to save mobile display settings:', error);
      alert('추천 노출 설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/60 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-teal)]">
              Mobile Display
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              추천 노출 관리
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              홈 상단 추천 영역과 하단 `추천` 탭에 노출할 상품을 지정합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? '저장 중...' : '노출 설정 저장'}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveTarget('home')}
            className={`rounded-[24px] p-5 text-left transition ${
              activeTarget === 'home'
                ? 'border border-slate-900 bg-slate-900 text-white'
                : 'bg-slate-50 text-slate-900'
            }`}
          >
            <p
              className={`text-sm font-medium ${
                activeTarget === 'home' ? 'text-white/75' : 'text-slate-500'
              }`}
            >
              홈 추천 영역
            </p>
            <p
              className={`mt-2 text-3xl font-semibold ${
                activeTarget === 'home' ? 'text-white' : 'text-slate-900'
              }`}
            >
              {featuredCount}개
            </p>
            <p
              className={`mt-2 text-sm ${
                activeTarget === 'home' ? 'text-white/70' : 'text-slate-500'
              }`}
            >
              홈 상단 캐러셀에 노출할 상품을 선택합니다.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setActiveTarget('recommend')}
            className={`rounded-[24px] p-5 text-left transition ${
              activeTarget === 'recommend'
                ? 'border border-slate-900 bg-slate-900 text-white'
                : 'bg-slate-50 text-slate-900'
            }`}
          >
            <p
              className={`text-sm font-medium ${
                activeTarget === 'recommend' ? 'text-white/75' : 'text-slate-500'
              }`}
            >
              추천 탭 노출
            </p>
            <p
              className={`mt-2 text-3xl font-semibold ${
                activeTarget === 'recommend' ? 'text-white' : 'text-slate-900'
              }`}
            >
              {recommendCount}개
            </p>
            <p
              className={`mt-2 text-sm ${
                activeTarget === 'recommend' ? 'text-white/70' : 'text-slate-500'
              }`}
            >
              하단 메뉴의 추천 탭 목록에 보일 상품을 선택합니다.
            </p>
          </button>
        </div>

        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-white/60 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {activeTarget === 'home' ? '홈 추천 영역 상품 선택' : '추천 탭 상품 선택'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                먼저 대상을 고른 뒤, 아래 상품 목록에서 해당 영역에 노출할 상품을 지정합니다.
              </p>
            </div>
            <div className="min-w-[220px] flex-1 md:max-w-xs">
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
                placeholder="상품명, 제공업체, 카테고리 검색"
              />
            </div>
          </div>

          <div className="mt-4 rounded-[24px] bg-slate-50 px-4 py-3 text-sm text-slate-600">
            현재 선택된 영역에 <strong className="text-slate-900">{activeCount}개</strong>가
            지정되어 있습니다. 선택된 상품이 먼저 보이도록 정렬됩니다.
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            모바일 상품을 불러오는 중입니다.
          </div>
        ) : visibleDrafts.length ? (
          <div className="divide-y divide-slate-100">
            {visibleDrafts.map((draft) => {
              const isSelected =
                activeTarget === 'home' ? draft.homeFeatured : draft.recommendVisible;
              const orderValue =
                activeTarget === 'home' ? draft.homeFeaturedOrder : draft.recommendOrder;

              return (
                <div
                  key={draft.dbId}
                  className="grid gap-5 px-6 py-5 xl:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]"
                >
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{draft.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {draft.provider} · 타입 {draft.productType} · {draft.categoryLabel}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      {draft.homeFeatured ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                          홈 추천 영역 지정됨
                        </span>
                      ) : null}
                      {draft.recommendVisible ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                          추천 탭 지정됨
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {activeTarget === 'home' ? '홈 추천 영역' : '추천 탭'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {activeTarget === 'home'
                            ? '홈 상단 캐러셀에 들어갈 상품'
                            : '하단 메뉴의 추천 탭 목록에 표시할 상품'}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) =>
                            handleToggleTarget(draft.dbId, event.target.checked)
                          }
                          className="h-4 w-4 accent-slate-900"
                        />
                        노출
                      </label>
                    </div>
                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        노출 순서
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={orderValue}
                        onChange={(event) =>
                          handleUpdateOrder(draft.dbId, event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                        placeholder="낮을수록 먼저 노출"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            {searchText.trim()
              ? '검색 조건에 맞는 상품이 없습니다.'
              : '먼저 `상품 관리`에서 모바일 상품을 등록해 주세요.'}
          </div>
        )}
      </section>
    </div>
  );
}
