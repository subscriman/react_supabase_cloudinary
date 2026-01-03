import { useState, useRef } from 'react';
import { uploadImage, isCloudinaryConfigured } from '../lib/cloudinary';

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string) => void;
  currentImageUrl?: string;
  className?: string;
  customName?: string; // 커스텀 파일명
}

export default function ImageUpload({ 
  onImageUploaded, 
  currentImageUrl, 
  className = '',
  customName
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // 파일 크기 검증 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Cloudinary에 업로드
    setUploading(true);
    try {
      const imageUrl = await uploadImage(file, customName);
      onImageUploaded(imageUrl);
      
      if (isCloudinaryConfigured()) {
        alert('이미지가 성공적으로 업로드되었습니다.');
      } else {
        alert('이미지가 임시로 저장되었습니다. Cloudinary 설정을 완료하면 클라우드에 저장됩니다.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('이미지 업로드에 실패했습니다.');
      setPreviewUrl(currentImageUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    onImageUploaded('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full max-w-sm h-32 object-cover rounded-lg border border-gray-300"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={handleButtonClick}
              disabled={uploading}
              className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {uploading ? '업로드 중...' : '변경'}
            </button>
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={uploading}
              className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50"
            >
              삭제
            </button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="text-sm text-gray-600">
              <button
                type="button"
                onClick={handleButtonClick}
                disabled={uploading}
                className="font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50"
              >
                {uploading ? '업로드 중...' : '이미지 업로드'}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, GIF 최대 5MB
              </p>
              {!isCloudinaryConfigured() && (
                <p className="text-xs text-orange-500 mt-1">
                  ⚠️ Cloudinary 미설정 (임시 저장)
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}