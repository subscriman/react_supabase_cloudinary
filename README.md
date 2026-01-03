# 구독 관리 앱 (Subscription Manager)

React Native + Supabase + Cloudinary를 활용한 구독 서비스 관리 앱

## 🚀 주요 기능

### 📱 모바일 앱 (React Native)
- **구독 상품 관리**: 결제일, 만료일 추적
- **알림 시스템**: 로컬 푸시 알림으로 결제/만료일 알림
- **프리셋 시스템**: T우주, 네이버플러스 등 사전 정의된 구독 템플릿
- **프리셋 공유**: XML 파일로 사용자 간 프리셋 공유
- **서브 상품 관리**: 쿠폰, 혜택 등 세부 항목 관리

### 🌐 웹 관리자 (Next.js)
- **프리셋 관리**: 공식 구독 상품 프리셋 등록/수정
- **배너 관리**: 앱 메인 화면 배너 관리 (Cloudinary 이미지 업로드)
- **사용자 프리셋**: 사용자 제작 프리셋 승인/관리
- **통계 대시보드**: 사용자, 구독, 다운로드 통계

### ☁️ 백엔드 (Supabase)
- **실시간 데이터베이스**: PostgreSQL 기반
- **인증 시스템**: 소셜 로그인 (Google, Kakao, Naver)
- **파일 저장소**: 프리셋 XML 파일 저장
- **실시간 동기화**: 멀티 디바이스 데이터 동기화

### 🖼️ 이미지 관리 (Cloudinary)
- **자동 최적화**: WebP, AVIF 변환, 압축
- **반응형 이미지**: 디바이스별 최적화된 크기 제공
- **CDN 배포**: 전 세계 빠른 이미지 로딩

## 🛠️ 기술 스택

- **Frontend**: React Native, Next.js, TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Image**: Cloudinary (Upload, Optimization, CDN)
- **State Management**: React Hooks
- **Styling**: Tailwind CSS (Web), StyleSheet (Mobile)
- **Build Tools**: Metro (RN), Webpack (Next.js)

## 📦 프로젝트 구조

```
subscription-manager/
├── mobile/          # React Native 앱
│   ├── src/
│   │   ├── screens/     # 화면 컴포넌트
│   │   ├── services/    # API 서비스
│   │   └── components/  # 재사용 컴포넌트
│   └── package.json
├── web/            # Next.js 관리자 웹
│   ├── pages/          # 페이지 라우팅
│   ├── components/     # 컴포넌트
│   ├── lib/           # 유틸리티
│   └── package.json
├── database/       # Supabase 스키마
│   ├── schema.sql     # 테이블 정의
│   └── functions.sql  # 데이터베이스 함수
├── shared/         # 공통 타입 정의
│   └── types.ts
└── docs/           # 문서
    ├── setup.md
    └── cloudinary-setup.md
```

## 🚀 빠른 시작

### 1. 저장소 클론
```bash
git clone https://github.com/subscriman/react_supabase_cloudinary.git
cd react_supabase_cloudinary
```

### 2. 환경 변수 설정
```bash
# 루트 디렉토리에 .env 파일 생성
cp .env.example .env

# 웹 프로젝트에 .env.local 파일 생성
cp .env.example web/.env.local

# 모바일 프로젝트에 .env 파일 생성
cp .env.example mobile/.env
```

각 파일에 실제 API 키를 입력하세요.

### 3. 의존성 설치
```bash
# 전체 프로젝트 설치
npm run setup

# 또는 개별 설치
cd web && npm install
cd mobile && npm install
```

### 4. Supabase 설정
```bash
# Supabase CLI 설치 (macOS)
brew install supabase/tap/supabase

# 프로젝트 연결
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# 데이터베이스 마이그레이션
supabase db push
```

### 5. 개발 서버 실행
```bash
# 웹 관리자 실행
npm run dev:web

# 모바일 앱 실행
npm run dev:mobile
```

## 📋 설정 가이드

### Supabase 설정
1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. `database/schema.sql` 실행하여 테이블 생성
3. Authentication 설정에서 소셜 로그인 활성화

### Cloudinary 설정
1. [Cloudinary](https://cloudinary.com)에서 계정 생성
2. Upload Preset 생성:
   - Name: `subscription_manager`
   - Signing Mode: `Unsigned`
   - Asset folder: `subscription-manager`
3. 환경 변수에 Cloud Name, API Key 설정

자세한 설정 방법은 [docs/cloudinary-setup.md](docs/cloudinary-setup.md)를 참고하세요.

## 🎯 주요 화면

### 모바일 앱
- **홈 화면**: 인기 구독 서비스 배너, 프리셋 목록
- **T우주 프리셋**: 배달의민족 쿠폰 관리 예시
- **내 구독**: 등록된 구독 상품 목록 및 알림 설정
- **프리셋 공유**: XML 파일로 프리셋 내보내기/가져오기

### 웹 관리자
- **프리셋 관리**: 공식 구독 상품 템플릿 등록
- **배너 관리**: 메인 화면 배너 이미지 업로드
- **사용자 프리셋**: 커뮤니티 프리셋 승인/관리
- **통계**: 사용자 및 다운로드 통계

## 🔧 개발 명령어

```bash
# 개발 서버
npm run dev:web          # 웹 관리자 (localhost:3000)
npm run dev:mobile       # 모바일 앱

# 빌드
npm run build:web        # 웹 프로덕션 빌드
npm run build:android    # Android APK 빌드
npm run build:ios        # iOS 빌드

# 데이터베이스
supabase db push         # 마이그레이션 적용
supabase db pull         # 원격 변경사항 가져오기
```

## 📱 지원 플랫폼

- **iOS**: 13.0+
- **Android**: API 21+ (Android 5.0)
- **Web**: Chrome, Safari, Firefox 최신 버전

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

## 📞 문의

- 프로젝트 링크: [https://github.com/subscriman/react_supabase_cloudinary](https://github.com/subscriman/react_supabase_cloudinary)
- 이슈 리포트: [Issues](https://github.com/subscriman/react_supabase_cloudinary/issues)