import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SubscriptionPreset } from '../../shared/types';

export default function UserPresetList() {
  const [presets, setPresets] = useState<SubscriptionPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'likes' | 'downloads' | 'created_at'>('likes');

  useEffect(() => {
    loadUserPresets();
  }, [sortBy]);

  const loadUserPresets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_presets')
        .select('*')
        .eq('is_official', false)
        .order(sortBy, { ascending: false });

      if (error) throw error;
      
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
      
      setPresets(processedData);
    } catch (error) {
      console.error('Error loading user presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (presetId: string) => {
    if (!confirm('이 프리셋을 공식 프리셋으로 승인하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('subscription_presets')
        .update({ is_official: true })
        .eq('id', presetId);

      if (error) throw error;

      loadUserPresets();
      alert('프리셋이 공식 승인되었습니다.');
    } catch (error) {
      console.error('Error approving preset:', error);
      alert('승인에 실패했습니다.');
    }
  };

  const handleDelete = async (presetId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('subscription_presets')
        .delete()
        .eq('id', presetId);

      if (error) throw error;

      loadUserPresets();
      alert('프리셋이 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting preset:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
        <p className="mt-2 text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      {/* 정렬 옵션 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">정렬:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="likes">좋아요 순</option>
            <option value="downloads">다운로드 순</option>
            <option value="created_at">최신 순</option>
          </select>
        </div>
      </div>

      {/* 프리셋 목록 */}
      {presets.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          사용자가 등록한 프리셋이 없습니다.
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {presets.map((preset) => (
            <div key={preset.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {preset.name}
                    </h3>
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                      사용자 제작
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    제공업체: {preset.provider}
                  </p>
                  
                  <p className="text-sm text-gray-700 mb-3">
                    {preset.description}
                  </p>

                  <div className="flex gap-4 text-sm text-gray-500 mb-3">
                    <span>👍 {preset.likes}</span>
                    <span>📥 {preset.downloads}</span>
                    <span>👤 {preset.createdBy}</span>
                    <span>📅 {new Date(preset.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>

                  {/* 서브 상품 목록 */}
                  {preset.template?.subProducts && preset.template.subProducts.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">포함된 혜택:</p>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {preset.template.subProducts.map((subProduct, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                            {subProduct.name}
                            {subProduct.validityPeriod && (
                              <span className="text-xs text-gray-500">
                                ({subProduct.validityPeriod}일)
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 인기도 표시 */}
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary-500 h-2 rounded-full"
                        style={{ 
                          width: `${Math.min((preset.likes / Math.max(...presets.map(p => p.likes), 1)) * 100, 100)}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">인기도</span>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleApprove(preset.id)}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                  >
                    공식 승인
                  </button>
                  
                  <button
                    onClick={() => handleDelete(preset.id)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}