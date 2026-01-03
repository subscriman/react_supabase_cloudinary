import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ImageUpload from './ImageUpload';
import CloudinaryDebug from './CloudinaryDebug';

interface Banner {
  id: string;
  title: string;
  image_url?: string;
  link_url?: string;
  position: number;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
}

export default function BannerManager() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    link_url: '',
    position: 0,
    is_active: true,
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Error loading banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingBanner) {
        // 수정
        const { error } = await supabase
          .from('banners')
          .update(formData)
          .eq('id', editingBanner.id);

        if (error) throw error;
      } else {
        // 새로 생성
        const { error } = await supabase
          .from('banners')
          .insert([formData]);

        if (error) throw error;
      }

      setFormData({
        title: '',
        image_url: '',
        link_url: '',
        position: 0,
        is_active: true,
        start_date: '',
        end_date: '',
      });
      setEditingBanner(null);
      loadBanners();
      alert(editingBanner ? '배너가 수정되었습니다.' : '배너가 등록되었습니다.');
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      image_url: banner.image_url || '',
      link_url: banner.link_url || '',
      position: banner.position,
      is_active: banner.is_active,
      start_date: banner.start_date || '',
      end_date: banner.end_date || '',
    });
  };

  const handleDelete = async (bannerId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', bannerId);

      if (error) throw error;

      loadBanners();
      alert('배너가 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting banner:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const toggleActive = async (banner: Banner) => {
    try {
      const { error } = await supabase
        .from('banners')
        .update({ is_active: !banner.is_active })
        .eq('id', banner.id);

      if (error) throw error;
      loadBanners();
    } catch (error) {
      console.error('Error toggling banner:', error);
      alert('상태 변경에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="text-center py-4">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Cloudinary 디버그 */}
      <CloudinaryDebug />

      {/* 배너 등록/수정 폼 */}
      <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-4">
          {editingBanner ? '배너 수정' : '새 배너 등록'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              순서
            </label>
            <input
              type="number"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이미지
            </label>
            <ImageUpload
              currentImageUrl={formData.image_url}
              onImageUploaded={(imageUrl) => setFormData({ ...formData, image_url: imageUrl })}
              customName={formData.title ? `banner-${formData.title}` : 'banner'}
              className="mb-4"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              링크 URL
            </label>
            <input
              type="url"
              value={formData.link_url}
              onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시작일
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              종료일
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="mr-2"
          />
          <label htmlFor="is_active" className="text-sm text-gray-700">
            활성화
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
          >
            {editingBanner ? '수정' : '등록'}
          </button>
          
          {editingBanner && (
            <button
              type="button"
              onClick={() => {
                setEditingBanner(null);
                setFormData({
                  title: '',
                  image_url: '',
                  link_url: '',
                  position: 0,
                  is_active: true,
                  start_date: '',
                  end_date: '',
                });
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              취소
            </button>
          )}
        </div>
      </form>

      {/* 배너 목록 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">등록된 배너</h3>
        
        {banners.length === 0 ? (
          <p className="text-gray-500 text-center py-4">등록된 배너가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className={`p-4 border rounded-lg ${
                  banner.is_active ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{banner.title}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        banner.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {banner.is_active ? '활성' : '비활성'}
                      </span>
                      <span className="text-xs text-gray-500">
                        순서: {banner.position}
                      </span>
                    </div>
                    
                    {banner.image_url && (
                      <img 
                        src={banner.image_url} 
                        alt={banner.title}
                        className="w-32 h-16 object-cover rounded mb-2"
                      />
                    )}
                    
                    {banner.link_url && (
                      <p className="text-sm text-blue-600 mb-2">
                        링크: {banner.link_url}
                      </p>
                    )}
                    
                    {(banner.start_date || banner.end_date) && (
                      <p className="text-sm text-gray-500">
                        기간: {banner.start_date || '시작일 없음'} ~ {banner.end_date || '종료일 없음'}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => toggleActive(banner)}
                      className={`px-3 py-1 text-sm rounded-md ${
                        banner.is_active
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {banner.is_active ? '비활성화' : '활성화'}
                    </button>
                    
                    <button
                      onClick={() => handleEdit(banner)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                    >
                      수정
                    </button>
                    
                    <button
                      onClick={() => handleDelete(banner.id)}
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
    </div>
  );
}