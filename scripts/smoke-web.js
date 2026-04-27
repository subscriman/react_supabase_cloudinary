#!/usr/bin/env node
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const DEFAULT_SITE_URL = 'https://arttomato-web.vercel.app';
const SITE_URL = String(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
const DESKTOP_USER_AGENT =
  process.env.QA_DESKTOP_UA ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MOBILE_USER_AGENT =
  process.env.QA_MOBILE_UA ||
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const PERFORMANCE_BUDGET_MS = Number(process.env.QA_HOME_BUDGET_MS || 6000);
const DEFAULT_TIMEOUT_MS = Number(process.env.QA_FETCH_TIMEOUT_MS || 15000);

function buildUrl(path) {
  return `${SITE_URL}${path}`;
}

async function fetchText(path, options = {}) {
  const url = buildUrl(path);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const headers = {
    'user-agent': options.userAgent || DESKTOP_USER_AGENT,
    ...(options.headers || {}),
  };

  if (options.body && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
    headers['content-type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      redirect: 'follow',
      headers,
      body: options.body,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      url,
      status: response.status,
      text,
      durationMs: Date.now() - startedAt,
      responseHeaders: Object.fromEntries(response.headers.entries()),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(path, options = {}) {
  const result = await fetchText(path, options);
  let json = null;
  try {
    json = JSON.parse(result.text);
  } catch (error) {
    throw new Error(`JSON 파싱 실패 (${path}): ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    ...result,
    json,
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function addCheck(checks, payload) {
  checks.push(payload);
}

function assertStatus(result, expectedStatus, name) {
  assert(result.status === expectedStatus, `${name} 응답 실패: ${result.status}`);
}

function assertIncludes(text, pattern, message) {
  if (typeof pattern === 'string') {
    assert(text.includes(pattern), message);
    return;
  }
  assert(pattern.test(text), message);
}

function extractFirstExhibitionSlug(html) {
  const match = html.match(/href=['"]\/exhibitions\/([^'"?#/]+)\/?['"]/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch (_error) {
    return match[1];
  }
}

async function run() {
  const checks = [];
  const warnings = [];

  const homeDesktop = await fetchText('/', { userAgent: DESKTOP_USER_AGENT });
  assertStatus(homeDesktop, 200, '홈(PC)');
  assertIncludes(homeDesktop.text, /<title>.*ArtTomato/i, '홈(PC) title 검사 실패');
  assert(
    homeDesktop.durationMs <= PERFORMANCE_BUDGET_MS,
    `홈(PC) 응답 시간 초과: ${homeDesktop.durationMs}ms (기준 ${PERFORMANCE_BUDGET_MS}ms)`,
  );
  addCheck(checks, {
    name: 'home-desktop',
    path: '/',
    status: homeDesktop.status,
    durationMs: homeDesktop.durationMs,
    ok: true,
  });

  const homeMobile = await fetchText('/', { userAgent: MOBILE_USER_AGENT });
  assertStatus(homeMobile, 200, '홈(모바일)');
  assertIncludes(homeMobile.text, /<title>.*ArtTomato/i, '홈(모바일) title 검사 실패');
  addCheck(checks, {
    name: 'home-mobile',
    path: '/',
    status: homeMobile.status,
    durationMs: homeMobile.durationMs,
    ok: true,
  });

  const auth = await fetchText('/auth/');
  assertStatus(auth, 200, '로그인 페이지');
  assertIncludes(auth.text, /<title>로그인 \| ArtTomato/i, '로그인 페이지 title 검사 실패');
  assert(
    auth.text.includes('세션 확인 중...') || auth.text.includes('이메일 로그인'),
    '로그인 페이지 기본 렌더링 검사 실패',
  );
  addCheck(checks, { name: 'auth-page', path: '/auth/', status: auth.status, durationMs: auth.durationMs, ok: true });

  const mypage = await fetchText('/mypage/');
  assertStatus(mypage, 200, '마이페이지');
  assertIncludes(mypage.text, /<title>마이페이지 \| ArtTomato/i, '마이페이지 title 검사 실패');
  addCheck(checks, {
    name: 'mypage',
    path: '/mypage/',
    status: mypage.status,
    durationMs: mypage.durationMs,
    ok: true,
  });

  const filtered = await fetchText('/?q=%EC%84%9C%EC%9A%B8&status=ongoing&sort=ending');
  assertStatus(filtered, 200, '검색/필터');
  assertIncludes(filtered.text, '검색 결과', '검색/필터 결과 텍스트 누락');
  assertIncludes(filtered.text, '필터 초기화', '검색/필터 상태 유지 검사 실패');
  addCheck(checks, {
    name: 'search-filter',
    path: '/?q=서울&status=ongoing&sort=ending',
    status: filtered.status,
    durationMs: filtered.durationMs,
    ok: true,
  });

  const firstSlug = extractFirstExhibitionSlug(homeDesktop.text);
  if (firstSlug) {
    const detailPath = `/exhibitions/${encodeURIComponent(firstSlug)}`;
    const detail = await fetchText(detailPath);
    assertStatus(detail, 200, '전시 상세');
    assertIncludes(detail.text, '전시 소개', '전시 상세 본문 검사 실패');
    addCheck(checks, {
      name: 'exhibition-detail',
      path: detailPath,
      status: detail.status,
      durationMs: detail.durationMs,
      ok: true,
    });
  } else {
    assertIncludes(homeDesktop.text, '조건에 맞는 전시가 없습니다.', '홈 빈 상태 UI 검사 실패');
    addCheck(checks, {
      name: 'home-empty-state',
      path: '/',
      status: homeDesktop.status,
      durationMs: homeDesktop.durationMs,
      ok: true,
    });
    warnings.push('홈 화면이 빈 상태라 상세 페이지 점검은 건너뛰었습니다.');
  }

  const privacy = await fetchText('/privacy/');
  assertStatus(privacy, 200, '개인정보처리방침');
  addCheck(checks, {
    name: 'privacy',
    path: '/privacy/',
    status: privacy.status,
    durationMs: privacy.durationMs,
    ok: true,
  });

  const terms = await fetchText('/terms/');
  assertStatus(terms, 200, '이용약관');
  addCheck(checks, { name: 'terms', path: '/terms/', status: terms.status, durationMs: terms.durationMs, ok: true });

  const robots = await fetchText('/robots.txt');
  assertStatus(robots, 200, 'robots.txt');
  assertIncludes(robots.text, /sitemap:/i, 'robots.txt sitemap 항목 누락');
  addCheck(checks, {
    name: 'robots',
    path: '/robots.txt',
    status: robots.status,
    durationMs: robots.durationMs,
    ok: true,
  });

  const sitemap = await fetchText('/sitemap.xml');
  assertStatus(sitemap, 200, 'sitemap.xml');
  assertIncludes(sitemap.text, /<urlset/i, 'sitemap.xml 포맷 검사 실패(urlset 누락)');
  assertIncludes(sitemap.text, SITE_URL, 'sitemap.xml 도메인 검사 실패');
  addCheck(checks, {
    name: 'sitemap',
    path: '/sitemap.xml',
    status: sitemap.status,
    durationMs: sitemap.durationMs,
    ok: true,
  });

  const authProviders = await fetchText('/api/auth/providers');
  const authContentType = String(authProviders.responseHeaders?.['content-type'] || '').toLowerCase();
  if (authProviders.status === 200 && authContentType.includes('application/json')) {
    let parsedAuthProviders = null;
    try {
      parsedAuthProviders = JSON.parse(authProviders.text);
    } catch (error) {
      throw new Error(
        `Auth 공급자 API JSON 파싱 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const providerItems = parsedAuthProviders?.data?.providers;
    assert(Array.isArray(providerItems), 'Auth 공급자 API providers 배열 누락');
    const providerIds = new Set(providerItems.map((item) => item.id));
    assert(providerIds.has('google'), 'Auth 공급자 API google 항목 누락');
    assert(providerIds.has('kakao'), 'Auth 공급자 API kakao 항목 누락');
    assert(providerIds.has('naver'), 'Auth 공급자 API naver 항목 누락');
    addCheck(checks, {
      name: 'api-auth-providers',
      path: '/api/auth/providers',
      status: authProviders.status,
      durationMs: authProviders.durationMs,
      ok: true,
    });
  } else {
    warnings.push(
      `Auth 공급자 API 점검 스킵: status=${authProviders.status}, content-type=${authContentType || 'unknown'}`,
    );
    addCheck(checks, {
      name: 'api-auth-providers',
      path: '/api/auth/providers',
      status: authProviders.status,
      durationMs: authProviders.durationMs,
      ok: true,
      skipped: true,
    });
  }

  const createReviewUnauthorized = await fetchJson('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assertStatus(createReviewUnauthorized, 401, '리뷰 생성 API(비로그인)');
  assert(
    createReviewUnauthorized.json?.errorCode === 'UNAUTHORIZED',
    '리뷰 생성 API(비로그인) 에러코드 검사 실패',
  );
  addCheck(checks, {
    name: 'api-review-create-unauthorized',
    path: '/api/reviews',
    status: createReviewUnauthorized.status,
    durationMs: createReviewUnauthorized.durationMs,
    ok: true,
  });

  const updateReviewUnauthorized = await fetchJson('/api/reviews/qa-smoke-id', {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
  assertStatus(updateReviewUnauthorized, 401, '리뷰 수정 API(비로그인)');
  assert(
    updateReviewUnauthorized.json?.errorCode === 'UNAUTHORIZED',
    '리뷰 수정 API(비로그인) 에러코드 검사 실패',
  );
  addCheck(checks, {
    name: 'api-review-update-unauthorized',
    path: '/api/reviews/qa-smoke-id',
    status: updateReviewUnauthorized.status,
    durationMs: updateReviewUnauthorized.durationMs,
    ok: true,
  });

  const reviewMethodNotAllowed = await fetchJson('/api/reviews', { method: 'GET' });
  assertStatus(reviewMethodNotAllowed, 405, '리뷰 API 메서드 제한');
  assert(
    reviewMethodNotAllowed.json?.errorCode === 'METHOD_NOT_ALLOWED',
    '리뷰 API 메서드 제한 에러코드 검사 실패',
  );
  addCheck(checks, {
    name: 'api-review-method-not-allowed',
    path: '/api/reviews (GET)',
    status: reviewMethodNotAllowed.status,
    durationMs: reviewMethodNotAllowed.durationMs,
    ok: true,
  });

  const createFavoriteUnauthorized = await fetchJson('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ exhibitionId: 'qa-smoke-id' }),
  });
  assertStatus(createFavoriteUnauthorized, 401, '찜 생성 API(비로그인)');
  assert(
    createFavoriteUnauthorized.json?.errorCode === 'UNAUTHORIZED',
    '찜 생성 API(비로그인) 에러코드 검사 실패',
  );
  addCheck(checks, {
    name: 'api-favorite-create-unauthorized',
    path: '/api/favorites',
    status: createFavoriteUnauthorized.status,
    durationMs: createFavoriteUnauthorized.durationMs,
    ok: true,
  });

  const deleteFavoriteUnauthorized = await fetchJson('/api/favorites/qa-smoke-id', {
    method: 'DELETE',
  });
  assertStatus(deleteFavoriteUnauthorized, 401, '찜 삭제 API(비로그인)');
  assert(
    deleteFavoriteUnauthorized.json?.errorCode === 'UNAUTHORIZED',
    '찜 삭제 API(비로그인) 에러코드 검사 실패',
  );
  addCheck(checks, {
    name: 'api-favorite-delete-unauthorized',
    path: '/api/favorites/qa-smoke-id',
    status: deleteFavoriteUnauthorized.status,
    durationMs: deleteFavoriteUnauthorized.durationMs,
    ok: true,
  });

  const createStartAlertUnauthorized = await fetchJson('/api/start-alerts', {
    method: 'POST',
    body: JSON.stringify({ exhibitionId: 'qa-smoke-id', notifyDaysBefore: 1 }),
  });
  assertStatus(createStartAlertUnauthorized, 401, '시작 알림 생성 API(비로그인)');
  assert(
    createStartAlertUnauthorized.json?.errorCode === 'UNAUTHORIZED',
    '시작 알림 생성 API(비로그인) 에러코드 검사 실패',
  );
  addCheck(checks, {
    name: 'api-start-alert-create-unauthorized',
    path: '/api/start-alerts',
    status: createStartAlertUnauthorized.status,
    durationMs: createStartAlertUnauthorized.durationMs,
    ok: true,
  });

  const deleteStartAlertUnauthorized = await fetchJson('/api/start-alerts/qa-smoke-id', {
    method: 'DELETE',
  });
  assertStatus(deleteStartAlertUnauthorized, 401, '시작 알림 삭제 API(비로그인)');
  assert(
    deleteStartAlertUnauthorized.json?.errorCode === 'UNAUTHORIZED',
    '시작 알림 삭제 API(비로그인) 에러코드 검사 실패',
  );
  addCheck(checks, {
    name: 'api-start-alert-delete-unauthorized',
    path: '/api/start-alerts/qa-smoke-id',
    status: deleteStartAlertUnauthorized.status,
    durationMs: deleteStartAlertUnauthorized.durationMs,
    ok: true,
  });

  const adminModerateUnauthorized = await fetchJson('/api/admin/exhibitions/qa-smoke-id/moderate', {
    method: 'POST',
    body: JSON.stringify({ action: 'approve' }),
  });
  assertStatus(adminModerateUnauthorized, 401, '관리자 승인 API(비로그인)');
  assert(
    adminModerateUnauthorized.json?.errorCode === 'UNAUTHORIZED',
    '관리자 승인 API(비로그인) 에러코드 검사 실패',
  );
  addCheck(checks, {
    name: 'api-admin-moderate-unauthorized',
    path: '/api/admin/exhibitions/qa-smoke-id/moderate',
    status: adminModerateUnauthorized.status,
    durationMs: adminModerateUnauthorized.durationMs,
    ok: true,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        siteUrl: SITE_URL,
        performanceBudgetMs: PERFORMANCE_BUDGET_MS,
        checks,
        warnings,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Web smoke check failed: ${message}`);
  process.exit(1);
});
