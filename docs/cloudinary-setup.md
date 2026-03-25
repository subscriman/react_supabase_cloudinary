# Cloudinary 설정 가이드

## 1. Cloudinary 계정 생성

1. [Cloudinary](https://cloudinary.com) 방문
2. 무료 계정 생성
3. 대시보드에서 다음 정보 확인:
   - Cloud Name
   - API Key
   - API Secret

## 2. Upload Preset 생성

1. Cloudinary 대시보드 → Settings → Upload
2. "Add upload preset" 클릭
3. **기본 설정**:
   - **Preset name**: `subscription_manager`
   - **Signing Mode**: `Unsigned`
   - **Asset folder**: `subscription-manager`
   - **Allowed formats**: `jpg,png,gif,webp`
   - **Max file size**: `5000000` (5MB)

4. **파일명 및 Public ID 설정**:
   - **Disallow public ID**: `체크 해제` ✅
   - **Use filename**: `false` ✅ (우리가 코드에서 public_id 지정)
   - **Unique filename**: `false` ✅ (타임스탬프로 고유성 보장)
   - **Use filename as display name**: `true` ✅ (원본 파일명 보존)
   - **Use asset folder as public id prefix**: `true` ✅ (폴더 구조 유지)
   - **Overwrite**: `false` ✅ (같은 이름 파일 덮어쓰기 방지)

5. **변환 설정**:
   - **Type**: `upload` ✅
   - **Quality**: `auto`
   - **Format**: `auto`
   - **Max dimensions**: `1920x1080`

### 2.1 설정 설명

#### 파일명 관련 설정:
- **Use filename: false** ✅
  - 원본 파일명 대신 우리가 지정한 public_id 사용
  - 코드에서 `banner-${title}-${timestamp}` 형태로 생성

- **Unique filename: false** ✅  
  - Cloudinary의 자동 고유 파일명 생성 비활성화
  - 우리가 타임스탬프로 고유성 보장

- **Use filename as display name: true** ✅
  - 원본 파일명을 display name으로 보존
  - 관리 시 원본 파일명 확인 가능

#### 폴더 관련 설정:
- **Use asset folder as public id prefix: true** ✅
  - 최종 public_id: `subscription-manager/banner-tworld-1704123456`
  - 폴더 구조로 체계적 관리

- **Overwrite: false** ✅
  - 같은 이름 파일 덮어쓰기 방지
  - 타임스탬프로 고유성 보장하므로 안전

#### 권장하는 이유:
1. **체계적 관리**: 폴더별로 이미지 분류
2. **고유성 보장**: 타임스탬프로 파일명 충돌 방지  
3. **의미있는 이름**: 배너 제목이 포함된 파일명
4. **원본 보존**: 업로드한 원본 파일명 정보 유지

## 3. 환경 변수 설정

### 3.1 루트 .env 파일
```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your_cloud_name"
NEXT_PUBLIC_CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET="subscription_manager"
```

### 3.2 웹 프로젝트 .env.local
```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your_cloud_name"
NEXT_PUBLIC_CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET="subscription_manager"
```

### 3.3 모바일 프로젝트 .env
```env
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_UPLOAD_PRESET="subscription_manager"
```

## 4. 사용법

### 4.1 웹 관리자에서 이미지 업로드
1. 배너 관리 → 새 배너 등록
2. 배너 제목 입력: "T우주"
3. 이미지 업로드 영역에 파일 드래그 또는 클릭
4. 이미지 선택 후 자동 업로드

**결과 예시:**
- **Public ID**: `subscription-manager/banner-t우주-1704123456`
- **URL**: `https://res.cloudinary.com/your_cloud/image/upload/subscription-manager/banner-t우주-1704123456.jpg`
- **Display Name**: 원본 파일명 (예: `tworld_banner.jpg`)

### 4.2 모바일 앱에서 이미지 업로드
```typescript
import { CloudinaryService } from '../services/cloudinaryService';

// 이미지 업로드
const imageUrl = await CloudinaryService.uploadImage(imageUri);

// 최적화된 이미지 URL 생성
const optimizedUrl = CloudinaryService.getOptimizedImageUrl(publicId, {
  width: 300,
  height: 120,
  quality: 'auto'
});
```

## 5. 이미지 최적화

Cloudinary는 자동으로 다음 최적화를 수행합니다:
- **포맷 최적화**: WebP, AVIF 등 최신 포맷 자동 변환
- **품질 최적화**: 시각적 품질 유지하며 파일 크기 최소화
- **크기 조정**: 디바이스에 맞는 크기로 자동 조정
- **압축**: 무손실/손실 압축 자동 적용

## 6. 보안 설정

### 6.1 Upload Preset 보안 설정
- **Signing Mode**: `Unsigned` (클라이언트 직접 업로드)
- **Disallow public ID**: `체크 해제` (의미있는 파일명 허용)
- **Folder**: `subscription-manager` (업로드 경로 제한)
- **Allowed formats**: `jpg,png,gif,webp` (이미지만 허용)
- **Max file size**: `5000000` (5MB 제한)
- **Auto tagging**: `enabled` (자동 태그 생성)
- **Moderation**: `manual` (수동 검토, 필요시)

### 6.2 추가 보안 옵션 (선택사항)
- **Eager transformations**: 업로드 시 자동 변환
- **Notification URL**: 업로드 완료 시 웹훅
- **Context**: 메타데이터 자동 추가
- **Face detection**: 얼굴 인식 기반 크롭핑

### 6.2 API 키 보안
- API Secret은 서버 사이드에서만 사용
- 클라이언트에는 Cloud Name과 API Key만 노출
- Upload Preset으로 업로드 권한 제어

## 7. 비용 최적화

### 7.1 무료 플랜 한도
- 월 25GB 저장공간
- 월 25GB 대역폭
- 월 25,000회 변환

### 7.2 최적화 팁
- 적절한 이미지 크기로 업로드
- 불필요한 변환 요청 최소화
- CDN 캐싱 활용

## 8. 문제 해결

### 8.1 업로드 실패
- Upload Preset 설정 확인
- 파일 크기 및 형식 확인
- 네트워크 연결 상태 확인

### 8.2 이미지 로드 실패
- Cloudinary URL 형식 확인
- 이미지 존재 여부 확인
- 변환 파라미터 유효성 확인

## 9. 현재 구현 메모

- 웹 관리자와 사용자 화면의 이미지 입력은 URL 수동 입력이 아니라 Cloudinary 업로드로 동작합니다.
- 이미지 교체, 비우기, 이미지 칸 삭제 시에는 `/api/cloudinary/delete`를 통해 `subscription-manager/` 폴더의 원본 이미지를 함께 삭제합니다.
- Cloudinary 설정이 없거나 Cloudinary URL이 아닌 이미지는 삭제 API 대상에서 제외됩니다.
