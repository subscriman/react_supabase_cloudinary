function requiredEnv(name, value) {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }
  return text;
}

async function callDaeguEdgeFunction(env, payload) {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL).replace(
    /\/+$/,
    '',
  );
  const anonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const response = await fetch(`${supabaseUrl}/functions/v1/daegu-connect-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload || {}),
  });

  const bodyText = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new Error(`Edge function 호출 실패 (${response.status}): ${bodyText.slice(0, 400)}`);
  }
  if (!parsed || parsed.ok !== true) {
    throw new Error(`Edge function 내부 실패: ${bodyText.slice(0, 400)}`);
  }

  return parsed;
}

async function fetchDaeguHtmlViaEdge(env, options = {}) {
  const url = String(options.url || 'https://daeguartmuseum.or.kr/index.do?menu_id=00000729').trim();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.floor(options.timeoutMs) : 20000;
  const parsed = await callDaeguEdgeFunction(env, {
    url,
    timeoutMs,
    includeHtml: true,
  });

  const html = String(parsed?.response?.html || '');
  if (!html) {
    throw new Error('Edge function 응답에 html이 없습니다.');
  }

  return {
    html,
    meta: {
      finalUrl: parsed?.response?.finalUrl || null,
      status: parsed?.response?.status ?? null,
      title: parsed?.response?.title || null,
      durationMs: parsed?.durationMs ?? null,
    },
  };
}

async function fetchDaeguImageViaEdge(env, options = {}) {
  const url = String(options.url || '').trim();
  if (!url) {
    throw new Error('이미지 URL이 필요합니다.');
  }
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.floor(options.timeoutMs) : 20000;
  const parsed = await callDaeguEdgeFunction(env, {
    url,
    timeoutMs,
    includeBodyBase64: true,
  });

  const bodyBase64 = String(parsed?.response?.bodyBase64 || '');
  if (!bodyBase64) {
    throw new Error('Edge function 응답에 bodyBase64가 없습니다.');
  }

  const buffer = Buffer.from(bodyBase64, 'base64');
  if (buffer.length === 0) {
    throw new Error('Edge function 이미지 본문이 비어 있습니다.');
  }

  return {
    buffer,
    contentType: String(parsed?.response?.contentType || '').trim().toLowerCase() || null,
    meta: {
      finalUrl: parsed?.response?.finalUrl || null,
      status: parsed?.response?.status ?? null,
      durationMs: parsed?.durationMs ?? null,
    },
  };
}

module.exports = {
  fetchDaeguHtmlViaEdge,
  fetchDaeguImageViaEdge,
};
