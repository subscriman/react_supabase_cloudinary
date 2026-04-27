# 수집 파이프라인 MVP

## 개요

`scripts/ingestion/run.js`는 `source_sites`를 읽어 전시 목록을 수집하고,  
LLM 정제 + LLM 검수 + 검증 + 중복 탐지를 거쳐 `pending_review` 상태로 저장한다.

핵심 동작:

1. 사이트 목록 HTML 수집
2. JSON-LD + 링크 기반 원문 추출
3. LLM 정제 (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL_NAME`)
4. LLM 검수(품질 판정: `accept/reject/needs_human`)
5. 스키마 검증
6. 중복 탐지(원본 ID + 전시명/장소/기간)
7. 전시/태그 저장 및 `ingestion_jobs`, `ingestion_raw_items` 기록

## 실행 커맨드

전체(실제 저장):

```bash
npm run ingest:run
```

Supabase 키 유효성 확인:

```bash
npm run supabase:key-check
```

특정 사이트만:

```bash
npm run ingest:run -- --site=mmca,sac
```

드라이런(쓰기 없이 검증):

```bash
npm run ingest:run -- --site=mmca --dry-run
```

추출 개수 제한:

```bash
npm run ingest:run -- --site=mmca --limit=20
```

대구미술관 외부환경 전용 점검:

```bash
npm run ingest:daegu:audit
npm run ingest:daegu:dry-run
npm run ingest:daegu:audit:edge
npm run ingest:daegu:dry-run:edge
```

## LLM 연결 테스트

```bash
npm run llm:test
```

## 주의 사항

- 실저장은 `SUPABASE_SERVICE_ROLE_KEY`가 필요하다.
- `--dry-run`은 DB 쓰기를 하지 않는다.
- `--dry-run`은 기본적으로 샘플 fallback을 사용하지 않는다.
  - 강제 샘플 fallback: `INGESTION_DRYRUN_SAMPLE_FALLBACK=true`
- 원문/검증 결과는 `ingestion_raw_items`에 남겨 관리자 검수 및 재현이 가능하다.
- LLM 검수 결과는 `ingestion_raw_items.raw_payload.aiReview` 및 `normalized_payload._ai_review`에 기록된다.
- 기본값은 안전모드다.
  - `INGESTION_AI_REVIEW_ENABLED=true` (기본)
  - `INGESTION_AI_AUTO_REJECT=false` (기본, AI 반려 제안도 수동검수로 전환)
  - `INGESTION_AI_AUTO_APPROVE=false` (기본, 자동 공개 비활성)
- 자동 공개를 켜려면:
  - `INGESTION_AI_AUTO_APPROVE=true`
  - `INGESTION_AI_AUTO_APPROVE_MIN_CONFIDENCE` (기본 `0.9`)
- 기본 운영 11개 사이트(`mmca`, `sac`, `sema`, `museum`, `ddp`, `leeum`, `busan-art`, `sejong`, `apma`, `warmemo`, `kukje`)는 전용 어댑터로 우선 처리한다.
- `daegu-art`(대구미술관)는 옵션 사이트다. 포함하려면 `INGESTION_ENABLE_DAEGU_ART=true`를 설정한다.
- daegu 접속이 불안정하면 `INGESTION_DAEGU_USE_EDGE_FETCH=true`로 Supabase Edge Function 경유 fetch를 사용한다.
- 2026-04-03 기준 daegu 전용 파서 진단 결과: raw 4건, valid 100%(리포트: `docs/수집_사이트_진단_리포트_daegu.md`).
- 실제 실행 시 `source_sites`의 활성/우선순위는 따르되, 목록 URL은 코드의 `site-config` 최신 값을 우선 사용한다(구 DB URL 드리프트 방지).

## 운영 스케줄(초안)

- 기본 주기: 매일 06:00 KST 1회 실행
- 장애 시 재시도: 30분 간격 최대 2회
- 스케줄 실행은 Vercel Cron 또는 외부 워커(CI Scheduler)에서 `npm run ingest:run` 호출

## 비용/호출 제한 규칙(초안)

- 사이트당 수집 항목 상한: 기본 120건
- LLM 호출 상한: 실행당 500회
- 상세 페이지 fetch timeout: 15초
- LLM timeout(권장): 20초
- 실패 응답/파싱 에러는 `ingestion_raw_items.validation_errors`에 저장 후 다음 항목 계속 처리
