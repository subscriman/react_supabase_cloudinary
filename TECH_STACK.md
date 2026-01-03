# 📚 기술 스택 및 라이브러리 정보

## 🎯 프로젝트 개요
React Native + Supabase + Cloudinary를 활용한 구독 서비스 관리 앱 템플릿

---

## 🏗️ 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Web Admin     │    │   Database      │
│  (React Native) │    │   (Next.js)     │    │   (Supabase)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Image Storage   │
                    │  (Cloudinary)   │
                    └─────────────────┘
```

---

## 📱 모바일 앱 (React Native)

### 핵심 프레임워크
- **React Native**: `0.72.6`
- **React**: `18.2.0`
- **TypeScript**: `4.8.4`
- **Metro**: `0.76.8` (번들러)

### 네비게이션
- **@react-navigation/native**: `^6.1.9`
- **@react-navigation/stack**: `^6.3.20`
- **@react-navigation/bottom-tabs**: `^6.5.11`

### 상태 관리 & 데이터
- **@supabase/supabase-js**: `^2.38.4`
- **@react-native-async-storage/async-storage**: `^1.19.5`
- **react-native-url-polyfill**: `^2.0.0`

### UI 컴포넌트
- **react-native-vector-icons**: `^10.0.2`
- **react-native-date-picker**: `^4.3.3`

### 알림 시스템
- **react-native-push-notification**: `^8.1.1`

### 파일 관리
- **react-native-share**: `^10.0.2`
- **react-native-document-picker**: `^9.1.1`
- **react-native-fs**: `^2.20.0`

### 인증
- **@react-native-google-signin/google-signin**: `^10.1.0`
- **react-native-kakao-login**: `^5.4.1`

### 개발 도구
- **@babel/core**: `^7.20.0`
- **@babel/preset-env**: `^7.20.0`
- **@babel/runtime**: `^7.20.0`
- **@react-native/eslint-config**: `^0.72.2`
- **@react-native/metro-config**: `^0.72.11`
- **@tsconfig/react-native**: `^3.0.0`
- **eslint**: `^8.19.0`
- **jest**: `^29.2.1`
- **prettier**: `^2.4.1`

---

## 🌐 웹 관리자 (Next.js)

### 핵심 프레임워크
- **Next.js**: `14.0.4`
- **React**: `^18.2.0`
- **React DOM**: `^18.2.0`
- **TypeScript**: `^5.3.3`

### 스타일링
- **Tailwind CSS**: `^3.3.6`
- **PostCSS**: `^8.4.32`
- **Autoprefixer**: `^10.4.16`

### 백엔드 연동
- **@supabase/supabase-js**: `^2.38.4`

### 이미지 관리
- **cloudinary**: `2.67.1` (서버사이드)
- **cloudinary-react**: `latest` (클라이언트사이드)

### 폼 관리
- **react-hook-form**: `^7.48.2`

### UI 아이콘
- **lucide-react**: `^0.294.0`

### 유틸리티
- **date-fns**: `^2.30.0`

### 개발 도구
- **ESLint**: `^8.56.0`
- **eslint-config-next**: `14.0.4`

---

## 🗄️ 데이터베이스 (Supabase)

### 데이터베이스
- **PostgreSQL**: `17.6.1` (Supabase 관리)
- **Row Level Security (RLS)**: 활성화
- **실시간 구독**: Supabase Realtime

### 인증
- **Supabase Auth**: 소셜 로그인 지원
  - Google OAuth
  - Kakao OAuth  
  - Naver OAuth

### 스토리지
- **Supabase Storage**: 파일 업로드/다운로드
- **Public Buckets**: 이미지 및 XML 파일

### CLI 도구
- **Supabase CLI**: `2.67.1`
- **Docker**: 로컬 개발 환경

---

## 🖼️ 이미지 관리 (Cloudinary)

### 핵심 기능
- **이미지 업로드**: Unsigned Upload Preset
- **자동 최적화**: WebP, AVIF 변환
- **반응형 이미지**: 디바이스별 크기 조정
- **CDN**: 전 세계 빠른 배포

### 설정
- **Upload Preset**: `subscription_manager`
- **Signing Mode**: `Unsigned`
- **Asset Folder**: `subscription-manager`
- **Allowed Formats**: `jpg,png,gif,webp`
- **Max File Size**: `5MB`

---

## 🛠️ 개발 도구

### 버전 관리
- **Git**: 분산 버전 관리
- **GitHub**: 원격 저장소

### 패키지 관리
- **npm**: Node.js 패키지 매니저
- **Node.js**: `>=16` (권장: 18+)

### 코드 품질
- **ESLint**: JavaScript/TypeScript 린터
- **Prettier**: 코드 포매터
- **TypeScript**: 정적 타입 검사

### 빌드 도구
- **Metro**: React Native 번들러
- **Webpack**: Next.js 번들러 (내장)
- **Babel**: JavaScript 트랜스파일러

---

## 📦 프로젝트 구조

```
subscription-manager/
├── 📱 mobile/                    # React Native 앱
│   ├── src/
│   │   ├── screens/             # 화면 컴포넌트
│   │   ├── services/            # API 서비스 레이어
│   │   ├── components/          # 재사용 컴포넌트
│   │   └── config/              # 설정 파일
│   ├── android/                 # Android 네이티브 코드
│   ├── ios/                     # iOS 네이티브 코드
│   └── package.json
├── 🌐 web/                      # Next.js 웹 관리자
│   ├── pages/                   # 페이지 라우팅
│   ├── components/              # React 컴포넌트
│   ├── lib/                     # 유틸리티 함수
│   ├── styles/                  # CSS 스타일
│   └── package.json
├── 🗄️ database/                 # Supabase 스키마
│   ├── schema.sql              # 테이블 정의
│   ├── functions.sql           # 데이터베이스 함수
│   └── simple-schema.sql       # 간단한 테스트 스키마
├── 🔄 supabase/                 # Supabase CLI 설정
│   ├── migrations/             # 데이터베이스 마이그레이션
│   └── config.toml             # Supabase 로컬 설정
├── 🔗 shared/                   # 공통 타입 정의
│   └── types.ts                # TypeScript 인터페이스
├── 📜 scripts/                  # 유틸리티 스크립트
│   ├── deploy-db.js            # 데이터베이스 배포
│   └── manual-sql.sql          # 수동 SQL 실행
└── 📚 docs/                     # 문서
    ├── setup.md                # 설정 가이드
    └── cloudinary-setup.md     # Cloudinary 설정
