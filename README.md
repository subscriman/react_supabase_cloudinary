# ArtTomato

ArtTomato는 "현재 진행 중이거나 곧 열릴 전시"를 빠르게 찾고, 실제 관람객 리뷰를 남기고 확인하는 웹 중심 서비스입니다.

## 현재 범위 (웹 MVP)

- 전시 목록/검색/필터/정렬
- 전시 상세 + 리뷰 작성/수정/삭제
- 이메일/소셜 로그인(Supabase Auth)
- 관리자 검수 페이지
  - 승인/반려/보류
  - 전시 정보 수정
  - 태그 수동 보정
  - 중복 의심 전시 처리(대표 유지 + 숨김)
  - 수집 이력/실패 로그 확인

## 기술 스택

- Web: Next.js (Pages Router), TypeScript, Tailwind CSS
- Backend: Supabase (PostgreSQL, Auth, Storage)
- Deployment: Vercel
- LLM 정제(수집 파이프라인 예정): OpenAI 호환 API (`qwen-plus` 기본)

## 프로젝트 구조

```text
ArtTomato/
├── docs/
├── shared/
├── supabase/
├── web/
└── mobile/   # 2차 단계(예정)
```

## 빠른 시작

### 1) 환경 변수

```bash
cp .env.example .env
cp web/.env.local.example web/.env.local
cp mobile/.env.example mobile/.env
```

필수 키(웹 MVP 기준):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL_NAME`

### 2) 의존성 설치

```bash
npm run setup
```

### 3) 환경 변수 점검

```bash
npm run env:check
```

선택 점검:

```bash
npm run supabase:auth-check
npm run supabase:admin-check
npm run supabase:users
```

### 4) 마이그레이션 적용 (Supabase CLI)

```bash
supabase db push
```

### 5) 웹 실행

```bash
npm run dev:web
```

### 6) LLM 연결 테스트 (선택)

```bash
npm run llm:test
```

### 7) 수집 파이프라인 실행

```bash
npm run ingest:run -- --site=mmca --dry-run
```

### 8) 웹 스모크 QA

```bash
npm run qa:smoke-web
```

점검 범위:

- 홈(PC/모바일 UA), 검색/필터, 전시 상세 진입
- auth/mypage/약관/개인정보처리방침/robots/sitemap 응답
- 리뷰/관리자 API 비로그인 차단 응답(401/405)
- 홈 응답 시간 budget 검사(`QA_HOME_BUDGET_MS`, 기본 6000ms)

## 주요 문서

- 서비스 개요: [`docs/예술작품 정보 공유 리뷰 서비스 개요.md`](docs/예술작품%20정보%20공유%20리뷰%20서비스%20개요.md)
- 개발 체크리스트: [`docs/개발_계획_체크리스트.md`](docs/개발_계획_체크리스트.md)
- QA 수동 체크 가이드: [`docs/QA_수동_체크_가이드.md`](docs/QA_수동_체크_가이드.md)
- 스택 요약: [`docs/arttomato_stack.md`](docs/arttomato_stack.md)
- 설정 가이드: [`docs/setup.md`](docs/setup.md)
- 배포/운영 런북: [`docs/배포_운영_런북.md`](docs/배포_운영_런북.md)
- 수집 파이프라인 MVP: [`docs/수집_파이프라인_MVP.md`](docs/수집_파이프라인_MVP.md)
- 초기 수집 사이트 메모: [`docs/초기_수집_사이트_메모.md`](docs/초기_수집_사이트_메모.md)
- 서비스 기본 문구: [`docs/서비스_기본_문구.md`](docs/서비스_기본_문구.md)
- 개인정보처리방침 초안: [`docs/개인정보처리방침_초안.md`](docs/개인정보처리방침_초안.md)
- 이용약관 초안: [`docs/이용약관_초안.md`](docs/이용약관_초안.md)

## 주의 사항

- `.env`, `web/.env.local`, `mobile/.env`는 절대 커밋하지 않습니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버/배치 전용이며 클라이언트로 노출하면 안 됩니다.
- 현재 저장소에는 과거 실험 코드(Cloudinary, 구독관리 앱 흔적)가 일부 남아 있습니다. 운영 배포는 ArtTomato 웹 경로(`web/`) 기준으로 진행하세요.
