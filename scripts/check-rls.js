#!/usr/bin/env node
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: '.env' });

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

async function run() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anon = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const service = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !anon || !service) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  }

  const anonClient = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const serviceClient = createClient(url, service, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const checks = {};

  const svcNonPublic = await serviceClient
    .from('exhibitions')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending_review', 'hidden', 'rejected']);
  if (svcNonPublic.error) throw svcNonPublic.error;

  const anonNonPublic = await anonClient
    .from('exhibitions')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending_review', 'hidden', 'rejected']);
  if (anonNonPublic.error) throw anonNonPublic.error;

  const anonSourceSites = await anonClient.from('source_sites').select('id', { count: 'exact', head: true });
  if (anonSourceSites.error) throw anonSourceSites.error;

  const anonIngestionJobs = await anonClient.from('ingestion_jobs').select('id', { count: 'exact', head: true });
  if (anonIngestionJobs.error) throw anonIngestionJobs.error;

  const anonHiddenReviews = await anonClient
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('is_hidden', true);
  if (anonHiddenReviews.error) throw anonHiddenReviews.error;

  const anonFavorites = await anonClient.from('exhibition_favorites').select('id', { count: 'exact', head: true });
  if (anonFavorites.error) throw anonFavorites.error;

  const anonStartAlerts = await anonClient
    .from('exhibition_start_alerts')
    .select('id', { count: 'exact', head: true });
  if (anonStartAlerts.error) throw anonStartAlerts.error;

  const anonHiddenExternalReviews = await anonClient
    .from('exhibition_external_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('is_hidden', true);
  if (anonHiddenExternalReviews.error) throw anonHiddenExternalReviews.error;

  checks.svc_non_public_exhibitions = svcNonPublic.count ?? 0;
  checks.anon_non_public_exhibitions = anonNonPublic.count ?? 0;
  checks.anon_source_sites_visible = anonSourceSites.count ?? 0;
  checks.anon_ingestion_jobs_visible = anonIngestionJobs.count ?? 0;
  checks.anon_hidden_reviews_visible = anonHiddenReviews.count ?? 0;
  checks.anon_favorites_visible = anonFavorites.count ?? 0;
  checks.anon_start_alerts_visible = anonStartAlerts.count ?? 0;
  checks.anon_hidden_external_reviews_visible = anonHiddenExternalReviews.count ?? 0;

  const ok =
    checks.anon_non_public_exhibitions === 0 &&
    checks.anon_source_sites_visible === 0 &&
    checks.anon_ingestion_jobs_visible === 0 &&
    checks.anon_hidden_reviews_visible === 0 &&
    checks.anon_favorites_visible === 0 &&
    checks.anon_start_alerts_visible === 0 &&
    checks.anon_hidden_external_reviews_visible === 0;

  console.log(JSON.stringify({ ok, ...checks }, null, 2));
  if (!ok) process.exit(1);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`RLS check failed: ${message}`);
  process.exit(1);
});
