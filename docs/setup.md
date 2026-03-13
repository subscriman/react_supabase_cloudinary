# 구독 관리 앱 템플릿 설정 가이드

이 문서는 템플릿을 새 프로젝트로 시작한 뒤 환경을 연결하는 기본 설정 가이드입니다.

전체 치환 항목은 [docs/프로젝트_복사_치환_체크리스트.md](./프로젝트_복사_치환_체크리스트.md)를 먼저 참고하세요.

## 1. 프로젝트 구조
```
subscription-manager/
├── mobile/          # React Native 앱
├── web/            # 관리자 웹 페이지 (Next.js)
├── database/       # Supabase 스키마 및 함수
├── shared/         # 공통 타입 정의
└── docs/           # 문서
```

## 2. Supabase 설정

### 2.1 프로젝트 생성
1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 데이터베이스 비밀번호 설정

### 2.2 데이터베이스 스키마 적용
1. Supabase 대시보드 → SQL Editor
2. `database/schema.sql` 파일 내용 실행
3. `database/functions.sql` 파일 내용 실행

### 2.3 인증 설정
1. Authentication → Settings
2. 소셜 로그인 제공자 설정 (Google, Kakao 등)

### 2.4 스토리지 설정 (이미지 호스팅용)
1. Storage → Create bucket: `preset-images`
2. 공개 접근 정책 설정

## 3. 환경 변수 설정

### 3.1 공통 환경 변수
`.env` 파일 생성 (`cp .env.example .env`):
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3.2 모바일 앱 환경 변수
`mobile/.env` 파일 생성 (`cp mobile/.env.example mobile/.env`):
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3.3 웹 환경 변수
`web/.env.local` 파일 생성 (`cp web/.env.local.example web/.env.local`)

### 3.4 시크릿 관리 규칙
1. 실제 키/시크릿은 `.env`, `mobile/.env`, `web/.env.local`에만 저장
2. Git에는 예시 파일(`*.example`)만 커밋
3. CI/배포 환경(Netlify 등)은 플랫폼 시크릿 변수로 등록
4. Android Maps 키는 `~/.gradle/gradle.properties` 또는 CI 변수(`GOOGLE_MAPS_API_KEY`)로만 주입

## 4. 개발 환경 설정

### 4.1 의존성 설치
```bash
# 루트에서 전체 설치
npm run setup

# 또는 개별 설치
cd mobile && npm install
cd web && npm install
```

### 4.2 React Native 개발 환경
1. Node.js LTS 20 사용 (`nvm use` 또는 `nvm install 20 && nvm use`)
2. React Native CLI 설치: `npm install -g react-native-cli`
3. Android Studio (Android) 또는 Xcode (iOS) 설치
4. 에뮬레이터/시뮬레이터 설정

### 4.3 개발 서버 실행
```bash
# 모바일 앱
npm run dev:mobile

# 웹 관리자
npm run dev:web
```

## 5. 배포

### 5.1 웹 관리자 배포 (Netlify)
1. GitHub 저장소 연결
2. Base directory: `web`
3. Build command: `npm run build`
4. Publish directory: `.next`
5. 환경 변수 설정

### 5.2 모바일 앱 빌드
```bash
# Android Debug APK
cd mobile && npm run build:debug

# Android Release APK
cd mobile && npm run build:release

# iOS는 Xcode 또는 react-native run-ios 기준으로 빌드/실행
cd mobile && npx react-native run-ios
```

## 6. 초기 데이터 설정

### 6.1 T우주 프리셋 등록
관리자 웹에서 다음 정보로 프리셋 등록:
- 상품명: T우주
- 제공업체: SKT
- 설명: 배달의민족 3천원 쿠폰 3장 제공
- 서브 상품:
  - 배달의민족 3천원 쿠폰 #1 (쿠폰, 30일)
  - 배달의민족 3천원 쿠폰 #2 (쿠폰, 30일)
  - 배달의민족 3천원 쿠폰 #3 (쿠폰, 30일)

### 6.2 배너 설정
관리자 웹에서 메이저 사업자 배너 등록

## 7. 테스트 시나리오

### 7.1 기본 기능 테스트
1. T우주 프리셋 선택
2. 구독 정보 입력 (시작일, 결제일, 금액)
3. 쿠폰 수령일 설정
4. 등록 완료 및 알림 설정 확인

### 7.2 프리셋 공유 테스트
1. 구독 상품을 프리셋으로 내보내기
2. XML 파일 생성 및 공유
3. 다른 기기에서 프리셋 가져오기
4. 프리셋 적용 및 커스터마이징

## 8. 템플릿 기준 유지값

새 프로젝트에서도 그대로 유지해도 되는 권장 기준:

- Node 20
- React Native 0.72.6
- Next.js 14
- Android `minSdkVersion 23`
- AGP 7.4.2 / Gradle 7.5.1 / Kotlin 1.8.22
- `newArchEnabled=false`
- `hermesEnabled=true`

## 9. 주요 기능 구현 상태

✅ 완료:
- 기본 데이터베이스 스키마
- Supabase 연동
- 기본 서비스 클래스들
- T우주 프리셋 화면
- 관리자 웹 기본 구조

🚧 진행 중:
- 알림 시스템 완성
- 프리셋 공유 기능
- 사용자 인증
- 전체 화면 구성

📋 예정:
- 앱 아이콘 및 스플래시 화면
- 푸시 알림 서버
- 앱스토어 배포 준비
