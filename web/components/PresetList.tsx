import { useState } from 'react';
import { SubscriptionPreset } from '../../shared/types';
import { supabase } from '../lib/supabase';

interface PresetListProps {
  presets: SubscriptionPreset[];
  loading: boolean;
  onPresetUpdated: (preset: SubscriptionPreset) => void;
  onPresetDeleted: (presetId: string) => void;
}

export default function PresetList({ 
  presets, 
  loading, 
  onPresetUpdated, 
  onPresetDeleted 
}: PresetListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDelete = async (presetId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('subscription_presets')
        .delete()
        .eq('id', presetId);

      if (error) throw error;

      onPresetDeleted(presetId);
      alert('프리셋이 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting preset:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const handleToggleOfficial = async (preset: SubscriptionPreset) => {
    try {
      const { data, error } = await supabase
        .from('subscription_presets')
        .update({ is_official: !preset.isOfficial })
        .eq('id', preset.id)
        .select()
        .single();

      if (error) throw error;

      onPresetUpdated(data);
    } catch (error) {
      console.error('Error updating preset:', error);
      alert('업데이트에 실패했습니다.');
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

  if (presets.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        등록된 프리셋이 없습니다.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {presets.map((preset) => (
        <div key={preset.id} className="p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-medium text-gray-900">
                  {preset.name}
                </h3>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  preset.isOfficial 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {preset.isOfficial ? '공식' : '사용자'}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">
                제공업체: {preset.provider}
              </p>
              
              <p className="text-sm text-gray-700 mb-3">
                {preset.description}
              </p>

              <div className="flex gap-4 text-sm text-gray-500">
                <span>👍 {preset.likes}</span>
                <span>📥 {preset.downloads}</span>
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
            </div>

            <div className="flex gap-2 ml-4">
              <button
                onClick={() => handleToggleOfficial(preset)}
                className={`px-3 py-1 text-sm rounded-md ${
                  preset.isOfficial
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {preset.isOfficial ? '공식 해제' : '공식 등록'}
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
  );
}