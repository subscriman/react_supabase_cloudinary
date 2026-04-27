#!/usr/bin/env node
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

async function checkKey(url, keyName, keyValue) {
  if (!keyValue) {
    return {
      keyName,
      ok: false,
      status: null,
      detail: '값이 비어 있습니다.',
    };
  }

  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/`;
  try {
    const headers =
      keyName === 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
        ? { apikey: keyValue }
        : { apikey: keyValue, Authorization: `Bearer ${keyValue}` };

    const response = await fetch(endpoint, { method: 'GET', headers });
    const body = await response.text();

    if (keyName === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
      // publishable/anon 키는 schema 문서 엔드포인트 접근 시 401(forbidden schema)이 정상일 수 있음.
      const isExpectedAnonForbidden =
        response.status === 401 && body.toLowerCase().includes('access to schema is forbidden');
      return {
        keyName,
        ok: response.ok || isExpectedAnonForbidden,
        status: response.status,
        detail: response.ok
          ? '정상 응답'
          : isExpectedAnonForbidden
            ? '키 유효(anon 권한으로 schema 문서 접근 제한)'
            : `HTTP ${response.status}`,
      };
    }

    return {
      keyName,
      ok: response.ok,
      status: response.status,
      detail: response.ok ? '정상 응답' : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      keyName,
      ok: false,
      status: null,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL이 필요합니다.');
  }

  const checks = await Promise.all([
    checkKey(url, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')),
    checkKey(url, 'SUPABASE_SERVICE_ROLE_KEY', getEnv('SUPABASE_SERVICE_ROLE_KEY')),
  ]);

  let hasError = false;
  for (const result of checks) {
    if (result.ok) {
      console.log(`✅ ${result.keyName}: ${result.detail}`);
    } else {
      hasError = true;
      console.log(`❌ ${result.keyName}: ${result.detail}`);
    }
  }

  if (hasError) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[supabase:key-check] 실패:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
