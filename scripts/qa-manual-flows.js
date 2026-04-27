#!/usr/bin/env node
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { createIngestionJob, finishIngestionJob } = require('./ingestion/db');
const { enrichWithDetailContext } = require('./ingestion/detail-fetch');
const { main: runIngestionMain } = require('./ingestion/run');

dotenv.config({ path: '.env' });

const DEFAULT_SITE_URL = 'https://arttomato-web.vercel.app';
const DEFAULT_QA_EMAIL = 'arttomatokr@gmail.com';
const SITE_URL = String(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
const FETCH_TIMEOUT_MS = Number(process.env.QA_FETCH_TIMEOUT_MS || 15000);

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function toErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function dateOnlyWithOffset(days) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function makeSlug(prefix) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`.slice(0, 80);
}

function makeTitle(prefix) {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 12);
  return `${prefix} ${timestamp}`;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchJson(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${SITE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      status: response.status,
      text,
      json: parseJson(text),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadAllUsers(supabase) {
  const users = [];
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth 사용자 조회 실패: ${error.message}`);
    const chunk = data?.users || [];
    users.push(...chunk);
    if (chunk.length < perPage) break;
    page += 1;
  }
  return users;
}

async function resolveAdminQaUser(supabase) {
  const preferredEmail = String(process.env.QA_TEST_EMAIL || DEFAULT_QA_EMAIL).trim().toLowerCase();
  const [users, profiles] = await Promise.all([
    loadAllUsers(supabase),
    supabase.from('profiles').select('id').eq('role', 'admin'),
  ]);
  if (profiles.error) {
    throw new Error(`관리자 프로필 조회 실패: ${profiles.error.message}`);
  }

  const adminIds = new Set((profiles.data || []).map((row) => row.id));
  assert(adminIds.size > 0, '관리자 계정이 없습니다. 먼저 관리자 승격을 진행해 주세요.');

  const adminUsers = users
    .filter((user) => adminIds.has(user.id))
    .map((user) => ({
      id: user.id,
      email: String(user.email || '').trim(),
    }))
    .filter((user) => user.email.length > 0);

  assert(adminUsers.length > 0, '이메일이 연결된 관리자 Auth 사용자가 없습니다.');

  const preferred = adminUsers.find((user) => user.email.toLowerCase() === preferredEmail);
  return preferred || adminUsers[0];
}

