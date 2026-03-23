import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  ManagedSeedPreset,
  buildSubscriptionPresetRowInput,
} from '../lib/user-membership';

interface MobileDisplayManagerProps {
  products: ManagedSeedPreset[];
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

function toDisplayDraft(product: ManagedSeedPreset): DisplayDraft {
  const meta = product.template.seedMeta || {};

  return {
    dbId: product.dbId,
    name: product.name,
    provider: product.provider,
    productType: meta.productType || 'A',
    categoryLabel:
      meta.mobileCategory === 'ott'
        ? 'OTT 스트리밍'
        : meta.mobileCategory === 'delivery'
          ? '배달'
          : meta.mobileCategory === 't-universe'
            ? 'T우주 / 생활'
            : '통신사 & 혜택',
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
  loading,
  onReload,
}: MobileDisplayManagerProps) {
  const [drafts, setDrafts] = useState<DisplayDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDrafts(products.map(toDisplayDraft));
  }, [products]);

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
          <div className="rounded-[24px] bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-500">홈 추천 영역</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {featuredCount}개
            </p>
          </div>
          <div className="rounded-[24px] bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-500">추천 탭 노출</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {recommendCount}개
            </p>
          </div>
        </div>

        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-white/60 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">상품별 추천 노출 설정</h3>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            모바일 상품을 불러오는 중입니다.
          </div>
        ) : drafts.length ? (
          <div className="divide-y divide-slate-100">
            {drafts.map((draft) => (
              <div
                key={draft.dbId}
                className="grid gap-5 px-6 py-5 xl:grid-cols-[minmax(0,1.2fr),minmax(0,1fr),minmax(0,1fr)]"
              >
                <div>
                  <p className="text-lg font-semibold text-slate-900">{draft.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {draft.provider} · 타입 {draft.productType} · {draft.categoryLabel}
                  </p>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">홈 추천 영역</p>
                      <p className="mt-1 text-xs text-slate-500">
                        홈 상단 캐러셀에 들어갈 상품
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.homeFeatured}
                        onChange={(event) =>
                          setDrafts((prev) =>
                            prev.map((item) =>
                              item.dbId === draft.dbId
                                ? { ...item, homeFeatured: event.target.checked }
                                : item
                            )
                          )
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
                      value={draft.homeFeaturedOrder}
                      onChange={(event) =>
                        setDrafts((prev) =>
                          prev.map((item) =>
                            item.dbId === draft.dbId
                              ? { ...item, homeFeaturedOrder: event.target.value }
                              : item
                          )
                        )
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                      placeholder="낮을수록 먼저 노출"
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">추천 탭</p>
                      <p className="mt-1 text-xs text-slate-500">
                        하단 메뉴의 추천 탭 목록에 표시
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.recommendVisible}
                        onChange={(event) =>
                          setDrafts((prev) =>
                            prev.map((item) =>
                              item.dbId === draft.dbId
                                ? { ...item, recommendVisible: event.target.checked }
                                : item
                            )
                          )
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
                      value={draft.recommendOrder}
                      onChange={(event) =>
                        setDrafts((prev) =>
                          prev.map((item) =>
                            item.dbId === draft.dbId
                              ? { ...item, recommendOrder: event.target.value }
                              : item
                          )
                        )
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                      placeholder="낮을수록 먼저 노출"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            먼저 `상품 관리`에서 모바일 상품을 등록해 주세요.
          </div>
        )}
      </section>
    </div>
  );
}
