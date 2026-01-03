import { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import { SubscriptionPreset } from '../../shared/types';
import PresetList from '../components/PresetList';
import PresetForm from '../components/PresetForm';
import BannerManager from '../components/BannerManager';
import UserPresetList from '../components/UserPresetList';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'presets' | 'banners' | 'user-presets' | 'analytics'>('presets');
  const [presets, setPresets] = useState<SubscriptionPreset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPresets();
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
      
      // 데이터 구조 확인을 위한 로그
      console.log('Raw preset data:', data);
      
      // JSONB 필드를 파싱하여 올바른 형태로 변환
      const processedData = data?.map(preset => ({
        ...preset,
        template: typeof preset.template === 'string' 
          ? JSON.parse(preset.template) 
          : preset.template,
        isOfficial: preset.is_official,
        createdBy: preset.created_by,
        createdAt: preset.created_at,
        updatedAt: preset.updated_at,
      })) || [];
      
      console.log('Processed preset data:', processedData);
      setPresets(processedData);
    } catch (error) {
      console.error('Error loading presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetCreated = (newPreset: SubscriptionPreset) => {
    setPresets(prev => [newPreset, ...prev]);
  };

  const handlePresetUpdated = (updatedPreset: SubscriptionPreset) => {
    setPresets(prev => prev.map(p => p.id === updatedPreset.id ? updatedPreset : p));
  };

  const handlePresetDeleted = (presetId: string) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
  };

  return (
    <>
      <Head>
        <title>구독 관리 앱 - 관리자</title>
        <meta name="description" content="구독 관리 앱 관리자 페이지" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* 헤더 */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <h1 className="text-2xl font-bold text-gray-900">
                구독 관리 앱 관리자
              </h1>
              <div className="text-sm text-gray-500">
                관리자 대시보드
              </div>
            </div>
          </div>
        </header>

        {/* 탭 네비게이션 */}
        <nav className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              {[
                { id: 'presets', label: '공식 프리셋 관리' },
                { id: 'banners', label: '배너 관리' },
                { id: 'user-presets', label: '사용자 프리셋' },
                { id: 'analytics', label: '통계' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* 메인 콘텐츠 */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {activeTab === 'presets' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  새 프리셋 등록
                </h2>
                <PresetForm onPresetCreated={handlePresetCreated} />
              </div>

              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">
                    공식 프리셋 목록
                  </h2>
                </div>
                <PresetList
                  presets={presets}
                  loading={loading}
                  onPresetUpdated={handlePresetUpdated}
                  onPresetDeleted={handlePresetDeleted}
                />
              </div>
            </div>
          )}

          {activeTab === 'banners' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                배너 관리
              </h2>
              <BannerManager />
            </div>
          )}

          {activeTab === 'user-presets' && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">
                  사용자 제작 프리셋
                </h2>
              </div>
              <UserPresetList />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                통계 및 분석
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-800">총 사용자</h3>
                  <p className="text-2xl font-bold text-blue-900">1,234</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-green-800">활성 구독</h3>
                  <p className="text-2xl font-bold text-green-900">5,678</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-purple-800">프리셋 다운로드</h3>
                  <p className="text-2xl font-bold text-purple-900">9,012</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}