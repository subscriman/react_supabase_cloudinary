#!/usr/bin/env node
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: '.env' });

function parseArgs(argv) {
  const args = {
    email: '',
    userId: '',
  };
  for (const token of argv) {
    if (token.startsWith('--email=')) {
      args.email = token.replace('--email=', '').trim();
    } else if (token.startsWith('--user-id=')) {
      args.userId = token.replace('--user-id=', '').trim();
    }
  }
  return args;
}

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

async function findUserIdByEmail(supabase, email) {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    const users = data?.users || [];
    const matched = users.find((user) => String(user.email || '').toLowerCase() === target);
    if (matched) return matched.id;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function grantAdminRole({ supabase, userId }) {
  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw profileError;

  if (existingProfile) {
    const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId);
    if (error) throw error;
    return 'updated';
  }

  const { error: insertError } = await supabase.from('profiles').insert({
    id: userId,
    role: 'admin',
  });
  if (insertError) throw insertError;
  return 'inserted';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다.');
  }
  if (!args.email && !args.userId) {
    throw new Error('사용법: node scripts/grant-admin.js --email=you@example.com (또는 --user-id=UUID)');
  }

  const supabase = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let userId = args.userId;
  if (!userId) {
    const found = await findUserIdByEmail(supabase, args.email);
    if (!found) {
      throw new Error(`해당 이메일의 사용자를 찾지 못했습니다: ${args.email}`);
    }
    userId = found;
  }

  const action = await grantAdminRole({ supabase, userId });
  console.log(
    JSON.stringify(
      {
        ok: true,
        action,
        userId,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`grant-admin failed: ${message}`);
  process.exit(1);
});
