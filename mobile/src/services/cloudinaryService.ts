import { Platform } from 'react-native';

// 환경 변수 (실제로는 react-native-config 사용 권장)
const CLOUDINARY_CLOUD_NAME = 'your_cloud_name';
const CLOUDINARY_UPLOAD_PRESET = 'subscription_manager';

export class CloudinaryService {
  static async uploadImage(imageUri: string): Promise<string> {
    try {
      const formData = new FormData();
      
      // React Native에서 이미지 업로드를 위한 FormData 설정
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'image.jpg',
      } as any);
      
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  // 이미지 URL 최적화
  static getOptimizedImageUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      quality?: string;
      format?: string;
    } = {}
  ): string {
    const { width = 300, height = 120, quality = 'auto', format = 'auto' } = options;
    
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/w_${width},h_${height},q_${quality},f_${format}/${publicId}`;
  }

  // Cloudinary URL에서 public_id 추출
  static extractPublicId(cloudinaryUrl: string): string {
    const matches = cloudinaryUrl.match(/\/v\d+\/(.+)\./);
    return matches ? matches[1] : '';
  }
}