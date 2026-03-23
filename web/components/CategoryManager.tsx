import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  MobileCategoryOption,
  MobileCategoryRecord,
  normalizeMobileCategoryOption,
  slugifyMobileCategoryKey,
  sortMobileCategories,
} from '../lib/mobile-categories';
import { ManagedSeedPreset } from '../lib/user-membership';

interface CategoryManagerProps {
  categories: MobileCategoryRecord[];
  products: ManagedSeedPreset[];
  loading: boolean;
  onReload: () => Promise<void>;
}

interface CategoryDraft {
  id: string;
  categoryKey: string;
  label: string;
  shortLabel: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const inputClassName =
  'w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500';

const textAreaClassName = `${inputClassName} min-h-[112px] resize-y`;

function createEmptyDraft(): CategoryDraft {
  return {
    id: '',
    categoryKey: '',
    label: '',
    shortLabel: '',
    description: '',
    sortOrder: '',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
}

function toDraft(category: MobileCategoryRecord): CategoryDraft {
  return {
    id: category.id,
    categoryKey: category.category_key,
    label: category.label,
    shortLabel: category.short_label,
    description: category.description || '',
    sortOrder: category.sort_order != null ? String(category.sort_order) : '',
    isActive: category.is_active ?? true,
    createdAt: category.created_at || '',
    updatedAt: category.updated_at || '',
  };
}

function parseSortOrder(value: string) {
  if (!value.trim()) return 0;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value: string) {
  if (!value) return '없음';

  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CategoryManager({
  categories,
  products,
  loading,
  onReload,
}: CategoryManagerProps) {
  const [draft, setDraft] = useState<CategoryDraft>(createEmptyDraft());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const categoryOptions = useMemo(
    () => sortMobileCategories(categories.map(normalizeMobileCategoryOption)),
    [categories]
  );

  const usageCounts = useMemo(() => {
    return products.reduce<Record<string, number>>((acc, product) => {
      const key = product.template.seedMeta?.mobileCategory;
      if (!key) return acc;

      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [products]);

  useEffect(() => {
    if (!message) return;

    const timeoutId = window.setTimeout(() => setMessage(''), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  const startNewDraft = () => {
    setDraft(createEmptyDraft());
  };

  const handleSelectCategory = (category: MobileCategoryRecord) => {
    setDraft(toDraft(category));
  };

  const handleSave = async () => {
    const label = draft.label.trim();
    const categoryKey = (draft.id ? draft.categoryKey : draft.categoryKey || label).trim();

    if (!label || !categoryKey) {
      alert('카테고리명과 카테고리 키를 입력해 주세요.');
      return;
    }

    const payload = {
      category_key: draft.id ? draft.categoryKey.trim() : slugifyMobileCategoryKey(categoryKey),
      label,
      short_label: draft.shortLabel.trim() || label,
      description: draft.description.trim() || null,
      sort_order: parseSortOrder(draft.sortOrder),
      is_active: draft.isActive,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);

    try {
      if (draft.id) {
        const { data, error } = await supabase
          .from('mobile_categories')
          .update(payload)
          .eq('id', draft.id)
          .select('*')
          .single();

        if (error) throw error;

        setDraft(toDraft(data as MobileCategoryRecord));
        setMessage('카테고리를 수정했습니다.');
      } else {
        const { data, error } = await supabase
          .from('mobile_categories')
          .insert([payload])
          .select('*')
          .single();

        if (error) throw error;

        setDraft(toDraft(data as MobileCategoryRecord));
        setMessage('카테고리를 추가했습니다.');
      }

      await onReload();
    } catch (error) {
      console.error('Failed to save category:', error);
      alert('카테고리 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft.id) {
      startNewDraft();
      return;
    }

    const linkedProductCount = usageCounts[draft.categoryKey] || 0;
    if (linkedProductCount > 0) {
      alert('이 카테고리를 사용하는 상품이 있어 삭제할 수 없습니다. 비활성으로 전환해 주세요.');
      return;
    }

    if (!confirm(`"${draft.label}" 카테고리를 삭제할까요?`)) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('mobile_categories')
        .delete()
        .eq('id', draft.id);

      if (error) throw error;

      setDraft(createEmptyDraft());
      setMessage('카테고리를 삭제했습니다.');
      await onReload();
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('카테고리 삭제에 실패했습니다.');
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
              <h2 className="text-lg font-semibold text-slate-900">카테고리 관리</h2>
              <p className="mt-1 text-sm text-slate-500">
                모바일 홈과 내 구독 필터에 사용할 카테고리를 관리합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={startNewDraft}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              새 카테고리
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
                카테고리를 불러오는 중입니다.
              </div>
            ) : categoryOptions.length ? (
              categoryOptions.map((category) => {
                const isSelected = draft.id === category.id;
                const linkedProductCount = usageCounts[category.key] || 0;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      const selectedCategory = categories.find(
                        (item) => item.id === category.id
                      );
                      if (!selectedCategory) return;
                      handleSelectCategory(selectedCategory);
                    }}
                    className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{category.label}</p>
                        <p
                          className={`mt-1 text-xs ${
                            isSelected ? 'text-white/70' : 'text-slate-500'
                          }`}
                        >
                          {category.shortLabel} · {category.key}
                        </p>
                        <p
                          className={`mt-1 text-[11px] ${
                            isSelected ? 'text-white/65' : 'text-slate-400'
                          }`}
                        >
                          연결 상품 {linkedProductCount}개
                        </p>
                      </div>
                      <span className="rounded-full border border-current/20 px-2 py-1 text-[11px]">
                        {category.isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                등록된 카테고리가 아직 없습니다.
              </div>
            )}
          </div>
        </section>
      </aside>

      <section className="rounded-[28px] border border-white/60 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-teal)]">
              Mobile Category
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              {draft.id ? '카테고리 수정' : '새 카테고리 추가'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              카테고리 키는 생성 후 잠그고, 이름/정렬/활성 상태는 계속 수정할 수 있습니다.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
            >
              {draft.id ? '삭제' : '초기화'}
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
              <label className="mb-2 block text-sm font-medium text-slate-700">카테고리명</label>
              <input
                value={draft.label}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, label: event.target.value }))
                }
                className={inputClassName}
                placeholder="예: 쇼핑"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">짧은 라벨</label>
              <input
                value={draft.shortLabel}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, shortLabel: event.target.value }))
                }
                className={inputClassName}
                placeholder="예: 쇼핑"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">카테고리 키</label>
              <input
                value={draft.categoryKey}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, categoryKey: event.target.value }))
                }
                className={`${inputClassName} ${draft.id ? 'bg-slate-100 text-slate-500' : ''}`}
                placeholder="예: shopping"
                disabled={Boolean(draft.id)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">정렬 순서</label>
              <input
                type="number"
                min="0"
                value={draft.sortOrder}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, sortOrder: event.target.value }))
                }
                className={inputClassName}
                placeholder="낮을수록 먼저"
              />
            </div>
          </section>

          <section>
            <label className="mb-2 block text-sm font-medium text-slate-700">설명</label>
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value }))
              }
              className={textAreaClassName}
              placeholder="이 카테고리에 어떤 상품이 들어가는지 설명"
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, isActive: event.target.checked }))
                }
                className="h-4 w-4 accent-slate-900"
              />
              활성 카테고리로 사용
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              연결 상품 수:{' '}
              <strong className="text-slate-900">
                {usageCounts[draft.categoryKey] || 0}
              </strong>
            </div>
          </section>

          {draft.id ? (
            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                생성일: <strong className="text-slate-900">{formatDateTime(draft.createdAt)}</strong>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                수정일: <strong className="text-slate-900">{formatDateTime(draft.updatedAt)}</strong>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}