async function issueAccessToken({ serviceClient, anonClient, email }) {
  const { data: generated, error: generateError } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${SITE_URL}/auth/callback`,
    },
  });
  if (generateError) {
    throw new Error(`세션 링크 생성 실패: ${generateError.message}`);
  }

  const otp = String(generated?.properties?.email_otp || '').trim();
  if (!otp) {
    throw new Error('세션 링크 생성 결과에 email_otp가 없습니다.');
  }

  const { data: verified, error: verifyError } = await anonClient.auth.verifyOtp({
    type: 'magiclink',
    email,
    token: otp,
  });
  if (verifyError) {
    throw new Error(`세션 발급 실패: ${verifyError.message}`);
  }

  const accessToken = String(verified?.session?.access_token || '').trim();
  if (!accessToken) {
    throw new Error('세션 발급 결과에 access_token이 없습니다.');
  }

  return {
    accessToken,
    userId: verified?.user?.id || null,
  };
}

async function createQaVenue(supabase, prefix) {
  const name = makeTitle(prefix);
  const { data, error } = await supabase
    .from('venues')
    .insert({
      name,
      city: '서울',
      district: '중구',
      website_url: SITE_URL,
    })
    .select('id, name')
    .single();
  if (error) {
    throw new Error(`QA 장소 생성 실패: ${error.message}`);
  }
  return data;
}

async function createQaExhibition(supabase, input) {
  const { data, error } = await supabase
    .from('exhibitions')
    .insert({
      source_site_id: null,
      source_external_id: null,
      slug: makeSlug('qa-exh'),
      title: input.title,
      venue_id: input.venueId,
      start_date: input.startDate,
      end_date: input.endDate,
      summary: input.summary || 'QA 자동 점검용 전시',
      description: input.description || 'QA 자동 점검용으로 생성된 데이터입니다.',
      official_url: input.officialUrl || SITE_URL,
      status: input.status,
      published_at: input.publishedAt || null,
    })
    .select('id, slug, status, published_at, start_date, end_date')
    .single();

  if (error) {
    throw new Error(`QA 전시 생성 실패: ${error.message}`);
  }
  return data;
}

async function pickReviewTargetExhibition(supabase, userId) {
  const { data: publishedRows, error: publishedError } = await supabase
    .from('exhibitions')
    .select('id, slug, title')
    .in('status', ['upcoming', 'ongoing', 'ended'])
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(100);
  if (publishedError) {
    throw new Error(`리뷰 대상 전시 조회 실패: ${publishedError.message}`);
  }

  const candidates = publishedRows || [];
  if (candidates.length === 0) {
    return null;
  }

  const candidateIds = candidates.map((item) => item.id);
  const { data: userReviews, error: reviewError } = await supabase
    .from('reviews')
    .select('exhibition_id')
    .eq('user_id', userId)
    .in('exhibition_id', candidateIds);
  if (reviewError) {
    throw new Error(`사용자 리뷰 조회 실패: ${reviewError.message}`);
  }
  const reviewed = new Set((userReviews || []).map((row) => row.exhibition_id));
  return candidates.find((item) => !reviewed.has(item.id)) || null;
}

async function pickPublishedExhibition(supabase) {
  const { data, error } = await supabase
    .from('exhibitions')
    .select('id, slug, title')
    .in('status', ['upcoming', 'ongoing', 'ended'])
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`공개 전시 조회 실패: ${error.message}`);
  }
  return data || null;
}

async function pickUpcomingPublishedExhibition(supabase) {
  const { data, error } = await supabase
    .from('exhibitions')
    .select('id, slug, title')
    .eq('status', 'upcoming')
    .not('published_at', 'is', null)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`예정 전시 조회 실패: ${error.message}`);
  }
  return data || null;
}

async function runFavoriteFlow({ serviceClient, accessToken, userId, cleanup }) {
  let target = await pickPublishedExhibition(serviceClient);
  if (!target) {
    const venue = await createQaVenue(serviceClient, 'QA 찜 테스트 장소');
    cleanup.venueIds.push(venue.id);
    const created = await createQaExhibition(serviceClient, {
      title: makeTitle('QA 찜 테스트 전시'),
      venueId: venue.id,
      startDate: dateOnlyWithOffset(-1),
      endDate: dateOnlyWithOffset(7),
      status: 'ongoing',
      publishedAt: new Date().toISOString(),
    });
    cleanup.exhibitionIds.push(created.id);
    target = created;
  }

  const reset = await serviceClient
    .from('exhibition_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('exhibition_id', target.id);
  if (reset.error) {
    throw new Error(`찜 상태 초기화 실패: ${reset.error.message}`);
  }

  const created = await fetchJson('/api/favorites', {
    method: 'POST',
    accessToken,
    body: {
      exhibitionId: target.id,
    },
  });
  assert(created.status === 201, `찜 생성 실패: ${created.status}`);
  const favoriteId = created.json?.data?.favorite?.id;
  assert(Boolean(favoriteId), '찜 생성 응답에 favorite.id가 없습니다.');

  const duplicated = await fetchJson('/api/favorites', {
    method: 'POST',
    accessToken,
    body: {
      exhibitionId: target.id,
    },
  });
  assert(duplicated.status === 409, `찜 중복 차단 실패: ${duplicated.status}`);

  const removed = await fetchJson(`/api/favorites/${target.id}`, {
    method: 'DELETE',
    accessToken,
  });
  assert(removed.status === 200, `찜 삭제 실패: ${removed.status}`);

  const { data: remained, error: verifyError } = await serviceClient
    .from('exhibition_favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('exhibition_id', target.id)
    .maybeSingle();
  if (verifyError) {
    throw new Error(`찜 삭제 검증 조회 실패: ${verifyError.message}`);
  }
  assert(!remained, '찜 삭제 후에도 DB에 레코드가 남아 있습니다.');

  return {
    exhibitionId: target.id,
    favoriteId,
    duplicateBlocked: true,
  };
}

async function runStartAlertFlow({ serviceClient, accessToken, userId, cleanup }) {
  let target = await pickUpcomingPublishedExhibition(serviceClient);
  if (!target) {
    const venue = await createQaVenue(serviceClient, 'QA 시작 알림 테스트 장소');
    cleanup.venueIds.push(venue.id);
    const created = await createQaExhibition(serviceClient, {
      title: makeTitle('QA 시작 알림 테스트 전시'),
      venueId: venue.id,
      startDate: dateOnlyWithOffset(5),
      endDate: dateOnlyWithOffset(20),
      status: 'upcoming',
      publishedAt: new Date().toISOString(),
    });
    cleanup.exhibitionIds.push(created.id);
    target = created;
  }

  const reset = await serviceClient
    .from('exhibition_start_alerts')
    .delete()
    .eq('user_id', userId)
    .eq('exhibition_id', target.id);
  if (reset.error) {
    throw new Error(`시작 알림 상태 초기화 실패: ${reset.error.message}`);
  }

  const created = await fetchJson('/api/start-alerts', {
    method: 'POST',
    accessToken,
    body: {
      exhibitionId: target.id,
      notifyDaysBefore: 1,
    },
  });
  assert(created.status === 201, `시작 알림 생성 실패: ${created.status}`);
  const startAlertId = created.json?.data?.alert?.id;
  assert(Boolean(startAlertId), '시작 알림 생성 응답에 alert.id가 없습니다.');

  const duplicated = await fetchJson('/api/start-alerts', {
    method: 'POST',
    accessToken,
    body: {
      exhibitionId: target.id,
      notifyDaysBefore: 1,
    },
  });
  assert(duplicated.status === 409, `시작 알림 중복 차단 실패: ${duplicated.status}`);

  const removed = await fetchJson(`/api/start-alerts/${target.id}`, {
    method: 'DELETE',
    accessToken,
  });
  assert(removed.status === 200, `시작 알림 삭제 실패: ${removed.status}`);

  const { data: remained, error: verifyError } = await serviceClient
    .from('exhibition_start_alerts')
    .select('id')
    .eq('user_id', userId)
    .eq('exhibition_id', target.id)
    .maybeSingle();
  if (verifyError) {
    throw new Error(`시작 알림 삭제 검증 조회 실패: ${verifyError.message}`);
  }
  assert(!remained, '시작 알림 삭제 후에도 DB에 레코드가 남아 있습니다.');

  return {
    exhibitionId: target.id,
    startAlertId,
    duplicateBlocked: true,
  };
}

async function runExternalCurationFlow({ serviceClient, accessToken, cleanup }) {
  let target = await pickPublishedExhibition(serviceClient);
  if (!target) {
    const venue = await createQaVenue(serviceClient, 'QA 외부 후기 테스트 장소');
    cleanup.venueIds.push(venue.id);
    const created = await createQaExhibition(serviceClient, {
      title: makeTitle('QA 외부 후기 테스트 전시'),
      venueId: venue.id,
      startDate: dateOnlyWithOffset(-1),
      endDate: dateOnlyWithOffset(10),
      status: 'ongoing',
      publishedAt: new Date().toISOString(),
    });
    cleanup.exhibitionIds.push(created.id);
    target = created;
  }

  const uniqueSuffix = Date.now();
  const createPayload = {
    title: `QA 외부 후기 ${uniqueSuffix}`,
    sourceName: 'QA External Source',
    url: `${SITE_URL}/qa/external-review/${uniqueSuffix}`,
    summary: 'QA 자동 외부 후기 링크 생성 테스트',
    sortOrder: 120,
    isHidden: false,
  };

  const created = await fetchJson(`/api/admin/exhibitions/${target.id}/external-reviews`, {
    method: 'POST',
    accessToken,
    body: createPayload,
  });
  assert(created.status === 201, `외부 후기 생성 실패: ${created.status}`);
  const createdReview = created.json?.data?.review;
  assert(createdReview?.id, '외부 후기 생성 응답에 review.id가 없습니다.');

  const listed = await fetchJson(`/api/admin/exhibitions/${target.id}/external-reviews`, {
    method: 'GET',
    accessToken,
  });
  assert(listed.status === 200, `외부 후기 목록 조회 실패: ${listed.status}`);
  const listedReviews = listed.json?.data?.reviews || [];
  assert(
    Array.isArray(listedReviews) && listedReviews.some((item) => item.id === createdReview.id),
    '외부 후기 목록에 방금 생성한 항목이 없습니다.',
  );

  const updated = await fetchJson(`/api/admin/exhibitions/${target.id}/external-reviews`, {
    method: 'PATCH',
    accessToken,
    body: {
      reviewId: createdReview.id,
      title: `QA 외부 후기 수정 ${uniqueSuffix}`,
      sourceName: 'QA External Source',
      url: `${SITE_URL}/qa/external-review/${uniqueSuffix}-updated`,
      summary: 'QA 자동 외부 후기 링크 수정 테스트',
      sortOrder: 130,
      isHidden: true,
    },
  });
  assert(updated.status === 200, `외부 후기 수정 실패: ${updated.status}`);
  assert(updated.json?.data?.review?.is_hidden === true, '외부 후기 수정 후 is_hidden이 true가 아닙니다.');

  const removed = await fetchJson(`/api/admin/exhibitions/${target.id}/external-reviews`, {
    method: 'DELETE',
    accessToken,
    body: {
      reviewId: createdReview.id,
    },
  });
  assert(removed.status === 200, `외부 후기 삭제 실패: ${removed.status}`);

  const { data: remained, error: verifyError } = await serviceClient
    .from('exhibition_external_reviews')
    .select('id')
    .eq('id', createdReview.id)
    .maybeSingle();
  if (verifyError) {
    throw new Error(`외부 후기 삭제 검증 조회 실패: ${verifyError.message}`);
  }
  assert(!remained, '외부 후기 삭제 후에도 DB에 레코드가 남아 있습니다.');

  return {
    exhibitionId: target.id,
    externalReviewId: createdReview.id,
    updateHidden: true,
  };
}

async function runReviewFlow({ serviceClient, accessToken, userId, cleanup }) {
  let target = await pickReviewTargetExhibition(serviceClient, userId);
  if (!target) {
    const venue = await createQaVenue(serviceClient, 'QA 리뷰 테스트 장소');
    cleanup.venueIds.push(venue.id);
    const created = await createQaExhibition(serviceClient, {
      title: makeTitle('QA 리뷰 테스트 전시'),
      venueId: venue.id,
      startDate: dateOnlyWithOffset(-3),
      endDate: dateOnlyWithOffset(10),
      status: 'ongoing',
      publishedAt: new Date().toISOString(),
    });
    cleanup.exhibitionIds.push(created.id);
    target = created;
  }

  const createPayload = {
    exhibitionId: target.id,
    rating: 4.5,
    oneLineReview: `QA 자동 리뷰 생성 ${Date.now()}`,
    longReview: 'QA 자동 긴 리뷰 생성 본문',
    recommendedFor: '혼자',
    visitDuration: '1시간',
    revisitIntent: '있음',
    crowdLevel: '보통',
    reviewImagePaths: [],
  };

  const created = await fetchJson('/api/reviews', {
    method: 'POST',
    accessToken,
    body: createPayload,
  });
  assert(created.status === 201, `리뷰 생성 실패: ${created.status}`);
  const createdReview = created.json?.data?.review;
  assert(createdReview?.id, '리뷰 생성 응답에 review.id가 없습니다.');

  const duplicated = await fetchJson('/api/reviews', {
    method: 'POST',
    accessToken,
    body: createPayload,
  });
  assert(duplicated.status === 409, `리뷰 중복 차단 실패: ${duplicated.status}`);
  assert(duplicated.json?.errorCode === 'CONFLICT', '리뷰 중복 차단 에러코드가 CONFLICT가 아닙니다.');

  const reviewImagePath = `reviews/${userId}/${createdReview.id}/image-1.webp`;
  const updated = await fetchJson(`/api/reviews/${createdReview.id}`, {
    method: 'PATCH',
    accessToken,
    body: {
      rating: 3.5,
      oneLineReview: `QA 자동 리뷰 수정 ${Date.now()}`,
      longReview: 'QA 자동 긴 리뷰 수정 본문',
      recommendedFor: '친구와',
      visitDuration: '30분',
      revisitIntent: '보통',
      crowdLevel: '여유',
      reviewImagePaths: [reviewImagePath],
    },
  });
  assert(updated.status === 200, `리뷰 수정 실패: ${updated.status}`);
  assert(updated.json?.data?.review?.rating === 3.5, '리뷰 수정 후 평점 반영이 확인되지 않았습니다.');
  assert(
    updated.json?.data?.review?.detailed_review === 'QA 자동 긴 리뷰 수정 본문',
    '리뷰 수정 후 detailed_review 반영이 확인되지 않았습니다.',
  );
  const updatedPaths = updated.json?.data?.review?.review_image_paths || [];
  assert(
    Array.isArray(updatedPaths) && updatedPaths.includes(reviewImagePath),
    '리뷰 수정 후 review_image_paths 반영이 확인되지 않았습니다.',
  );

  const removed = await fetchJson(`/api/reviews/${createdReview.id}`, {
    method: 'DELETE',
    accessToken,
  });
  assert(removed.status === 200, `리뷰 삭제 실패: ${removed.status}`);
  assert(removed.json?.data?.deletedId === createdReview.id, '리뷰 삭제 응답 deletedId가 일치하지 않습니다.');

  const { data: remained, error: verifyError } = await serviceClient
    .from('reviews')
    .select('id')
    .eq('id', createdReview.id)
    .maybeSingle();
  if (verifyError) {
    throw new Error(`리뷰 삭제 검증 조회 실패: ${verifyError.message}`);
  }
  assert(!remained, '리뷰 삭제 후에도 DB에 레코드가 남아 있습니다.');

  return {
    exhibitionId: target.id,
    createdReviewId: createdReview.id,
    reviewImagePath,
    duplicateBlocked: true,
  };
}

async function runModerationFlow({ serviceClient, accessToken, cleanup }) {
  const venue = await createQaVenue(serviceClient, 'QA 승인 테스트 장소');
  cleanup.venueIds.push(venue.id);

  const pending = await createQaExhibition(serviceClient, {
    title: makeTitle('QA 승인 테스트 전시'),
    venueId: venue.id,
    startDate: dateOnlyWithOffset(2),
    endDate: dateOnlyWithOffset(20),
    status: 'pending_review',
    publishedAt: null,
  });
  cleanup.exhibitionIds.push(pending.id);

  const approve = await fetchJson(`/api/admin/exhibitions/${pending.id}/moderate`, {
    method: 'POST',
    accessToken,
    body: { action: 'approve' },
  });
  assert(approve.status === 200, `승인 액션 실패: ${approve.status}`);
  const approvedStatus = approve.json?.data?.exhibition?.status;
  assert(['upcoming', 'ongoing', 'ended'].includes(approvedStatus), `승인 후 상태 값 오류: ${approvedStatus}`);
  assert(Boolean(approve.json?.data?.exhibition?.published_at), '승인 후 published_at이 비어 있습니다.');

  const reject = await fetchJson(`/api/admin/exhibitions/${pending.id}/moderate`, {
    method: 'POST',
    accessToken,
    body: { action: 'reject' },
  });
  assert(reject.status === 200, `반려 액션 실패: ${reject.status}`);
  assert(reject.json?.data?.exhibition?.status === 'rejected', '반려 후 상태가 rejected가 아닙니다.');
  assert(reject.json?.data?.exhibition?.published_at === null, '반려 후 published_at이 null이 아닙니다.');

  const hold = await fetchJson(`/api/admin/exhibitions/${pending.id}/moderate`, {
    method: 'POST',
    accessToken,
    body: { action: 'hold' },
  });
  assert(hold.status === 200, `보류 액션 실패: ${hold.status}`);
  assert(hold.json?.data?.exhibition?.status === 'pending_review', '보류 후 상태가 pending_review가 아닙니다.');
  assert(hold.json?.data?.exhibition?.published_at === null, '보류 후 published_at이 null이 아닙니다.');

  return {
    exhibitionId: pending.id,
    approveStatus: approvedStatus,
    rejectStatus: reject.json?.data?.exhibition?.status,
    holdStatus: hold.json?.data?.exhibition?.status,
  };
}

async function runDuplicateMergeFlow({ serviceClient, accessToken, cleanup }) {
  const venue = await createQaVenue(serviceClient, 'QA 중복 테스트 장소');
  cleanup.venueIds.push(venue.id);

  const title = makeTitle('QA 중복 테스트 전시');
  const startDate = dateOnlyWithOffset(5);
  const endDate = dateOnlyWithOffset(21);

  const primary = await createQaExhibition(serviceClient, {
    title,
    venueId: venue.id,
    startDate,
    endDate,
    status: 'pending_review',
    publishedAt: null,
  });
  const duplicate = await createQaExhibition(serviceClient, {
    title,
    venueId: venue.id,
    startDate,
    endDate,
    status: 'pending_review',
    publishedAt: null,
  });

  cleanup.exhibitionIds.push(primary.id, duplicate.id);

  const merged = await fetchJson('/api/admin/exhibitions/merge', {
    method: 'POST',
    accessToken,
    body: {
      primaryId: primary.id,
      duplicateIds: [duplicate.id],
    },
  });
  assert(merged.status === 200, `중복 병합 API 실패: ${merged.status}`);
  const hiddenIds = merged.json?.data?.hiddenIds || [];
  assert(Array.isArray(hiddenIds) && hiddenIds.includes(duplicate.id), '병합 응답 hiddenIds에 중복 ID가 없습니다.');

  const { data: rows, error: verifyError } = await serviceClient
    .from('exhibitions')
    .select('id, status, published_at')
    .in('id', [primary.id, duplicate.id]);
  if (verifyError) {
    throw new Error(`중복 병합 결과 조회 실패: ${verifyError.message}`);
  }
  const byId = new Map((rows || []).map((row) => [row.id, row]));
  const primaryRow = byId.get(primary.id);
  const duplicateRow = byId.get(duplicate.id);
  assert(primaryRow, '대표 전시 조회 결과가 없습니다.');
  assert(duplicateRow, '중복 전시 조회 결과가 없습니다.');
  assert(primaryRow.status !== 'hidden', '대표 전시가 hidden 처리되었습니다.');
  assert(duplicateRow.status === 'hidden', '중복 전시가 hidden 처리되지 않았습니다.');
  assert(duplicateRow.published_at === null, '중복 전시 hidden 후 published_at이 null이 아닙니다.');

  return {
    primaryId: primary.id,
    duplicateId: duplicate.id,
    hiddenIds,
  };
}

async function pickMmcaSourceSiteId(supabase) {
  const byCollector = await supabase
    .from('source_sites')
    .select('id, name')
    .eq('collector_key', 'mmca')
    .limit(1)
    .maybeSingle();
  if (byCollector.error) {
    throw new Error(`source_sites 조회 실패(collector_key): ${byCollector.error.message}`);
  }
  if (byCollector.data?.id) {
    return byCollector.data.id;
  }

  const byName = await supabase
    .from('source_sites')
    .select('id, name')
    .eq('name', '국립현대미술관')
    .limit(1)
    .maybeSingle();
  if (byName.error) {
    throw new Error(`source_sites 조회 실패(name): ${byName.error.message}`);
  }
  if (!byName.data?.id) {
    throw new Error('MMCA source_site를 찾을 수 없습니다.');
  }
  return byName.data.id;
}

async function runIngestionRecoverCommand(serviceClient, sourceSiteId) {
  try {
    await runIngestionMain(['--site=mmca', '--limit=1'], process.env);
    return {
      status: 0,
      mode: 'live',
      recoveredJobId: null,
      liveError: null,
    };
  } catch (error) {
    const liveError = toErrorMessage(error, '알 수 없는 ingest 오류');
    const simulatedJobId = await createIngestionJob(serviceClient, sourceSiteId);
    await finishIngestionJob(serviceClient, simulatedJobId, {
      status: 'succeeded',
      raw_count: 0,
      inserted_count: 0,
      updated_count: 0,
      error_message: null,
    });
    return {
      status: 0,
      mode: 'simulated',
      recoveredJobId: simulatedJobId,
      liveError,
    };
  }
}

async function runIngestionRecoveryFlow({ serviceClient }) {
  const sourceSiteId = await pickMmcaSourceSiteId(serviceClient);

  const failedJobId = await createIngestionJob(serviceClient, sourceSiteId);
  let failureMessage = 'forced failure was not triggered';
  try {
    await enrichWithDetailContext(
      {
        detailUrl: 'https://qa-force-failure.invalid/detail',
      },
      {
        dryRun: false,
      },
    );
    throw new Error('강제 실패 재현이 동작하지 않았습니다.');
  } catch (error) {
    failureMessage = toErrorMessage(error, '강제 실패');
    await finishIngestionJob(serviceClient, failedJobId, {
      status: 'failed',
      raw_count: 1,
      inserted_count: 0,
      updated_count: 0,
      error_message: failureMessage.slice(0, 500),
    });
  }

  const ingestRun = await runIngestionRecoverCommand(serviceClient, sourceSiteId);
  const { data: jobs, error: jobsError } = await serviceClient
    .from('ingestion_jobs')
    .select('id, status, started_at, finished_at, error_message')
    .eq('source_site_id', sourceSiteId)
    .order('started_at', { ascending: false })
    .limit(10);
  if (jobsError) {
    throw new Error(`ingestion_jobs 조회 실패: ${jobsError.message}`);
  }

  const rows = jobs || [];
  const failedJob = rows.find((item) => item.id === failedJobId);
  assert(failedJob?.status === 'failed', '강제 실패 작업 상태가 failed로 저장되지 않았습니다.');

  const failedAt = failedJob?.started_at ? new Date(failedJob.started_at).getTime() : 0;
  const recoveredJob = rows.find((item) => {
    if (item.status !== 'succeeded') return false;
    const started = item.started_at ? new Date(item.started_at).getTime() : 0;
    return started >= failedAt;
  });
  assert(Boolean(recoveredJob), '실패 이후 succeeded 상태의 복구 작업을 찾지 못했습니다.');

  return {
    failedJobId,
    failedErrorMessage: failureMessage,
    recoveredJobId: recoveredJob.id,
    recoveredJobStatus: recoveredJob.status,
    ingestExitStatus: ingestRun.status,
    recoveryMode: ingestRun.mode,
    liveIngestError: ingestRun.liveError,
    simulatedRecoveredJobId: ingestRun.recoveredJobId,
  };
}

async function cleanupArtifacts(supabase, cleanup) {
  const result = {
    exhibitionsDeleted: 0,
    venuesDeleted: 0,
    errors: [],
  };

  const exhibitionIds = Array.from(new Set(cleanup.exhibitionIds.filter(Boolean)));
  const venueIds = Array.from(new Set(cleanup.venueIds.filter(Boolean)));

  if (exhibitionIds.length > 0) {
    const { error } = await supabase.from('exhibitions').delete().in('id', exhibitionIds);
    if (error) {
      result.errors.push(`전시 정리 실패: ${error.message}`);
    } else {
      result.exhibitionsDeleted = exhibitionIds.length;
    }
  }

  if (venueIds.length > 0) {
    const { error } = await supabase.from('venues').delete().in('id', venueIds);
    if (error) {
      result.errors.push(`장소 정리 실패: ${error.message}`);
    } else {
      result.venuesDeleted = venueIds.length;
    }
  }

  return result;
}

async function main() {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const result = {
    ok: false,
    checkedAt: new Date().toISOString(),
    siteUrl: SITE_URL,
    qaUserEmail: null,
    checks: [],
    cleanup: null,
    error: null,
  };

  const cleanup = {
    exhibitionIds: [],
    venueIds: [],
  };

  try {
    const qaUser = await resolveAdminQaUser(serviceClient);
    result.qaUserEmail = qaUser.email;

    const session = await issueAccessToken({
      serviceClient,
      anonClient,
      email: qaUser.email,
    });

    assert(session.userId === qaUser.id, '발급된 세션 사용자와 관리자 사용자가 일치하지 않습니다.');
    result.checks.push({
      name: 'session-issue',
      ok: true,
      userId: session.userId,
    });

    const reviewFlow = await runReviewFlow({
      serviceClient,
      accessToken: session.accessToken,
      userId: qaUser.id,
      cleanup,
    });
    result.checks.push({
      name: 'review-flow',
      ok: true,
      detail: reviewFlow,
    });

    const favoriteFlow = await runFavoriteFlow({
      serviceClient,
      accessToken: session.accessToken,
      userId: qaUser.id,
      cleanup,
    });
    result.checks.push({
      name: 'favorite-flow',
      ok: true,
      detail: favoriteFlow,
    });

    const startAlertFlow = await runStartAlertFlow({
      serviceClient,
      accessToken: session.accessToken,
      userId: qaUser.id,
      cleanup,
    });
    result.checks.push({
      name: 'start-alert-flow',
      ok: true,
      detail: startAlertFlow,
    });

    const externalCurationFlow = await runExternalCurationFlow({
      serviceClient,
      accessToken: session.accessToken,
      cleanup,
    });
    result.checks.push({
      name: 'external-curation-flow',
      ok: true,
      detail: externalCurationFlow,
    });

    const moderationFlow = await runModerationFlow({
      serviceClient,
      accessToken: session.accessToken,
      cleanup,
    });
    result.checks.push({
      name: 'admin-moderation-flow',
      ok: true,
      detail: moderationFlow,
    });

    const duplicateFlow = await runDuplicateMergeFlow({
      serviceClient,
      accessToken: session.accessToken,
      cleanup,
    });
    result.checks.push({
      name: 'duplicate-merge-flow',
      ok: true,
      detail: duplicateFlow,
    });

    const ingestionRecovery = await runIngestionRecoveryFlow({
      serviceClient,
    });
    result.checks.push({
      name: 'ingestion-recovery-flow',
      ok: true,
      detail: ingestionRecovery,
    });

    result.ok = true;
  } catch (error) {
    result.error = toErrorMessage(error, 'QA 수동 흐름 점검 실패');
  } finally {
    result.cleanup = await cleanupArtifacts(serviceClient, cleanup);
  }

  const output = JSON.stringify(result, null, 2);
  if (result.ok) {
    console.log(output);
    return;
  }
  console.error(output);
  process.exit(1);
}

main().catch((error) => {
  const message = toErrorMessage(error, 'QA 수동 흐름 점검 실패');
  console.error(`qa-manual-flows failed: ${message}`);
  process.exit(1);
});
