#!/usr/bin/env node
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const REQUIRED_PROVIDERS = ['email', 'google', 'kakao', 'naver'];

function parseArgs(argv) {
  return {
    strict: argv.includes('--strict'),
  };
}

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

async function fetchAuthSettings({ supabaseUrl, anonKey }) {
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Auth settings 조회 실패: ${response.status} ${text.slice(0, 180)}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Auth settings JSON 파싱 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
  return json;
}

function buildProviderStatus(settings) {
  const external = settings?.external && typeof settings.external === 'object' ? settings.external : {};
  const entries = {};

  for (const provider of REQUIRED_PROVIDERS) {
    const rawValue = external[provider];
    entries[provider] = {
      enabled: rawValue === true,
      presentInSettings: Object.prototype.hasOwnProperty.call(external, provider),
    };
  }

  const missing = REQUIRED_PROVIDERS.filter((provider) => !entries[provider].enabled);
  return {
    entries,
    missing,
    knownProviders: Object.keys(external),
  };
}

async function main() {
  const { strict } = parseArgs(process.argv.slice(2));
  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 환경 변수가 필요합니다.');
  }

  const settings = await fetchAuthSettings({ supabaseUrl, anonKey });
  const result = buildProviderStatus(settings);

  console.log(
    JSON.stringify(
      {
        ok: result.missing.length === 0,
        checkedAt: new Date().toISOString(),
        providers: result.entries,
        missingProviders: result.missing,
        knownProvidersFromSupabase: result.knownProviders,
      },
      null,
      2,
    ),
  );

  if (strict && result.missing.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`auth-provider check failed: ${message}`);
  process.exit(1);
});
