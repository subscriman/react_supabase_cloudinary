# 🛠️ 개발 환경 정보

## 💻 시스템 요구사항

### 운영체제
- **macOS**: 12.0+ (권장: 13.0+)
- **Windows**: 10/11 (WSL2 권장)
- **Linux**: Ubuntu 20.04+ / CentOS 8+

### 필수 소프트웨어
- **Node.js**: 18.0+ (권장: 18.17.0 LTS)
- **npm**: 9.0+ (Node.js와 함께 설치)
- **Git**: 2.30+
- **Python**: 3.8+ (React Native 빌드용)

### 모바일 개발 환경

#### Android 개발
- **Android Studio**: 2022.3.1+
- **Android SDK**: API 33+ (Target: API 34)
- **Java JDK**: 11 또는 17
- **Android Emulator**: API 28+ 권장

#### iOS 개발 (macOS만)
- **Xcode**: 14.0+
- **iOS Simulator**: iOS 13.0+
- **CocoaPods**: 1.11+
- **Command Line Tools**: Xcode와 함께 설치

---

## 🔧 개발 도구 설정

### 1. Node.js 설치
```bash
# nvm 사용 (권장)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18.17.0
nvm use 18.17.0

# 또는 직접 설치
# https://nodejs.org에서 LTS 버전 다운로드
```

### 2. React Native CLI 설치
```bash
npm install -g react-native-cli
npm install -g @react-native-community/cli
```

### 3. Supabase CLI 설치
```bash
# macOS (Homebrew)
brew install supabase/tap/supabase

# Windows/Linux
npm install -g supabase

# 또는 직접 다운로드
# https://github.com/supabase/cli/releases
```

### 4. Android Studio 설정
1. **Android Studio 설치**: https://developer.android.com/studio
2. **SDK 설정**:
   - Android SDK Platform 33
   - Android SDK Build-Tools 33.0.0
   - Android Emulator
   - Android SDK Platform-Tools
3. **환경 변수 설정**:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

### 5. Xcode 설정 (macOS)
1. **Xcode 설치**: App Store에서 설치
2. **Command Line Tools**:
   ```bash
   xcode-select --install
   ```
3. **CocoaPods 설치**:
   ```bash
   sudo gem install cocoapods
   ```

---

## 📦 프로젝트 설정

### 1. 저장소 클론
```bash
git clone https://github.com/subscriman/react_supabase_cloudinary.git
cd react_supabase_cloudinary
```

### 2. 의존성 설치
```bash
# 전체 프로젝트 설치
npm run setup

# 개별 설치
cd web && npm install
cd ../mobile && npm install
```

### 3. 환경 변수 설정
```bash
# 루트 디렉토리
cp .env.example .env

# 웹 프로젝트
cp .env.example web/.env.local

# 모바일 프로젝트
cp .env.example mobile/.env
```

### 4. iOS 의존성 설치 (macOS만)
```bash
cd mobile/ios
pod install
cd ../..
```

---

## 🚀 개발 서버 실행

### 웹 관리자
```bash
npm run dev:web
# 또는
cd web && npm run dev

# 접속: http://localhost:3000
```

### 모바일 앱
```bash
# Metro 서버 시작
npm run dev:mobile
# 또는
cd mobile && npm start

# Android 실행 (별도 터미널)
cd mobile && npx react-native run-android

# iOS 실행 (별도 터미널, macOS만)
cd mobile && npx react-native run-ios
```

---

## 🗄️ 데이터베이스 설정

