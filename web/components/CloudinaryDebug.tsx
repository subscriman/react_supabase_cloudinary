import { cloudinaryConfig, isCloudinaryConfigured } from '../lib/cloudinary';

export default function CloudinaryDebug() {
  const testCloudinaryConnection = async () => {
    console.log('=== Cloudinary 설정 디버그 ===');
    console.log('Cloud Name:', cloudinaryConfig.cloudName);
    console.log('Upload Preset:', cloudinaryConfig.uploadPreset);
    console.log('설정 완료 여부:', isCloudinaryConfigured());
    
    // Upload Preset 존재 여부 테스트
    if (cloudinaryConfig.cloudName && cloudinaryConfig.uploadPreset) {
      try {
        const testFormData = new FormData();
        testFormData.append('upload_preset', cloudinaryConfig.uploadPreset);
        // 빈 파일 대신 작은 테스트 데이터 추가
        testFormData.append('file', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        
        const testResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
          {
            method: 'POST',
            body: testFormData,
          }
        );
        
        if (testResponse.ok) {
          const successData = await testResponse.json();
          console.log('Cloudinary 성공 응답:', successData);
          alert('✅ Cloudinary 연결 성공! Upload Preset이 정상 작동합니다.');
        } else {
          const errorData = await testResponse.json();
          console.log('Cloudinary 응답:', errorData);
          
          if (errorData.error?.message?.includes('Upload preset')) {
            alert('❌ Upload Preset이 존재하지 않습니다. Cloudinary에서 "subscription_manager" 프리셋을 생성해주세요.');
          } else if (errorData.error?.message?.includes('Invalid image file')) {
            alert('✅ Cloudinary 연결 성공! Upload Preset이 존재합니다. (테스트 이미지 오류는 정상)');
          } else {
            alert(`❌ 오류: ${errorData.error?.message || '알 수 없는 오류'}`);
          }
        }
      } catch (error) {
        console.error('연결 테스트 실패:', error);
        alert('❌ Cloudinary 연결 실패. Cloud Name을 확인해주세요.');
      }
    } else {
      alert('❌ 환경 변수가 설정되지 않았습니다.');
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium text-yellow-800 mb-2">
        🔧 Cloudinary 디버그
      </h3>
      <div className="text-xs text-yellow-700 space-y-1 mb-3">
        <p>Cloud Name: {cloudinaryConfig.cloudName || '❌ 미설정'}</p>
        <p>Upload Preset: {cloudinaryConfig.uploadPreset || '❌ 미설정'}</p>
        <p>설정 상태: {isCloudinaryConfigured() ? '✅ 완료' : '❌ 미완료'}</p>
      </div>
      <button
        onClick={testCloudinaryConnection}
        className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
      >
        연결 테스트
      </button>
    </div>
  );
}