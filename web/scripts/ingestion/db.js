const { createClient } = require('@supabase/supabase-js');
const { slugify } = require('./normalize');

const DB_RETRY_COUNT = 3;
const DB_RETRY_BASE_DELAY_MS = 250;

function requiredEnv(name, value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }
  return normalized;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTransientNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  if (!message && !code) return false;

  if (message.includes('fetch failed')) return true;
  if (message.includes('network')) return true;
  if (message.includes('timed out')) return true;
  if (message.includes('timeout')) return true;
  if (message.includes('connection')) return true;
  if (message.includes('socket')) return true;
  if (message.includes('tls')) return true;

  if (code === 'etimedout') return true;
  if (code === 'econnreset') return true;
  if (code === 'enotfound') return true;
  if (code === 'eai_again') return true;
  if (code === 'ecanceled') return true;
  if (code === 'econnrefused') return true;

  return false;
}

async function runWithDbRetry(operation, options = {}) {
  const retries = Number.isFinite(options.retries) ? Math.max(0, Math.floor(options.retries)) : DB_RETRY_COUNT;
  const baseDelayMs = Number.isFinite(options.baseDelayMs)
    ? Math.max(0, Math.floor(options.baseDelayMs))
    : DB_RETRY_BASE_DELAY_MS;

  let attempt = 0;
  while (attempt <= retries) {
    try {
      const result = await operation();
      const hasErrorField = result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'error');
      if (!hasErrorField || !result.error) {
        return result;
      }

      if (!isTransientNetworkError(result.error) || attempt >= retries) {
        return result;
      }
    } catch (error) {
      if (!isTransientNetworkError(error) || attempt >= retries) {
        throw error;
      }
    }

    await wait(baseDelayMs * (attempt + 1));
    attempt += 1;
  }

  return operation();
}

function createSupabaseServiceClient(env, options = {}) {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL);
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  let key = serviceRoleKey;
  if (!key) {
    if (options.allowAnonFallback && anonKey) {
      key = anonKey;
    } else {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다.');
    }
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function findOrCreateVenueId(supabase, name, options = {}) {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) return null;

  const { data: existing, error: selectError } = await runWithDbRetry(() =>
    supabase
      .from('venues')
      .select('id')
      .eq('name', normalizedName)
      .maybeSingle(),
  );
  if (selectError) throw new Error(`장소 조회 실패: ${selectError.message}`);
  if (existing?.id) return existing.id;

  const payload = {
    name: normalizedName,
    city: options.city || null,
    district: options.district || null,
    address: null,
    website_url: options.websiteUrl || null,
  };
  const { data: inserted, error: insertError } = await runWithDbRetry(() =>
    supabase
      .from('venues')
      .insert(payload)
      .select('id')
      .single(),
  );
  if (insertError) throw new Error(`장소 생성 실패: ${insertError.message}`);
  return inserted.id;
}

