# ArtTomato 기술 스택 (웹 MVP 기준)

## 1. 기본 스택

| 분류 | 선택 기술 | 비고 |
| --- | --- | --- |
| 프론트엔드(웹) | Next.js + TypeScript | **Pages Router 유지** (1차 MVP) |
| 백엔드/API | Supabase | DB/Auth/Storage 통합 |
| 데이터베이스 | PostgreSQL (Supabase) | 전시/리뷰/관리자 검수 |
| 인증 | Supabase Auth | 이메일 + 소셜(구글/카카오/네이버) |
| 배포 | Vercel | Preview/Production 분리 |
| 모바일(2차) | React Native(Expo) | 웹 서비스 안정화 이후 |
| 푸시 알림(2차) | Expo Notifications + 배치 워커 | `docs/푸시_알림_설계.md` 기준 |
| AI 정제 | OpenAI 호환 LLM API | `.env`: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL_NAME` |

## 2. 구조 결정 사항

- 웹 라우팅: Pages Router를 유지한다.
- 데이터 로직: `web/lib` + `shared` 타입으로 웹/앱 재사용성을 확보한다.
- 전시 식별자: 내부 `id`, 외부 노출 `slug`를 병행한다.
- 수집 데이터 공개: 자동 게시 금지, 관리자 승인 후 공개.

## 3. 이미지 저장 전략 (통일)

- **공식 전략: Supabase Storage**
- Cloudinary 경로는 레거시 호환을 위해 코드에 남아 있으나, 신규 기능은 Storage 기준으로 구현한다.
- 업로드 전 프론트 압축(WebP/적정 해상도)을 적용해 비용을 줄인다.
- 버킷/경로/파일명 규칙은 [이미지_저장_경로_정책.md](/Users/shin/workspace/ArtTomato/docs/이미지_저장_경로_정책.md) 기준으로 통일한다.

## 4. 비용 최소화 원칙

- MVP 단계에서 별도 백엔드 서버 없이 Supabase + Next.js 조합 유지
- 검색은 PostgreSQL 기반(ILIKE/FTS)으로 시작
- 운영 자동화는 1일 1회 수집 + 관리자 검수 중심

## 5. 2차 앱 확장 원칙

- API 응답 구조와 에러 코드 체계를 웹/앱 공통 규격으로 유지
- 날짜 저장은 UTC 기준, 화면 노출은 로컬 타임존 변환
- 인증 리다이렉트 정책은 웹/앱 겸용으로 설계
- 인증 redirect 세부 규칙은 [인증_리다이렉트_정책.md](/Users/shin/workspace/ArtTomato/docs/인증_리다이렉트_정책.md) 기준으로 관리
