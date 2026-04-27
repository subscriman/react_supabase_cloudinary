#!/usr/bin/env node
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: '.env' });

function parseArgs(argv) {
  return {
    strict: argv.includes('--strict'),
  };
}

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

async function main() {
  const { strict } = parseArgs(process.argv.slice(2));
  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin');

  if (error) {
    throw new Error(error.message);
  }

  const adminCount = Number(count || 0);
  console.log(
    JSON.stringify(
      {
        ok: adminCount > 0,
        checkedAt: new Date().toISOString(),
        adminCount,
      },
      null,
      2,
    ),
  );

  if (strict && adminCount === 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`admin-user check failed: ${message}`);
  process.exit(1);
});
