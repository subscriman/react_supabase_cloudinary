# 🚀 템플릿 사용 가이드

이 템플릿을 사용해서 새로운 구독 관리 앱을 빠르게 개발하는 방법을 안내합니다.

---

## 📋 사전 준비사항

### 필수 소프트웨어
- **Node.js**: 18.0+ ([다운로드](https://nodejs.org))
- **Git**: 최신 버전
- **Android Studio**: Android 개발용 (선택사항)
- **Xcode**: iOS 개발용 (macOS만, 선택사항)

### 필수 계정
- **GitHub**: 코드 저장소
- **Supabase**: 데이터베이스 ([가입](https://supabase.com))
- **Cloudinary**: 이미지 관리 ([가입](https://cloudinary.com))

---

## 🎯 1단계: 템플릿 다운로드

### 방법 1: GitHub에서 직접 다운로드
```bash
# 저장소 클론
git clone https://github.com/subscriman/react_supabase_cloudinary.git my-subscription-app

# 프로젝트 폴더로 이동
cd my-subscription-app

# 기존 Git 히스토리 제거 (새 프로젝트로 시작)
rm -rf .git
git init
```

### 방법 2: GitHub Template 사용
1. [GitHub 저장소](https://github.com/subscriman/react_supabase_cloudinary) 방문
2. **"Use this template"** 버튼 클릭
3. 새 저장소 이름 입력 (예: `my-subscription-app`)
4. **"Create repository from template"** 클릭
5. 생성된 저장소를 로컬에 클론

---

## ⚙️ 2단계: 환경 설정

### 환경 변수 파일 생성
```bash
# 루트 디렉토리에 환경 변수 파일 생성
cp .env.example .env

# 웹 프로젝트용 환경 변수 파일 생성
cp .env.example web/.env.local

# 모바일 프로젝트용 환경 변수 파일 생성
cp .env.example mobile/.env
```

### 의존성 설치
```bash
# 전체 프로젝트 의존성 설치
npm run setup

# 또는 개별 설치
cd web && npm install
cd ../mobile && npm install
```

---

## 🗄️ 3단계: Supabase 설정

### 1. Supabase 프로젝트 생성
1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. **"New project"** 클릭
3. 프로젝트 정보 입력:
   - **Name**: `my-subscription-app`
   - **Database Password**: 강력한 비밀번호 설정
   - **Region**: 가까운 지역 선택 (예: Southeast Asia)
4. **"Create new project"** 클릭

### 2. API 키 확인
1. 프로젝트 대시보드 → **Settings** → **API**
2. 다음 정보 복사:
   - **Project URL**
   - **anon public** key

### 3. 환경 변수 업데이트
```env
# .env, web/.env.local, mobile/.env 파일에 입력
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

### 4. 데이터베이스 마이그레이션
```bash
# Supabase CLI 설치 (macOS)
brew install supabase/tap/supabase

# 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref YOUR_PROJECT_REF

# 데이터베이스 스키마 적용
supabase db push
```

---

## 🖼️ 4단계: Cloudinary 설정

### 1. Cloudinary 계정 생성
1. [Cloudinary](https://cloudinary.com) 가입
2. 대시보드에서 **Account Details** 확인:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

### 2. Upload Preset 생성
1. **Settings** → **Upload** → **Upload presets**
2. **"Add upload preset"** 클릭
3. 설정:
   - **Preset name**: `subscription_manager`
   - **Signing Mode**: `Unsigned` ✅
   - **Asset folder**: `subscription-manager`
   - **Allowed formats**: `jpg,png,gif,webp`
   - **Max file size**: `5000000` (5MB)
4. **Save** 클릭

### 3. 환경 변수 업데이트
```env
# .env, web/.env.local, mobile/.env 파일에 입력
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"
NEXT_PUBLIC_CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET="subscription_manager"
```

---

## 🚀 5단계: 개발 서버 실행

### 웹 관리자 실행
```bash
npm run dev:web
# 또는
cd web && npm run dev

# 브라우저에서 http://localhost:3000 접속
```

### 모바일 앱 실행 (선택사항)
```bash
# Metro 서버 시작
npm run dev:mobile
# 또는
cd mobile && npm start

# 별도 터미널에서 Android 실행
cd mobile && npx react-native run-android

# 별도 터미널에서 iOS 실행 (macOS만)
cd mobile && npx react-native run-ios
```

---

## ✅ 6단계: 기능 테스트

### 웹 관리자 테스트
1. **http://localhost:3000** 접속
2. **"배너 관리"** 탭 클릭
3. **Cloudinary 디버그** 섹션에서 **"연결 테스트"** 클릭
4. ✅ "Cloudinary 연결 성공!" 메시지 확인
5. **새 배너 등록** 테스트:
   - 제목: "테스트 배너"
   - 이미지 업로드
   - 저장 확인

### 프리셋 관리 테스트
1. **"공식 프리셋 관리"** 탭에서 기존 프리셋 확인
2. **새 프리셋 등록** 테스트:
   - 상품명: "테스트 구독"
   - 제공업체: "테스트 회사"
   - 서브 상품 추가
   - 저장 확인

---

## 🎨 7단계: 커스터마이징

### 프로젝트 정보 변경
```bash
# package.json 파일들 수정
# - name: 프로젝트 이름 변경
# - description: 프로젝트 설명 변경
# - author: 작성자 정보 입력
```

### 브랜딩 변경
```bash
# 앱 이름 및 아이콘 변경
# mobile/android/app/src/main/res/values/strings.xml
# mobile/ios/SubscriptionManager/Info.plist

# 웹 타이틀 변경
# web/pages/index.tsx의 <title> 태그
```

### 색상 테마 변경
```bash
# Tailwind CSS 색상 커스터마이징
# web/tailwind.config.js

# React Native 스타일 변경
# mobile/src/screens/*.tsx의 StyleSheet
```

---

## 📱 8단계: 모바일 앱 설정 (선택사항)

### Android 설정
```bash
# 패키지명 변경
# android/app/src/main/java/com/subscriptionmanager/
# android/app/build.gradle의 applicationId

# 앱 이름 변경
# android/app/src/main/res/values/strings.xml
```

### iOS 설정 (macOS만)
```bash
# Bundle Identifier 변경
# ios/SubscriptionManager.xcodeproj/project.pbxproj

# 앱 이름 변경
# ios/SubscriptionManager/Info.plist
```

### 푸시 알림 설정
```bash
# Firebase 프로젝트 생성 (선택사항)
# google-services.json (Android)
# GoogleService-Info.plist (iOS)
```

---

## 🚀 9단계: 배포 준비

### 웹 관리자 배포 (Netlify)
```bash
# 빌드 테스트
cd web && npm run build

# Netlify에 배포
# 1. GitHub 저장소 연결
# 2. Build command: cd web && npm run build
# 3. Publish directory: web/out
# 4. 환경 변수 설정
```

### 모바일 앱 빌드
```bash
# Android APK 빌드
cd mobile/android
./gradlew assembleRelease

# iOS 빌드 (macOS만)
cd mobile/ios
xcodebuild -workspace SubscriptionManager.xcworkspace -scheme SubscriptionManager -configuration Release archive
```

---

## 🔧 10단계: 추가 설정 (선택사항)

### 소셜 로그인 설정
```bash
# Google OAuth 설정
# 1. Google Cloud Console에서 OAuth 클라이언트 생성
# 2. 환경 변수에 GOOGLE_CLIENT_ID 추가

# Kakao 로그인 설정
# 1. Kakao Developers에서 앱 생성
# 2. 환경 변수에 KAKAO_APP_KEY 추가
```

### 도메인 설정
```bash
# 커스텀 도메인 연결 (Netlify)
# DNS 설정 및 SSL 인증서 자동 생성
```

### 모니터링 설정
```bash
# Google Analytics 연동 (선택사항)
# Sentry 오류 추적 (선택사항)
# Supabase 대시보드 모니터링
```

---

## 📚 추가 리소스

### 문서
- **TECH_STACK.md**: 기술 스택 상세 정보
- **DEVELOPMENT_ENVIRONMENT.md**: 개발 환경 설정
- **PROJECT_FEATURES.md**: 기능 상세 설명
- **docs/setup.md**: Supabase 설정 가이드
- **docs/cloudinary-setup.md**: Cloudinary 설정 가이드

### 도움말
- [React Native 공식 문서](https://reactnative.dev/docs/getting-started)
- [Next.js 공식 문서](https://nextjs.org/docs)
- [Supabase 공식 문서](https://supabase.com/docs)
- [Cloudinary 공식 문서](https://cloudinary.com/documentation)

---

## 🆘 문제 해결

### 자주 발생하는 문제

#### 1. Supabase 연결 오류
```bash
# 환경 변수 확인
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# 프로젝트 재연결
supabase link --project-ref YOUR_PROJECT_REF
```

#### 2. Cloudinary 업로드 실패
```bash
# Upload Preset 확인
# - Signing Mode가 "Unsigned"인지 확인
# - Preset name이 "subscription_manager"인지 확인

# 환경 변수 확인
echo $NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
echo $NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
```

#### 3. 모바일 앱 빌드 오류
```bash
# 캐시 클리어
cd mobile
npx react-native start --reset-cache

# iOS 의존성 재설치 (macOS만)
cd ios && rm -rf Pods Podfile.lock && pod install

# Android 클린 빌드
cd android && ./gradlew clean
```

#### 4. 웹 빌드 오류
```bash
# 의존성 재설치
cd web
rm -rf node_modules package-lock.json
npm install
```

---

## 🎯 성공 체크리스트

- [ ] Supabase 프로젝트 생성 및 연결 완료
- [ ] Cloudinary 계정 생성 및 Upload Preset 설정 완료
- [ ] 환경 변수 모든 파일에 올바르게 설정
- [ ] 웹 관리자 정상 실행 (localhost:3000)
- [ ] Cloudinary 연결 테스트 성공
- [ ] 프리셋 등록/수정 기능 테스트 완료
- [ ] 배너 이미지 업로드 테스트 완료
- [ ] 모바일 앱 실행 테스트 (선택사항)
- [ ] 프로젝트 정보 커스터마이징 완료
- [ ] Git 저장소 초기화 및 첫 커밋 완료

---

이 가이드를 따라하면 30분 내에 완전히 작동하는 구독 관리 앱을 구축할 수 있습니다! 🚀

문제가 발생하면 각 단계를 다시 확인하거나 문서를 참고하세요.