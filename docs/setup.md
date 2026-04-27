# ArtTomato 설정 가이드

## 1. 전제 조건

- Node.js 20 LTS (`.nvmrc` 기준)
- npm 10+
- Supabase CLI
- Vercel 계정(배포 시)

## 2. 환경 변수 준비

```bash
cp .env.example .env
cp web/.env.local.example web/.env.local
cp mobile/.env.example mobile/.env
```

필수 값:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL_NAME`

수집 파이프라인 실저장 시 추가:

- `SUPABASE_SERVICE_ROLE_KEY`

웹 선택 값(배포 전에는 localhost 권장):

- `NEXT_PUBLIC_SITE_URL` (예: `http://localhost:3000`)

검증:

```bash
npm run env:check
npm run supabase:key-check
npm run supabase:rls-check
npm run qa:smoke-web
```

## 3. 의존성 설치

```bash
npm run setup
```

## 4. Supabase 연결 및 스키마 반영

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

ArtTomato 기준 마이그레이션 파일:

- `supabase/migrations/20260402090000_arttomato_core_schema.sql`
- `supabase/migrations/20260402090500_arttomato_seed.sql`
- `supabase/migrations/20260402173000_arttomato_ingestion_raw_and_source_metadata.sql`
- `supabase/migrations/20260402173500_arttomato_source_sites_metadata_seed.sql`

## 5. 웹 실행

```bash
npm run dev:web
```

기본 URL: `http://localhost:3000`

## 6. 수집 파이프라인 점검

LLM 연결 테스트:

```bash
npm run llm:test
```

수집 드라이런:

```bash
npm run ingest:run -- --site=mmca --dry-run
```

## 7. 관리자 권한 설정(수동)

자동 스크립트(권장):

```bash
npm run supabase:grant-admin -- --email=you@example.com
```

또는 아래 SQL로 직접 승격:

1. 로그인해서 `profiles` 행 생성
2. Supabase SQL Editor에서 관리자 승격:

```sql
update public.profiles
set role = 'admin'
where id = 'YOUR_AUTH_USER_UUID';
```

## 8. 배포

배포/운영 절차는 [`배포_운영_런북.md`](/Users/shin/workspace/ArtTomato/docs/배포_운영_런북.md) 참고.
