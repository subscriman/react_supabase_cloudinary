# Timber 로깅 가이드

## 개요
이 앱은 외부에서 컴퓨터 연결 없이 로그를 확인할 수 있도록 Timber 로깅 시스템을 구현했습니다.

## 로깅 시스템 구성

### 1. 이중 로깅 시스템
- **react-native-logs**: 앱 내부 파일 저장 (`Documents/subscri/` 폴더)
- **Timber**: Android logcat 출력 (외부에서 확인 가능)

### 2. 로그 태그
- `SubscriManager`: 일반 앱 로그
- `Subscription`: 구독 관련 액션
- `Preset`: 프리셋 관련 액션
- `Notification`: 알림 관련 액션
- `API`: API 호출 로그
- `AppLifecycle`: 앱 생명주기 이벤트
- `UserAction`: 사용자 액션 추적

## 외부에서 로그 확인 방법

### 방법 1: Android Studio Logcat
1. Android Studio 실행
2. `View > Tool Windows > Logcat` 선택
3. 디바이스 연결 후 앱 실행
4. 필터에 `SubscriManager` 입력하여 앱 로그만 확인

### 방법 2: ADB 명령어 (컴퓨터 필요)
```bash
# 모든 로그 확인
adb logcat | grep SubscriManager

# 특정 태그만 확인
adb logcat | grep "Subscription:"
adb logcat | grep "UserAction:"

# 실시간 로그 모니터링
adb logcat -s SubscriManager
```

### 방법 3: 디바이스 내장 로그 뷰어 앱 (추천)
1. **Logcat Reader** 앱 설치 (Google Play Store)
2. 앱 실행 후 `SubscriManager` 태그로 필터링
3. 실시간으로 로그 확인 가능

### 방법 4: 개발자 옵션 활용
1. 설정 > 개발자 옵션 > 버그 신고 활성화
2. 문제 발생 시 버그 리포트 생성
3. 로그 파일에서 `SubscriManager` 검색

## 로그 레벨별 용도

### Debug (파란색)
- 개발 중 디버깅 정보
- 상세한 실행 흐름

### Info (초록색)
- 일반적인 앱 동작 정보
- 사용자 액션 추적
- API 호출 성공

### Warning (노란색)
- 경고 상황
- 복구 가능한 오류

### Error (빨간색)
- 오류 상황
- API 호출 실패
- 예외 발생

## 주요 로그 예시

### 앱 시작
```
I/SubscriManager: [2026-01-06T12:30:15.123Z] HomeScreen 마운트됨
I/HomeScreen: HomeScreen_Mount
```

### 사용자 액션
```
I/UserAction: 프리셋 선택 on HomeScreen | {"presetName":"T우주 프리셋"}
I/UserAction: 직접 등록 버튼 클릭 on HomeScreen
```

### API 호출
```
I/API: GET /api/presets - Status: 200
E/API: POST /api/subscriptions - Error: {"message":"Network error"}
```

### 구독 관련
```
I/Subscription: 구독 생성 - Netflix | {"price":15000,"cycle":"monthly"}
I/Subscription: 구독 삭제 - Spotify | {"reason":"user_request"}
```

## 문제 해결

### 로그가 보이지 않는 경우
1. 앱이 실제로 실행되고 있는지 확인
2. 로그 뷰어 앱의 필터 설정 확인
3. 디바이스의 로그 권한 확인

### 로그가 너무 많은 경우
1. 특정 태그로 필터링 (`SubscriManager`, `UserAction` 등)
2. 로그 레벨 필터 사용 (Error만 보기 등)
3. 시간 범위 제한

## 개발자를 위한 추가 정보

### 새로운 로그 추가 방법
```typescript
import { Logger } from '../services/loggerService';
import { Timber } from '../services/timberService';

// 일반 로그
Logger.info('새로운 기능 실행');
Timber.info('MyTag', '새로운 기능 실행');

// 사용자 액션 로그
Logger.logUserAction('버튼 클릭', 'MyScreen', { buttonId: 'submit' });
Timber.logUserAction('버튼 클릭', 'MyScreen', { buttonId: 'submit' });
```

### 로그 성능 고려사항
- Release 빌드에서도 Timber 로그가 출력됩니다
- 과도한 로깅은 성능에 영향을 줄 수 있습니다
- 민감한 정보는 로그에 포함하지 마세요

## 버전 정보
- Timber: 5.0.1
- react-native-logs: 5.0.1
- 구현 날짜: 2026-01-06