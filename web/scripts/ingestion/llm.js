function resolveChatCompletionsEndpoint(baseUrl) {
  const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!normalized) return '';
  if (normalized.endsWith('/chat/completions')) return normalized;
  return `${normalized}/chat/completions`;
}

function buildNormalizationPrompt(rawItem) {
  return [
    '다음 수집 원문을 ArtTomato 전시 스키마로 정규화해 주세요.',
    '규칙:',
    '1) 반드시 JSON 객체만 응답',
    '2) 날짜는 YYYY-MM-DD 형식',
    '3) 정보가 없으면 null',
    '4) title, venueName, officialUrl, startDate, endDate를 최대한 채우기',
    '5) tagCandidates는 최대 8개 문자열 배열',
    '',
    '출력 스키마:',
    JSON.stringify(
      {
        title: 'string',
        subtitle: 'string|null',
        venueName: 'string|null',
        city: 'string|null',
        district: 'string|null',
        startDate: 'YYYY-MM-DD|null',
        endDate: 'YYYY-MM-DD|null',
        operatingHours: 'string|null',
        admissionFee: 'string|null',
        summary: 'string|null',
        description: 'string|null',
        officialUrl: 'string|null',
        bookingUrl: 'string|null',
        posterImageUrl: 'string|null',
        tagCandidates: ['string'],
      },
      null,
      2,
    ),
    '',
    '입력 원문:',
    JSON.stringify(rawItem, null, 2),
  ].join('\n');
}

function parseJsonObjectContent(input) {
  if (!input) return null;
  if (typeof input === 'object') return input;
  const raw = String(input).trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitizeReviewDecision(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'accept' || normalized === 'reject' || normalized === 'needs_human') {
    return normalized;
  }
  return 'needs_human';
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeReviewOutput(raw) {
  const reasons = Array.isArray(raw?.reasons)
    ? raw.reasons
        .map((item) => String(item || '').trim())
        .filter((item) => item.length > 0)
        .slice(0, 5)
    : [];

  return {
    decision: sanitizeReviewDecision(raw?.decision),
    confidence: clampNumber(raw?.confidence, 0, 1, 0.5),
    qualityScore: clampNumber(raw?.qualityScore, 0, 100, 60),
    reasons,
    rationale: String(raw?.rationale || '').trim().slice(0, 500) || null,
  };
}

function fallbackReview(normalized) {
  const missing = [];
  if (!normalized?.title) missing.push('title');
  if (!normalized?.venueName) missing.push('venueName');
  if (!normalized?.startDate) missing.push('startDate');
  if (!normalized?.endDate) missing.push('endDate');
  if (!normalized?.officialUrl) missing.push('officialUrl');

  if (missing.length > 0) {
    return {
      decision: 'reject',
      confidence: 0.95,
      qualityScore: 20,
      reasons: [`필수 필드 누락: ${missing.join(', ')}`],
      rationale: '필수 필드가 없어 자동 반려합니다.',
    };
  }

  return {
    decision: 'needs_human',
    confidence: 0.5,
    qualityScore: 60,
    reasons: ['기본 요건은 충족했지만 최종 공개 전 검수가 필요합니다.'],
    rationale: '보수적으로 수동 검수를 권장합니다.',
  };
}

function buildReviewPrompt(normalized) {
  return [
    '다음 정규화된 전시 정보를 검수해 주세요.',
    '목표: 실제 전시 정보인지, 공개 가능한 품질인지 판정',
    '규칙:',
    '1) 반드시 JSON 객체만 응답',
    '2) decision은 accept/reject/needs_human 중 하나',
    '3) confidence는 0~1',
    '4) qualityScore는 0~100',
    '5) reasons는 핵심 근거 1~5개',
    '',
    '출력 스키마:',
    JSON.stringify(
      {
        decision: 'accept|reject|needs_human',
        confidence: 0.0,
        qualityScore: 0,
        reasons: ['string'],
        rationale: 'string',
      },
      null,
      2,
    ),
    '',
    '검수 대상:',
    JSON.stringify(normalized, null, 2),
  ].join('\n');
}

async function normalizeWithLLM(rawItem, env) {
  const apiKey = String(env?.LLM_API_KEY || '').trim();
  const baseUrl = String(env?.LLM_BASE_URL || '').trim();
  const model = String(env?.LLM_MODEL_NAME || '').trim();
  if (!apiKey || !baseUrl || !model) {
    return {
      ok: false,
      reason: 'llm_env_missing',
      error: 'LLM 환경 변수가 설정되지 않았습니다.',
      normalized: null,
      usage: null,
    };
  }

  const endpoint = resolveChatCompletionsEndpoint(baseUrl);
  const payload = {
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '당신은 전시 정보 정규화 도우미입니다. 반드시 스키마에 맞는 JSON 객체만 출력합니다.',
      },
      {
        role: 'user',
        content: buildNormalizationPrompt(rawItem),
      },
    ],
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        reason: 'llm_http_error',
        error: `LLM 호출 실패 (${response.status}): ${responseBody?.error?.message || response.statusText}`,
        normalized: null,
        usage: null,
      };
    }

    const content = responseBody?.choices?.[0]?.message?.content ?? null;
    const normalized = parseJsonObjectContent(content);
    if (!normalized || typeof normalized !== 'object') {
      return {
        ok: false,
        reason: 'llm_parse_error',
        error: 'LLM 응답 JSON 파싱에 실패했습니다.',
        normalized: null,
        usage: responseBody?.usage ?? null,
      };
    }

    return {
      ok: true,
      reason: null,
      error: null,
      normalized,
      usage: responseBody?.usage ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'llm_request_exception',
      error: error instanceof Error ? error.message : '알 수 없는 LLM 오류',
      normalized: null,
      usage: null,
    };
  }
}

