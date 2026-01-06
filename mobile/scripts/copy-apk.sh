#!/bin/bash

# APK 자동 복사 스크립트
# 사용법: ./scripts/copy-apk.sh [debug|release|all]

set -e

# 설정
SMB_SERVER="192.168.1.188"
SMB_SHARE="e"
MOUNT_POINT="/tmp/apk_mount"
TARGET_DIR="$MOUNT_POINT/docker_mount/code-server_mount/apk"
ANDROID_DIR="$(dirname "$0")/../android"

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

# SMB 마운트 함수
mount_smb() {
    log_info "SMB 마운트 확인 중..."
    
    # 마운트 포인트 생성
    mkdir -p "$MOUNT_POINT"
    
    # 이미 마운트되어 있는지 확인
    if mount | grep -q "$MOUNT_POINT"; then
        log_info "SMB가 이미 마운트되어 있습니다."
        return 0
    fi
    
    # SMB 마운트 시도
    log_info "SMB 마운트 중: //$SMB_SERVER/$SMB_SHARE"
    if mount -t smbfs "//$SMB_SERVER/$SMB_SHARE" "$MOUNT_POINT" 2>/dev/null; then
        log_success "SMB 마운트 성공"
        return 0
    else
        log_error "SMB 마운트 실패"
        return 1
    fi
}

# APK 복사 함수
copy_apk() {
    local apk_type="$1"
    local apk_file="$2"
    local target_name="$3"
    
    if [ ! -f "$apk_file" ]; then
        log_error "$apk_type APK 파일을 찾을 수 없습니다: $apk_file"
        return 1
    fi
    
    # 고정된 파일명으로 복사
    local target_file="$TARGET_DIR/${target_name}.apk"
    
    log_info "$apk_type APK 복사 중..."
    
    # 고정된 파일명으로 복사 (덮어쓰기)
    if cp "$apk_file" "$target_file"; then
        log_success "$apk_type APK 복사 완료: $(basename "$target_file")"
        
        # 파일 크기 표시
        local file_size=$(ls -lh "$apk_file" | awk '{print $5}')
        log_info "파일 크기: $file_size"
        
        return 0
    else
        log_error "$apk_type APK 복사 실패"
        return 1
    fi
}

# 메인 함수
main() {
    local build_type="${1:-all}"
    
    log_info "APK 자동 복사 스크립트 시작"
    log_info "빌드 타입: $build_type"
    
    # SMB 마운트
    if ! mount_smb; then
        log_error "SMB 마운트에 실패했습니다. 스크립트를 종료합니다."
        exit 1
    fi
    
    # 대상 디렉토리 확인 및 생성
    if [ ! -d "$TARGET_DIR" ]; then
        log_warning "대상 디렉토리가 존재하지 않습니다. 생성 중..."
        mkdir -p "$TARGET_DIR"
    fi
    
    # APK 파일 경로
    local debug_apk="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
    local release_apk="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
    
    # 빌드 타입에 따른 복사
    case "$build_type" in
        "debug")
            copy_apk "Debug" "$debug_apk" "app-debug"
            ;;
        "release")
            copy_apk "Release" "$release_apk" "app-release"
            ;;
        "all")
            copy_apk "Debug" "$debug_apk" "app-debug"
            copy_apk "Release" "$release_apk" "app-release"
            ;;
        *)
            log_error "잘못된 빌드 타입: $build_type"
            log_info "사용법: $0 [debug|release|all]"
            exit 1
            ;;
    esac
    
    log_success "APK 복사 작업 완료!"
    log_info "복사된 위치: $TARGET_DIR"
    
    # 복사된 파일 목록 표시
    log_info "복사된 파일들:"
    ls -lh "$TARGET_DIR"/*.apk 2>/dev/null | while read line; do
        echo "  $line"
    done
}

# 스크립트 실행
main "$@"