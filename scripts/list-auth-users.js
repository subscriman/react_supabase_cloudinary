#!/usr/bin/env node
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: '.env' });

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

function maskEmail(email) {
  const value = String(email || '').trim();
  if (!value.includes('@')) return value;
  const [local, domain] = value.split('@');
  if (!local) return `***@${domain}`;
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

async function loadAllUsers(supabase) {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(error.message);

    const chunk = data?.users ?? [];
    users.push(...chunk);
    if (chunk.length < perPage) break;
    page += 1;
  }

  return users;
}

async function loadAdminIds(supabase) {
  const { data, error } = await supabase.from('profiles').select('id').eq('role', 'admin');
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.id));
}

async function main() {
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

  const [users, adminIds] = await Promise.all([loadAllUsers(supabase), loadAdminIds(supabase)]);
  const rows = users
    .map((user) => ({
      id: user.id,
      email: user.email || '',
      emailMasked: maskEmail(user.email || ''),
      createdAt: user.created_at || '',
      isAdmin: adminIds.has(user.id),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  console.log(
    JSON.stringify(
      {
        ok: true,
        totalUsers: rows.length,
        adminUsers: rows.filter((row) => row.isAdmin).length,
        users: rows,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`list-auth-users failed: ${message}`);
  process.exit(1);
});