async function reviewWithLLM(normalized, env) {
  const apiKey = String(env?.LLM_API_KEY || '').trim();
  const baseUrl = String(env?.LLM_BASE_URL || '').trim();
  const model = String(env?.LLM_REVIEW_MODEL_NAME || env?.LLM_MODEL_NAME || '').trim();
  if (!apiKey || !baseUrl || !model) {
    return {
      ok: false,
      reason: 'llm_env_missing',
      error: 'LLM 검수 환경 변수가 설정되지 않았습니다.',
      review: fallbackReview(normalized),
      usage: null,
    };
  }

  const endpoint = resolveChatCompletionsEndpoint(baseUrl);
  const payload = {
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '당신은 전시 정보 품질 검수자입니다. 반드시 스키마에 맞는 JSON 객체만 출력합니다.',
      },
      {
        role: 'user',
        content: buildReviewPrompt(normalized),
      },
    ],
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        reason: 'llm_http_error',
        error: `LLM 검수 호출 실패 (${response.status}): ${responseBody?.error?.message || response.statusText}`,
        review: fallbackReview(normalized),
        usage: null,
      };
    }

    const content = responseBody?.choices?.[0]?.message?.content ?? null;
    const parsed = parseJsonObjectContent(content);
    if (!parsed || typeof parsed !== 'object') {
      return {
        ok: false,
        reason: 'llm_parse_error',
        error: 'LLM 검수 응답 JSON 파싱에 실패했습니다.',
        review: fallbackReview(normalized),
        usage: responseBody?.usage ?? null,
      };
    }

    return {
      ok: true,
      reason: null,
      error: null,
      review: normalizeReviewOutput(parsed),
      usage: responseBody?.usage ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'llm_request_exception',
      error: error instanceof Error ? error.message : '알 수 없는 LLM 검수 오류',
      review: fallbackReview(normalized),
      usage: null,
    };
  }
}

module.exports = {
  normalizeWithLLM,
  reviewWithLLM,
};