```

---

## 🚀 배포 환경

### 모바일 앱
- **Android**: API 21+ (Android 5.0+)
- **iOS**: iOS 13.0+
- **배포**: Google Play Store, Apple App Store

### 웹 관리자
- **호스팅**: Netlify (권장)
- **빌드**: Static Site Generation (SSG)
- **도메인**: 커스텀 도메인 지원

### 데이터베이스
- **Supabase Cloud**: 관리형 PostgreSQL
- **지역**: 싱가포르 (Southeast Asia)
- **백업**: 자동 백업 및 Point-in-time Recovery

### 이미지 저장소
- **Cloudinary**: CDN 기반 이미지 서비스
- **저장소**: 무료 플랜 25GB
- **대역폭**: 월 25GB 전송량

---

## 🔧 환경 변수

### 필수 환경 변수
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=subscription_manager

# 소셜 로그인 (선택사항)
GOOGLE_CLIENT_ID=your_google_client_id
KAKAO_APP_KEY=your_kakao_app_key
```

---

## 📊 성능 최적화

### 모바일 앱
- **코드 스플리팅**: 화면별 번들 분리
- **이미지 최적화**: Cloudinary 자동 최적화
- **로컬 캐싱**: AsyncStorage 활용
- **오프라인 지원**: 로컬 데이터베이스 동기화

### 웹 관리자
- **Static Generation**: Next.js SSG
- **이미지 최적화**: Cloudinary CDN
- **코드 스플리팅**: 페이지별 번들 분리
- **CSS 최적화**: Tailwind CSS Purge

---

## 🔒 보안

### 인증 & 권한
- **JWT 토큰**: Supabase Auth
- **Row Level Security**: 데이터베이스 레벨 보안
- **OAuth 2.0**: 소셜 로그인
- **API 키 관리**: 환경 변수 분리

### 데이터 보호
- **HTTPS**: 모든 통신 암호화
- **CORS**: Cross-Origin 요청 제한
- **Input Validation**: 클라이언트/서버 검증
- **File Upload**: 파일 타입 및 크기 제한

---

## 🧪 테스트

### 단위 테스트
- **Jest**: JavaScript 테스트 프레임워크
- **React Native Testing Library**: 컴포넌트 테스트
- **Supabase Mock**: 데이터베이스 모킹

### 통합 테스트
- **API 테스트**: Supabase 연동 테스트
- **이미지 업로드**: Cloudinary 연동 테스트
- **알림 시스템**: 로컬 푸시 알림 테스트

---

## 📈 모니터링 & 분석

### 성능 모니터링
- **Supabase Dashboard**: 데이터베이스 성능
- **Cloudinary Analytics**: 이미지 사용량
- **Next.js Analytics**: 웹 성능 지표

### 오류 추적
- **Console Logging**: 개발 환경 디버깅
- **Supabase Logs**: 서버 사이드 로그
- **React Native Debugger**: 모바일 디버깅

---

## 🔄 CI/CD (향후 확장)

### 권장 도구
- **GitHub Actions**: 자동화된 빌드/배포
- **Fastlane**: 모바일 앱 배포 자동화
- **Netlify**: 웹 자동 배포
- **Supabase CLI**: 데이터베이스 마이그레이션

### 배포 파이프라인
```yaml
# 예시 GitHub Actions 워크플로우
name: Deploy
on: [push]
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Netlify
        run: npm run build:web
  mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build Android
        run: npm run build:android
```

---

## 📝 라이선스 & 의존성

### 오픈소스 라이선스
- **MIT License**: 대부분의 라이브러리
- **Apache 2.0**: React Native 관련
- **BSD**: 일부 유틸리티 라이브러리

### 상업적 서비스
- **Supabase**: 무료 플랜 → 유료 플랜
- **Cloudinary**: 무료 플랜 → 유료 플랜
- **Google/Kakao OAuth**: 무료 (사용량 제한)

---

## 🎯 확장 가능성

### 추가 기능
- **푸시 알림 서버**: Firebase Cloud Messaging
- **결제 시스템**: Stripe, 토스페이먼츠
- **분석 도구**: Google Analytics, Mixpanel
- **A/B 테스트**: Firebase Remote Config

### 다국어 지원
- **react-native-localize**: 모바일 다국어
- **next-i18next**: 웹 다국어
- **Supabase i18n**: 데이터베이스 다국어

---

이 문서는 프로젝트의 모든 기술적 세부사항을 포함하고 있어, 다른 프로젝트에서 참고하거나 팀원들과 공유할 때 유용할 것입니다. 🚀