### 1. Supabase 프로젝트 생성
1. [Supabase](https://supabase.com) 계정 생성
2. 새 프로젝트 생성
3. 데이터베이스 비밀번호 설정

### 2. 로컬 Supabase 연결
```bash
# 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref YOUR_PROJECT_REF

# 마이그레이션 적용
supabase db push
```

### 3. 로컬 개발 환경 (선택사항)
```bash
# Docker 필요
supabase start

# 로컬 URL: http://localhost:54323
# 로컬 DB: postgresql://postgres:postgres@localhost:54322/postgres
```

---

## 🖼️ Cloudinary 설정

### 1. 계정 생성
1. [Cloudinary](https://cloudinary.com) 계정 생성
2. Dashboard에서 Cloud Name, API Key 확인

### 2. Upload Preset 생성
1. **Settings** → **Upload** → **Upload presets**
2. **Add upload preset** 클릭
3. 설정:
   - **Preset name**: `subscription_manager`
   - **Signing Mode**: `Unsigned`
   - **Asset folder**: `subscription-manager`

---

## 🧪 테스트 환경

### 단위 테스트
```bash
# 웹 프로젝트 테스트
cd web && npm test

# 모바일 프로젝트 테스트
cd mobile && npm test
```

### E2E 테스트 (향후 확장)
```bash
# Detox 설치 (React Native)
npm install -g detox-cli

# Cypress 설치 (Web)
cd web && npm install --save-dev cypress
```

---

## 🔍 디버깅 도구

### React Native 디버깅
```bash
# Flipper 설치 (권장)
# https://fbflipper.com

# React Native Debugger
# https://github.com/jhen0409/react-native-debugger

# Chrome DevTools
# 앱에서 Cmd+D (iOS) / Cmd+M (Android) → Debug
```

### Next.js 디버깅
```bash
# React DevTools 브라우저 확장
# Chrome/Firefox에서 설치

# Next.js 개발자 도구
# 브라우저 F12 → React 탭
```

---

## 📊 성능 모니터링

### 개발 환경 모니터링
```bash
# Bundle 크기 분석 (Web)
cd web && npm run build
npx @next/bundle-analyzer

# Metro Bundle 분석 (Mobile)
cd mobile && npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android-bundle.js --analyze
```

### 메모리 사용량 체크
```bash
# Node.js 메모리 사용량
node --inspect app.js

# React Native 메모리 프로파일링
# Flipper → React DevTools → Profiler
```

---

## 🔧 IDE 설정

### Visual Studio Code (권장)
**필수 확장**:
- ES7+ React/Redux/React-Native snippets
- TypeScript Importer
- Prettier - Code formatter
- ESLint
- Tailwind CSS IntelliSense
- React Native Tools

**설정 파일** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

### Android Studio
**필수 플러그인**:
- Kotlin
- Flutter (선택사항)
- ADB Idea

### Xcode (macOS)
**유용한 설정**:
- Simulator → Device → iOS 15.0+
- Xcode → Preferences → Accounts (Apple ID 연결)

---

## 🚀 빌드 & 배포

### 웹 프로덕션 빌드
```bash
cd web
npm run build
npm run export  # 정적 파일 생성
```

### Android APK 빌드
```bash
cd mobile/android
./gradlew assembleRelease

# APK 위치: android/app/build/outputs/apk/release/
```

### iOS 빌드 (macOS)
```bash
cd mobile/ios
xcodebuild -workspace SubscriptionManager.xcworkspace -scheme SubscriptionManager -configuration Release archive
```

---

## 🔒 보안 체크리스트

### 개발 환경 보안
- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] API 키가 코드에 하드코딩되지 않았는지 확인
- [ ] Supabase RLS 정책이 올바르게 설정되었는지 확인
- [ ] Cloudinary Upload Preset이 Unsigned 모드인지 확인

### 프로덕션 배포 전 체크
- [ ] 모든 환경 변수가 프로덕션 값으로 설정되었는지 확인
- [ ] 디버그 모드가 비활성화되었는지 확인
- [ ] 불필요한 로그가 제거되었는지 확인
- [ ] 앱 서명이 올바르게 설정되었는지 확인

---

## 📚 추가 리소스

### 공식 문서
- [React Native 공식 문서](https://reactnative.dev/docs/getting-started)
- [Next.js 공식 문서](https://nextjs.org/docs)
- [Supabase 공식 문서](https://supabase.com/docs)
- [Cloudinary 공식 문서](https://cloudinary.com/documentation)

### 커뮤니티
- [React Native Community](https://github.com/react-native-community)
- [Supabase Discord](https://discord.supabase.com)
- [Next.js GitHub Discussions](https://github.com/vercel/next.js/discussions)

### 학습 자료
- [React Native 튜토리얼](https://reactnative.dev/docs/tutorial)
- [Supabase 튜토리얼](https://supabase.com/docs/guides/getting-started)
- [Tailwind CSS 가이드](https://tailwindcss.com/docs)

---

## 🐛 문제 해결

### 자주 발생하는 문제

#### Metro 서버 오류
```bash
# 캐시 클리어
cd mobile
npx react-native start --reset-cache
```

#### iOS 빌드 오류
```bash
# CocoaPods 재설치
cd mobile/ios
rm -rf Pods Podfile.lock
pod install
```

#### Android 빌드 오류
```bash
# Gradle 캐시 클리어
cd mobile/android
./gradlew clean
```

#### Next.js 빌드 오류
```bash
# 의존성 재설치
cd web
rm -rf node_modules package-lock.json
npm install
```

### 로그 확인
```bash
# React Native 로그
npx react-native log-android  # Android
npx react-native log-ios      # iOS

# Next.js 로그
# 브라우저 콘솔 및 터미널 출력 확인

# Supabase 로그
# Supabase Dashboard → Logs
```

---

이 개발 환경 가이드를 통해 프로젝트를 빠르게 설정하고 개발을 시작할 수 있습니다. 🚀