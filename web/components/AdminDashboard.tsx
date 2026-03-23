import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SubscriptionPreset } from '../../shared/types';
import { supabase } from '../lib/supabase';
import {
  ManagedSeedPreset,
  normalizePresetRowToManagedSeedPreset,
} from '../lib/user-membership';
import BannerManager from './BannerManager';
import MobileDisplayManager from './MobileDisplayManager';
import MobileProductManager from './MobileProductManager';
import PresetForm from './PresetForm';
import PresetList from './PresetList';
import UserPresetList from './UserPresetList';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<
    | 'presets'
    | 'mobile-products'
    | 'mobile-display'
    | 'banners'
    | 'user-presets'
    | 'analytics'
  >('presets');
  const [presets, setPresets] = useState<SubscriptionPreset[]>([]);
  const [mobileProducts, setMobileProducts] = useState<ManagedSeedPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileLoading, setMobileLoading] = useState(true);

  useEffect(() => {
    void Promise.all([loadPresets(), loadMobileProducts()]);
  }, []);

  const loadPresets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_presets')
        .select('*')
        .eq('is_official', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedData =
        data?.map((preset) => ({
          ...preset,
          template:
            typeof preset.template === 'string'
              ? JSON.parse(preset.template)
              : preset.template,
          isOfficial: preset.is_official,
          createdBy: preset.created_by,
          createdAt: preset.created_at,
          updatedAt: preset.updated_at,
        }))
          .filter((preset) => {
            const seedMeta = preset.template?.seedMeta || {};
            return (seedMeta.catalogKind || 'telecom') !== 'subscription';
          }) || [];

      setPresets(processedData);
    } catch (error) {
      console.error('Error loading presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMobileProducts = async () => {
    setMobileLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_presets')
        .select('*')
        .eq('is_official', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const processedData =
        data
          ?.map((preset) => normalizePresetRowToManagedSeedPreset(preset))
          .filter((preset) => (preset.template.seedMeta?.catalogKind || 'telecom') === 'subscription') ||
        [];

      setMobileProducts(processedData);
    } catch (error) {
      console.error('Error loading mobile products:', error);
    } finally {
      setMobileLoading(false);
    }
  };

  const handlePresetCreated = (newPreset: SubscriptionPreset) => {
    setPresets((prev) => [newPreset, ...prev]);
  };

  const handlePresetUpdated = (updatedPreset: SubscriptionPreset) => {
    setPresets((prev) =>
      prev.map((preset) => (preset.id === updatedPreset.id ? updatedPreset : preset))
    );
  };

  const handlePresetDeleted = (presetId: string) => {
    setPresets((prev) => prev.filter((preset) => preset.id !== presetId));
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--brand-teal)]">
              Admin
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Subscriman 관리자
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--brand-coral)] hover:text-[var(--brand-coral)]"
            >
              사용자 페이지로 이동
            </Link>
            <Link
              href="/m"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--brand-coral)] hover:text-[var(--brand-coral)]"
            >
              모바일 페이지 보기
            </Link>
          </div>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 py-3">
            {[
              { id: 'presets', label: '공식 프리셋 관리' },
              { id: 'mobile-products', label: '상품 관리' },
              { id: 'mobile-display', label: '추천 노출 관리' },
              { id: 'banners', label: '배너 관리' },
              { id: 'user-presets', label: '사용자 프리셋' },
              { id: 'analytics', label: '통계' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'presets' && (
          <div className="space-y-6">
            <section className="rounded-[28px] border border-white/60 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">새 프리셋 등록</h2>
              <PresetForm onPresetCreated={handlePresetCreated} />
            </section>

            <section className="rounded-[28px] border border-white/60 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">공식 프리셋 목록</h2>
              </div>
              <PresetList
                presets={presets}
                loading={loading}
                onPresetUpdated={handlePresetUpdated}
                onPresetDeleted={handlePresetDeleted}
              />
            </section>
          </div>
        )}

        {activeTab === 'banners' && (
          <section className="rounded-[28px] border border-white/60 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">배너 관리</h2>
            <BannerManager />
          </section>
        )}

        {activeTab === 'mobile-products' && (
          <MobileProductManager
            products={mobileProducts}
            loading={mobileLoading}
            onReload={loadMobileProducts}
          />
        )}

        {activeTab === 'mobile-display' && (
          <MobileDisplayManager
            products={mobileProducts}
            loading={mobileLoading}
            onReload={loadMobileProducts}
          />
        )}

        {activeTab === 'user-presets' && (
          <section className="rounded-[28px] border border-white/60 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">사용자 제작 프리셋</h2>
            </div>
            <UserPresetList />
          </section>
        )}

        {activeTab === 'analytics' && (
          <section className="rounded-[28px] border border-white/60 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <h2 className="mb-6 text-lg font-semibold text-slate-900">통계 및 분석</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-sky-50 p-5">
                <h3 className="text-sm font-medium text-sky-800">총 사용자</h3>
                <p className="mt-2 text-3xl font-semibold text-sky-950">1,234</p>
              </div>
              <div className="rounded-3xl bg-emerald-50 p-5">
                <h3 className="text-sm font-medium text-emerald-800">활성 구독</h3>
                <p className="mt-2 text-3xl font-semibold text-emerald-950">5,678</p>
              </div>
              <div className="rounded-3xl bg-orange-50 p-5">
                <h3 className="text-sm font-medium text-orange-800">프리셋 다운로드</h3>
                <p className="mt-2 text-3xl font-semibold text-orange-950">9,012</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
