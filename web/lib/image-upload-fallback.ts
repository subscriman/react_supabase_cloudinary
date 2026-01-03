// Cloudinary가 설정되지 않은 경우의 대안 (Base64 또는 임시 URL)

export const uploadImageFallback = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Base64 데이터 URL 반환 (임시 솔루션)
      resolve(result);
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };
    
    reader.readAsDataURL(file);
  });
};

// 환경 변수 체크 함수
export const isCloudinaryConfigured = (): boolean => {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  
  return !!(cloudName && 
           uploadPreset && 
           cloudName !== 'your_cloud_name' && 
           uploadPreset !== 'your_upload_preset');
};