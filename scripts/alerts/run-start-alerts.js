#!/usr/bin/env node
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: '.env' });

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: 100,
  };

  for (const token of argv) {
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token.startsWith('--limit=')) {
      const parsed = Number(token.replace('--limit=', ''));
      if (Number.isFinite(parsed) && parsed > 0) args.limit = Math.floor(parsed);
    }
  }
  return args;
}

function dateOnlyToUtcMs(value) {
  const safe = String(value || '').trim();
  if (!safe) return null;
  const parsed = Date.parse(`${safe}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function startOfTodayUtcMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
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

  const { data, error } = await supabase
    .from('exhibition_start_alerts')
    .select(
      `
        id,
        user_id,
        exhibition_id,
        notify_days_before,
        sent_at,
        created_at,
        exhibition:exhibitions (
          id,
          title,
          slug,
          status,
          start_date,
          published_at
        )
      `,
    )
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(options.limit);

  if (error) {
    throw new Error(error.message);
  }

  const todayMs = startOfTodayUtcMs();
  const rows = (data || []).map((row) => {
    const exhibition = Array.isArray(row.exhibition) ? row.exhibition[0] : row.exhibition;
    return {
      ...row,
      exhibition,
    };
  });

  const due = rows.filter((row) => {
    if (!row.exhibition) return false;
    if (row.exhibition.status !== 'upcoming') return false;
    if (!row.exhibition.published_at) return false;
    const startMs = dateOnlyToUtcMs(row.exhibition.start_date);
    if (startMs === null) return false;
    const notifyDays = Number(row.notify_days_before || 1);
    const triggerMs = startMs - notifyDays * 24 * 60 * 60 * 1000;
    return triggerMs <= todayMs;
  });

  const withUserEmail = [];
  for (const item of due) {
    const userResult = await supabase.auth.admin.getUserById(item.user_id);
    withUserEmail.push({
      id: item.id,
      userId: item.user_id,
      email: userResult.data?.user?.email || null,
      notifyDaysBefore: item.notify_days_before,
      exhibitionId: item.exhibition_id,
      exhibitionTitle: item.exhibition?.title || null,
      exhibitionSlug: item.exhibition?.slug || null,
      startDate: item.exhibition?.start_date || null,
    });
  }

  if (!options.dryRun && due.length > 0) {
    const ids = due.map((item) => item.id);
    const { error: updateError } = await supabase
      .from('exhibition_start_alerts')
      .update({
        sent_at: new Date().toISOString(),
      })
      .in('id', ids);
    if (updateError) {
      throw new Error(`알림 발송 상태 업데이트 실패: ${updateError.message}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: options.dryRun,
        checkedAt: new Date().toISOString(),
        scannedCount: rows.length,
        dueCount: due.length,
        markedSentCount: options.dryRun ? 0 : due.length,
        dueItems: withUserEmail,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`run-start-alerts failed: ${message}`);
  process.exit(1);
});
