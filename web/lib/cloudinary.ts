// 클라이언트 사이드 전용 Cloudinary 설정
export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
};

const cloudinaryAssetPrefix = 'subscription-manager/';

// Cloudinary 설정 확인
export const isCloudinaryConfigured = (): boolean => {
  return !!(cloudinaryConfig.cloudName && 
           cloudinaryConfig.uploadPreset && 
           cloudinaryConfig.cloudName !== 'your_cloud_name');
};

export const isCloudinaryImageUrl = (imageUrl?: string | null): boolean => {
  if (!imageUrl || imageUrl.startsWith('data:') || !cloudinaryConfig.cloudName) {
    return false;
  }

  try {
    const parsed = new URL(imageUrl);
    return parsed.hostname === 'res.cloudinary.com' &&
      parsed.pathname.includes(`/${cloudinaryConfig.cloudName}/image/upload/`);
  } catch {
    return false;
  }
};

export const extractCloudinaryPublicId = (imageUrl: string): string | null => {
  if (!isCloudinaryImageUrl(imageUrl)) {
    return null;
  }

  try {
    const parsed = new URL(imageUrl);
    const uploadMarker = `/image/upload/`;
    const uploadIndex = parsed.pathname.indexOf(uploadMarker);

    if (uploadIndex === -1) {
      return null;
    }

    const rawPath = parsed.pathname.slice(uploadIndex + uploadMarker.length);
    const segments = rawPath.split('/').filter(Boolean);

    if (!segments.length) {
      return null;
    }

    const folderIndex = segments.findIndex(
      (segment) => segment === cloudinaryAssetPrefix.replace(/\/$/, '')
    );
    const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment));
    const publicIdSegments =
      folderIndex >= 0
        ? segments.slice(folderIndex)
        : versionIndex >= 0
          ? segments.slice(versionIndex + 1)
          : segments;

    if (!publicIdSegments.length) {
      return null;
    }

    const lastSegment = publicIdSegments[publicIdSegments.length - 1];
    publicIdSegments[publicIdSegments.length - 1] = lastSegment.replace(/\.[^.]+$/, '');

    const publicId = publicIdSegments.join('/');
    return publicId.startsWith(cloudinaryAssetPrefix) ? publicId : null;
  } catch {
    return null;
  }
};

// 이미지 업로드 함수 (클라이언트 전용)
export const uploadImage = async (file: File, customName?: string): Promise<string> => {
  // Cloudinary 설정 확인
  if (!isCloudinaryConfigured()) {
    console.warn('Cloudinary가 설정되지 않았습니다. Base64 데이터 URL을 사용합니다.');
    return uploadImageFallback(file);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset!);
  
  // 의미있는 파일명 생성 (폴더는 Upload Preset에서 자동 추가됨)
  if (customName) {
    const timestamp = Date.now();
    const cleanName = customName.replace(/[^a-zA-Z0-9가-힣]/g, '-').toLowerCase();
    formData.append('public_id', `${cleanName}-${timestamp}`);
  }

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Cloudinary upload error:', errorData);
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading image:', error);
    // Cloudinary 실패 시 fallback 사용
    console.warn('Cloudinary 업로드 실패, Base64 데이터 URL을 사용합니다.');
    return uploadImageFallback(file);
  }
};

// Base64 fallback 함수
const uploadImageFallback = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const result = event.target?.result as string;
      resolve(result);
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };
    
    reader.readAsDataURL(file);
  });
};

export const deleteCloudinaryImage = async (imageUrl: string): Promise<boolean> => {
  const publicId = extractCloudinaryPublicId(imageUrl);

  if (!publicId) {
    return false;
  }

  try {
    const response = await fetch('/api/cloudinary/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Cloudinary 삭제 요청에 실패했습니다.');
    }

    const payload = await response.json();
    return Boolean(payload.deleted);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    return false;
  }
};

// 이미지 URL 최적화 함수
export const getOptimizedImageUrl = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
  } = {}
): string => {
  // Base64 데이터 URL인 경우 그대로 반환
  if (publicId.startsWith('data:')) {
    return publicId;
  }

  // Cloudinary가 설정되지 않은 경우 원본 URL 반환
  if (!isCloudinaryConfigured()) {
    return publicId;
  }

  const { width = 300, height = 120, quality = 'auto', format = 'auto' } = options;
  
  return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/w_${width},h_${height},q_${quality},f_${format}/${publicId}`;
};
