# 템플릿 사용 가이드

이 저장소는 구독/멤버십 앱을 빠르게 시작하기 위한 템플릿입니다.
핵심 목표는 "복사 후 바로 Android, iOS, Web을 띄울 수 있는 시작점"을 제공하는 것입니다.

## 1. 이 템플릿이 이미 포함하는 것

- React Native 0.72.6 + Next.js 관리자 웹
- Android/iOS 네이티브 프로젝트 골격
- Node 20 기준 환경 파일
- Netlify 배포 설정
- Supabase/Cloudinary 연동 예시
- Android 로그 저장 기능
- Maps API key placeholder 주입 구조

## 2. 이 템플릿의 기본 예제값

새 프로젝트로 시작하면 아래 값은 대부분 교체 대상입니다.

- Android package: `com.subscri.manager`
- iOS project/target: `SubscriptionManager`
- 모바일 앱 표시명: `구독 관리`
- GitHub repo 예시: `react_supabase_cloudinary`
- Netlify site 예시: `subman-kiro-admin`
- Cloudinary upload preset 예시: `subscription_manager`

전체 치환 목록은 [프로젝트_복사_치환_체크리스트.md](프로젝트_복사_치환_체크리스트.md)를 따르세요.

## 3. 새 프로젝트 시작 순서

### 방법 1. GitHub Template 사용

1. 원본 저장소에서 `Use this template`
2. 새 저장소 생성
3. 로컬로 클론

### 방법 2. 직접 복사/클론

```bash
git clone https://github.com/subscriman/react_supabase_cloudinary.git my-app
cd my-app
rm -rf .git
git init
```

복사 직후 바로 할 일:

1. [프로젝트_복사_치환_체크리스트.md](프로젝트_복사_치환_체크리스트.md) 열기
2. 프로젝트명, 패키지명, Bundle ID부터 교체
3. 예시 env 파일을 실제 env 파일로 복사
4. Firebase/Maps/Netlify 값을 새 프로젝트 기준으로 연결

## 4. 초기 설정

```bash
nvm install 20
nvm use

cp .env.example .env
cp mobile/.env.example mobile/.env
cp web/.env.local.example web/.env.local

npm run setup
cd mobile/ios && pod install && cd ../..
```

## 5. 필수 외부 서비스 연결

### Supabase

- 새 프로젝트 생성
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Cloudinary

- Cloud name / API key / API secret 발급
- 업로드 프리셋 생성
- 기본 예제 preset 이름은 `subscription_manager`
- 프로젝트에 맞는 이름으로 바꿔도 되지만, 바꿨다면 코드/환경변수/문서도 함께 수정

### Firebase

- Android 앱 생성 후 `google-services.json` 발급
- iOS 앱 생성 후 `GoogleService-Info.plist` 발급
- 패키지명/Bundle ID와 반드시 일치시켜야 함

### Netlify

- 새 사이트 생성
- GitHub 저장소 연결
- 환경변수 등록

## 6. 개발 실행

```bash
# Web
npm run dev:web

# Mobile Metro
npm run dev:mobile

# Android
cd mobile && npx react-native run-android

# iOS
cd mobile && npx react-native run-ios
```

## 7. 템플릿으로 유지해도 되는 값

아래는 새 프로젝트에서도 그대로 유지해도 되는 공통 기반값입니다.

- Node 20 (`.nvmrc`, `engines.node`)
- React Native 0.72.6
- AGP 7.4.2 / Gradle 7.5.1 / Kotlin 1.8.22
- `newArchEnabled=false`
- `hermesEnabled=true`
- `compileSdkVersion 34`
- `targetSdkVersion 34`
- `minSdkVersion 23`
- Netlify Next.js plugin 설정

## 8. 문서 위치

- 전체 복사/치환 체크: [프로젝트_복사_치환_체크리스트.md](프로젝트_복사_치환_체크리스트.md)
- RN 환경 이식 기준: [2026-03-09_프로젝트_환경_이식_가이드.md](2026-03-09_프로젝트_환경_이식_가이드.md)
- 일반 설정 가이드: [setup.md](setup.md)
- Cloudinary 설정: [cloudinary-setup.md](cloudinary-setup.md)
