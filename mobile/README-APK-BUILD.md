# 📱 APK 빌드 및 배포 가이드

이 문서는 React Native Android 앱의 APK 빌드와 자동 배포 방법을 설명합니다.

## 🚀 빠른 시작

### 1. 빌드만 하기
```bash
# Debug APK 빌드
npm run build:debug

# Release APK 빌드
npm run build:release

# 모든 APK 빌드
npm run build:all
```

### 2. 빌드 + 자동 복사
```bash
# Debug APK 빌드 및 복사
npm run deploy:debug

# Release APK 빌드 및 복사
npm run deploy:release

# 모든 APK 빌드 및 복사
npm run deploy:all
```

### 3. 기존 APK만 복사
```bash
# 모든 APK 복사
npm run copy:apk

# Debug APK만 복사
npm run copy:debug

# Release APK만 복사
npm run copy:release
```

## 📁 파일 위치

### 로컬 빌드 결과
- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `android/app/build/outputs/apk/release/app-release.apk`

### 자동 복사 대상
- **SMB 경로**: `smb://192.168.1.188/e/docker_mount/code-server_mount/apk/`
- **로컬 마운트**: `/tmp/apk_mount/docker_mount/code-server_mount/apk/`

### 복사된 파일 명명 규칙
- **Debug APK**: `app-debug.apk` (고정)
- **Release APK**: `app-release.apk` (고정)

예시:
```
app-debug.apk    # Debug APK (항상 최신 버전으로 덮어쓰기)
app-release.apk  # Release APK (항상 최신 버전으로 덮어쓰기)
```

## 🛠️ 스크립트 상세

### 1. copy-apk.sh
APK 파일을 SMB 공유 폴더로 복사하는 스크립트

**사용법:**
```bash
./scripts/copy-apk.sh [debug|release|all]
```

**기능:**
- SMB 자동 마운트
- 고정된 파일명으로 복사 (`app-debug.apk`, `app-release.apk`)
- 기존 파일 덮어쓰기
- 파일 크기 표시
- 컬러 로그 출력

### 2. build-and-copy.sh
APK 빌드 후 자동으로 복사하는 통합 스크립트

**사용법:**
```bash
./scripts/build-and-copy.sh [debug|release|all]
```

**기능:**
- Gradle 빌드 실행
- 빌드 성공 시 자동 복사
- 오류 발생 시 중단
- 전체 프로세스 로그

## 📋 NPM 스크립트

| 명령어 | 설명 | 실행 내용 |
|--------|------|-----------|
| `npm run build:debug` | Debug APK 빌드 | `gradlew assembleDebug` |
| `npm run build:release` | Release APK 빌드 | `gradlew assembleRelease` |
| `npm run build:all` | 모든 APK 빌드 | `gradlew assembleDebug assembleRelease` |
| `npm run copy:apk` | 모든 APK 복사 | `copy-apk.sh all` |
| `npm run copy:debug` | Debug APK 복사 | `copy-apk.sh debug` |
| `npm run copy:release` | Release APK 복사 | `copy-apk.sh release` |
| `npm run deploy:debug` | Debug 빌드+복사 | `build-and-copy.sh debug` |
| `npm run deploy:release` | Release 빌드+복사 | `build-and-copy.sh release` |
| `npm run deploy:all` | 모든 빌드+복사 | `build-and-copy.sh all` |

## 🔧 설정 변경

### SMB 서버 정보 변경
`mobile/scripts/copy-apk.sh` 파일의 설정 부분을 수정:

```bash
# 설정
SMB_SERVER="192.168.1.188"    # SMB 서버 IP
SMB_SHARE="e"                 # 공유 폴더명
TARGET_DIR="$MOUNT_POINT/docker_mount/code-server_mount/apk"  # 대상 경로
```

### 파일명 패턴 변경
`copy_apk()` 함수에서 파일명 패턴 수정:

```bash
local target_file="$TARGET_DIR/${target_name}.apk"
```

## 📊 APK 정보

### 파일 크기
- **Debug APK**: ~45MB (디버그 정보 + JavaScript 번들 포함)
- **Release APK**: ~21MB (최적화됨 + JavaScript 번들 포함)

### 독립 실행 가능
- ✅ **Debug APK**: 외부 네트워크에서 독립 실행 가능
- ✅ **Release APK**: 외부 네트워크에서 독립 실행 가능
- ✅ **JavaScript 번들**: 두 APK 모두에 포함됨
- ✅ **Metro 서버 불필요**: 완전히 독립적으로 실행

### 빌드 시간
- **Debug**: ~11초 (JavaScript 번들 생성 포함)
- **Release**: ~9초 (최적화 및 압축 포함)

## 🚨 문제 해결

### SMB 마운트 실패
```bash
# 수동 마운트 시도
mkdir -p /tmp/apk_mount
mount -t smbfs //192.168.1.188/e /tmp/apk_mount
```

### 권한 오류
```bash
# 스크립트 실행 권한 부여
chmod +x scripts/*.sh
```

### 빌드 실패
```bash
# Gradle 캐시 정리
cd android && ./gradlew clean

# 의존성 재설치
npm install
```

## 🎯 사용 예시

### 개발 중 테스트
```bash
# Debug APK 빌드하고 테스트 서버에 배포
npm run deploy:debug
```

### 릴리즈 준비
```bash
# Release APK 빌드하고 배포 서버에 업로드
npm run deploy:release
```

### CI/CD 파이프라인
```bash
# 모든 APK 빌드 및 배포 (자동화)
npm run deploy:all
```

## 📝 로그 예시

```
[INFO] APK 빌드 및 복사 스크립트 시작
[INFO] 빌드 타입: release
[INFO] Release APK 빌드 시작...
[SUCCESS] Release APK 빌드 완료
[INFO] APK 파일 복사 시작...
[INFO] SMB 마운트 확인 중...
[INFO] SMB가 이미 마운트되어 있습니다.
[INFO] Release APK 복사 중...
[SUCCESS] Release APK 복사 완료: subscription-manager-release_20260106_101638.apk
[SUCCESS] Release APK latest 파일 업데이트: subscription-manager-release_latest.apk
[INFO] 파일 크기: 21M
[SUCCESS] 모든 작업이 완료되었습니다!
```

---

이제 Android Studio 없이도 Kiro IDE에서 완전한 APK 빌드와 배포 자동화가 가능합니다! 🎉