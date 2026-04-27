#!/usr/bin/env node
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

function requiredEnv(name, value) {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }
  return text;
}

function parseArgs(argv) {
  const args = {
    url: '',
    timeoutMs: null,
  };

  for (const token of argv) {
    if (token.startsWith('--url=')) {
      args.url = token.replace('--url=', '').trim();
      continue;
    }
    if (token.startsWith('--timeout=')) {
      const parsed = Number(token.replace('--timeout=', '').trim());
      if (Number.isFinite(parsed) && parsed >= 1000 && parsed <= 60000) {
        args.timeoutMs = Math.floor(parsed);
      }
      continue;
    }
  }
  return args;
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL).replace(
    /\/+$/,
    '',
  );
  const anonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const endpoint = `${supabaseUrl}/functions/v1/daegu-connect-test`;
  const payload = {};
  if (args.url) payload.url = args.url;
  if (args.timeoutMs) payload.timeoutMs = args.timeoutMs;

  const started = Date.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { raw };
  }

  const durationMs = Date.now() - started;
  console.log(
    JSON.stringify(
      {
        ok: response.ok,
        status: response.status,
        durationMs,
        endpoint,
        result: parsed,
      },
      null,
      2,
    ),
  );

  if (!response.ok || (parsed && typeof parsed === 'object' && parsed.ok === false)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const err = error instanceof Error ? error : new Error(String(error));
  const anyErr = error && typeof error === 'object' ? error : null;
  const cause = anyErr && 'cause' in anyErr ? anyErr.cause : null;
  const causeCode = cause && typeof cause === 'object' && 'code' in cause ? cause.code : null;
  const causeMessage = cause && typeof cause === 'object' && 'message' in cause ? cause.message : null;
  console.error(
    '[invoke-daegu-connect-test] 실패:',
    err.message,
    causeCode ? `code=${String(causeCode)}` : '',
    causeMessage ? `cause=${String(causeMessage)}` : '',
  );
  process.exitCode = 1;
});
