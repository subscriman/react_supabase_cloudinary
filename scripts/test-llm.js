#!/usr/bin/env node
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

function resolveEndpoint(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

async function main() {
  const apiKey = String(process.env.LLM_API_KEY || '').trim();
  const baseUrl = String(process.env.LLM_BASE_URL || '').trim();
  const model = String(process.env.LLM_MODEL_NAME || '').trim();

  if (!apiKey || !baseUrl || !model) {
    throw new Error('LLM_API_KEY, LLM_BASE_URL, LLM_MODEL_NAME 환경 변수가 모두 필요합니다.');
  }

  const endpoint = resolveEndpoint(baseUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: '짧게 답하는 테스트 어시스턴트입니다.' },
        { role: 'user', content: 'ArtTomato LLM 연결 테스트 응답 한 줄만 출력해줘.' },
      ],
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || response.statusText;
    throw new Error(`호출 실패 (${response.status}): ${message}`);
  }

  const content = body?.choices?.[0]?.message?.content || '(응답 없음)';
  console.log('model:', model);
  console.log('response:', String(content).trim());
  if (body?.usage) {
    console.log('usage:', JSON.stringify(body.usage));
  }
}

main().catch((error) => {
  console.error('[llm:test] 실패:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