async function ensureUniqueSlug(supabase, preferred) {
  const base = slugify(preferred) || `exhibition-${Date.now()}`;
  let candidate = base;
  let suffix = 2;

  // Keep query loop simple and explicit for readability in 운영 스크립트.
  while (true) {
    const { data, error } = await supabase
      .from('exhibitions')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (error) throw new Error(`slug 중복 확인 실패: ${error.message}`);
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function findDuplicateExhibition(supabase, normalized, venueId) {
  const query = supabase
    .from('exhibitions')
    .select('id, slug, status')
    .eq('title', normalized.title)
    .eq('start_date', normalized.startDate)
    .eq('end_date', normalized.endDate)
    .limit(1);

  if (venueId) query.eq('venue_id', venueId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`중복 조회 실패: ${error.message}`);
  return data || null;
}

async function findExhibitionBySourceExternal(supabase, sourceSiteId, sourceExternalId) {
  const siteId = String(sourceSiteId || '').trim();
  const externalId = String(sourceExternalId || '').trim();
  if (!siteId || !externalId) return null;

  const { data, error } = await supabase
    .from('exhibitions')
    .select('id, slug, status')
    .eq('source_site_id', siteId)
    .eq('source_external_id', externalId)
    .maybeSingle();
  if (error) throw new Error(`원본 ID 중복 조회 실패: ${error.message}`);
  return data || null;
}

function buildExhibitionPatch(input, venueId) {
  const review = input.review || {};
  const status = String(review.status || '').trim() || 'pending_review';
  const publishedAt =
    Object.prototype.hasOwnProperty.call(review, 'publishedAt') && review.publishedAt ? review.publishedAt : null;

  return {
    source_site_id: input.sourceSiteId || null,
    source_external_id: input.sourceExternalId || null,
    title: input.normalized.title,
    subtitle: input.normalized.subtitle,
    venue_id: venueId,
    start_date: input.normalized.startDate,
    end_date: input.normalized.endDate,
    operating_hours: input.normalized.operatingHours,
    admission_fee: input.normalized.admissionFee,
    poster_image_url: input.normalized.posterImageUrl,
    summary: input.normalized.summary,
    description: input.normalized.description,
    official_url: input.normalized.officialUrl,
    booking_url: input.normalized.bookingUrl,
    additional_image_urls: [],
    status,
    published_at: publishedAt,
  };
}

async function updateExhibitionById(supabase, id, patch) {
  const { data: updated, error: updateError } = await supabase
    .from('exhibitions')
    .update(patch)
    .eq('id', id)
    .select('id, slug')
    .single();
  if (updateError) throw new Error(`기존 전시 업데이트 실패: ${updateError.message}`);
  return updated;
}

function isSourceExternalUniqueViolation(error) {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').trim();
  if (message.includes('exhibitions_source_site_id_source_external_id_key')) return true;
  if (code === '23505' && message.includes('source_site_id') && message.includes('source_external_id')) return true;
  return false;
}

async function upsertExhibitionFromNormalized(supabase, input) {
  const venueId = await findOrCreateVenueId(supabase, input.normalized.venueName, {
    city: input.normalized.city,
    district: input.normalized.district,
    websiteUrl: input.normalized.officialUrl,
  });
  const patch = buildExhibitionPatch(input, venueId);

  const bySourceExternal = await findExhibitionBySourceExternal(supabase, input.sourceSiteId, input.sourceExternalId);
  if (bySourceExternal) {
    const updated = await updateExhibitionById(supabase, bySourceExternal.id, patch);
    return { action: 'updated', id: updated.id, slug: updated.slug, venueId };
  }

  const duplicated = await findDuplicateExhibition(supabase, input.normalized, venueId);
  if (duplicated) {
    const updated = await updateExhibitionById(supabase, duplicated.id, patch);
    return { action: 'updated', id: updated.id, slug: updated.slug, venueId };
  }

  const slug = await ensureUniqueSlug(supabase, input.normalized.title);
  const payload = {
    slug,
    ...patch,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('exhibitions')
    .insert(payload)
    .select('id, slug')
    .single();
  if (insertError) {
    if (isSourceExternalUniqueViolation(insertError)) {
      const recovered = await findExhibitionBySourceExternal(supabase, input.sourceSiteId, input.sourceExternalId);
      if (recovered) {
        const updated = await updateExhibitionById(supabase, recovered.id, patch);
        return { action: 'updated', id: updated.id, slug: updated.slug, venueId };
      }
    }
    throw new Error(`전시 등록 실패: ${insertError.message}`);
  }
  return { action: 'inserted', id: inserted.id, slug: inserted.slug, venueId };
}

function toTagSlug(name) {
  const base = slugify(name) || 'tag';
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `${base}-${hash.toString(36)}`;
}

async function ensureTags(supabase, names) {
  const normalizedNames = Array.from(
    new Set(
      (names || [])
        .map((name) => String(name || '').trim())
        .filter((name) => name.length > 0),
    ),
  ).slice(0, 12);
  if (normalizedNames.length === 0) return [];

  const rows = normalizedNames.map((name) => ({
    name,
    slug: toTagSlug(name),
    type: 'keyword',
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('tags')
    .upsert(rows, { onConflict: 'name,type' })
    .select('id, name');
  if (insertError) throw new Error(`태그 upsert 실패: ${insertError.message}`);

  const idByName = new Map((inserted || []).map((row) => [row.name, row.id]));

  if (idByName.size < normalizedNames.length) {
    const { data: fetched, error: fetchError } = await supabase
      .from('tags')
      .select('id, name')
      .in('name', normalizedNames);
    if (fetchError) throw new Error(`태그 조회 실패: ${fetchError.message}`);
    for (const row of fetched || []) {
      idByName.set(row.name, row.id);
    }
  }

  return normalizedNames.map((name) => idByName.get(name)).filter(Boolean);
}

async function replaceExhibitionTags(supabase, exhibitionId, tagIds) {
  const { error: deleteError } = await supabase.from('exhibition_tags').delete().eq('exhibition_id', exhibitionId);
  if (deleteError) throw new Error(`기존 태그 삭제 실패: ${deleteError.message}`);

  if (!tagIds || tagIds.length === 0) return;
  const rows = tagIds.map((tagId) => ({
    exhibition_id: exhibitionId,
    tag_id: tagId,
  }));
  const { error: insertError } = await supabase.from('exhibition_tags').insert(rows);
  if (insertError) throw new Error(`전시 태그 저장 실패: ${insertError.message}`);
}

async function createIngestionJob(supabase, sourceSiteId) {
  const { data, error } = await supabase
    .from('ingestion_jobs')
    .insert({
      source_site_id: sourceSiteId || null,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw new Error(`수집 작업 생성 실패: ${error.message}`);
  return data.id;
}

async function finishIngestionJob(supabase, jobId, patch) {
  const { error } = await supabase
    .from('ingestion_jobs')
    .update({
      ...patch,
      finished_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  if (error) throw new Error(`수집 작업 업데이트 실패: ${error.message}`);
}

async function createRawItem(supabase, payload) {
  const { data, error } = await supabase
    .from('ingestion_raw_items')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw new Error(`원문 저장 실패: ${error.message}`);
  return data.id;
}

async function updateRawItem(supabase, rawItemId, patch) {
  const { error } = await supabase.from('ingestion_raw_items').update(patch).eq('id', rawItemId);
  if (error) throw new Error(`원문 업데이트 실패: ${error.message}`);
}

module.exports = {
  createIngestionJob,
  createRawItem,
  createSupabaseServiceClient,
  ensureTags,
  finishIngestionJob,
  replaceExhibitionTags,
  updateRawItem,
  upsertExhibitionFromNormalized,
};
