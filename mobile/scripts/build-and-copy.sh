#!/bin/bash

# APK 빌드 및 자동 복사 스크립트
# 사용법: ./scripts/build-and-copy.sh [debug|release|all]

set -e

# 설정
SCRIPT_DIR="$(dirname "$0")"
ANDROID_DIR="$SCRIPT_DIR/../android"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 빌드 함수
build_apk() {
    local build_type="$1"
    
    log_info "$build_type APK 빌드 시작..."
    
    cd "$ANDROID_DIR"
    
    case "$build_type" in
        "debug")
            if ./gradlew assembleDebug; then
                log_success "Debug APK 빌드 완료"
                return 0
            else
                log_error "Debug APK 빌드 실패"
                return 1
            fi
            ;;
        "release")
            if ./gradlew assembleRelease; then
                log_success "Release APK 빌드 완료"
                return 0
            else
                log_error "Release APK 빌드 실패"
                return 1
            fi
            ;;
        "all")
            if ./gradlew assembleDebug assembleRelease; then
                log_success "모든 APK 빌드 완료"
                return 0
            else
                log_error "APK 빌드 실패"
                return 1
            fi
            ;;
        *)
            log_error "잘못된 빌드 타입: $build_type"
            return 1
            ;;
    esac
}

# 메인 함수
main() {
    local build_type="${1:-all}"
    
    log_info "APK 빌드 및 복사 스크립트 시작"
    log_info "빌드 타입: $build_type"
    
    # 빌드 실행
    if ! build_apk "$build_type"; then
        log_error "빌드에 실패했습니다. 스크립트를 종료합니다."
        exit 1
    fi
    
    # 복사 실행
    log_info "APK 파일 복사 시작..."
    if "$SCRIPT_DIR/copy-apk.sh" "$build_type"; then
        log_success "모든 작업이 완료되었습니다!"
    else
        log_error "APK 복사에 실패했습니다."
        exit 1
    fi
}

# 도움말 표시
show_help() {
    echo "APK 빌드 및 자동 복사 스크립트"
    echo ""
    echo "사용법:"
    echo "  $0 [debug|release|all]"
    echo ""
    echo "옵션:"
    echo "  debug   - Debug APK만 빌드 및 복사"
    echo "  release - Release APK만 빌드 및 복사"
    echo "  all     - Debug와 Release APK 모두 빌드 및 복사 (기본값)"
    echo ""
    echo "예시:"
    echo "  $0 debug    # Debug APK만 빌드"
    echo "  $0 release  # Release APK만 빌드"
    echo "  $0          # 모든 APK 빌드"
}

# 인자 처리
case "$1" in
    "-h"|"--help"|"help")
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac