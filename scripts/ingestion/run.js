#!/usr/bin/env node
const dotenv = require('dotenv');
const { pickAdapter } = require('./adapters');
const { enrichWithDetailContext } = require('./detail-fetch');
const { fetchDaeguHtmlViaEdge } = require('./edge-fetch');
const { fetchText } = require('./http');
const { collectImageCandidates, isPlaceholderImageUrl, uploadExhibitionImageSet } = require('./image-storage');
const { normalizeWithLLM, reviewWithLLM } = require('./llm');
const { buildDedupeKey, fallbackNormalize, validateAndCoerceNormalized } = require('./normalize');
const {
  createIngestionJob,
  createRawItem,
  createSupabaseServiceClient,
  ensureTags,
  finishIngestionJob,
  replaceExhibitionTags,
  updateRawItem,
  upsertExhibitionFromNormalized,
} = require('./db');
const { SITE_CONFIGS, findSiteConfigByName, getSiteConfigs } = require('./site-config');

dotenv.config({ path: '.env' });

function parseArgs(argv) {
  const args = {
    siteKeys: [],
    dryRun: false,
    limit: null,
  };

  for (const token of argv) {
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token.startsWith('--site=')) {
      args.siteKeys = token
        .replace('--site=', '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      continue;
    }
    if (token.startsWith('--limit=')) {
      const parsed = Number(token.replace('--limit=', ''));
      if (Number.isFinite(parsed) && parsed > 0) args.limit = Math.floor(parsed);
      continue;
    }
  }
  return args;
}

function logStep(scope, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${scope}] ${message}`);
}

async function loadSourceSitesFromDb(supabase) {
  const { data, error } = await supabase
    .from('source_sites')
    .select('id, name, collector_key, base_url, list_url, priority, is_active')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error) {
    throw new Error(`source_sites 조회 실패: ${error.message}`);
  }
  return data || [];
}

function parseUrlOrNull(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    return new URL(text);
  } catch (_error) {
    return null;
  }
}

function normalizeListUrl(value) {
  const parsed = parseUrlOrNull(value);
  if (!parsed) return String(value || '').trim().toLowerCase();
  const pathname =
    parsed.pathname.length > 1 && parsed.pathname.endsWith('/') ? parsed.pathname.slice(0, -1) : parsed.pathname;
  return `${parsed.hostname.toLowerCase()}${pathname.toLowerCase()}`;
}

function resolveTargetSites(dbRows, selectedConfigs) {
  const configCandidates = [...SITE_CONFIGS];
  for (const selected of selectedConfigs) {
    if (!configCandidates.some((candidate) => candidate.key === selected.key)) {
      configCandidates.push(selected);
    }
  }

  const selectedKeys = new Set(selectedConfigs.map((config) => config.key));
  const selectedNames = new Set(selectedConfigs.map((config) => config.name));
  const selectedListUrls = new Set(selectedConfigs.map((config) => config.listUrl));

  return dbRows
    .map((row) => {
      const rowCollectorKey = String(row.collector_key || '').trim().toLowerCase();
      const rowListUrlNormalized = normalizeListUrl(row.list_url);
      const rowHost = parseUrlOrNull(row.list_url)?.hostname?.toLowerCase() || null;

      const configByCollectorKey = rowCollectorKey
        ? configCandidates.find((candidate) => candidate.key.toLowerCase() === rowCollectorKey)
        : null;
      const configByName = findSiteConfigByName(row.name);
      const configByListUrl = rowListUrlNormalized
        ? configCandidates.find((candidate) => normalizeListUrl(candidate.listUrl) === rowListUrlNormalized)
        : null;
      const configByHost = rowHost
        ? configCandidates.find((candidate) => parseUrlOrNull(candidate.listUrl)?.hostname?.toLowerCase() === rowHost)
        : null;
      const config =
        configByCollectorKey || configByName || configByListUrl || configByHost;
      if (!config) return null;

      const matchedBySelection =
        selectedKeys.size === 0 ||
        selectedKeys.has(config.key) ||
        (rowCollectorKey && selectedKeys.has(rowCollectorKey)) ||
        selectedNames.has(config.name) ||
        selectedListUrls.has(config.listUrl) ||
        selectedListUrls.has(row.list_url);

      if (
        !matchedBySelection
      ) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        baseUrl: row.base_url || config.listUrl,
        listUrl: config.listUrl,
        config,
      };
    })
    .filter(Boolean);
}

async function normalizeRawItem(rawItem, env) {
  const fallback = fallbackNormalize(rawItem);
  const llmResult = await normalizeWithLLM(rawItem, env);
  if (llmResult.ok && llmResult.normalized) {
    const merged = mergeNormalizedWithFallback(llmResult.normalized, fallback);
    const overridden = applySiteSpecificNormalizedOverrides(rawItem, merged);
    return {
      normalized: overridden,
      llm: llmResult,
      usedFallback: false,
    };
  }

  const overriddenFallback = applySiteSpecificNormalizedOverrides(rawItem, fallback);
  return {
    normalized: overriddenFallback,
    llm: llmResult,
    usedFallback: true,
  };
}

function isMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function mergeNormalizedWithFallback(llmNormalized, fallbackNormalized) {
  const merged = { ...(fallbackNormalized || {}) };
  const source = llmNormalized && typeof llmNormalized === 'object' ? llmNormalized : {};

  for (const [key, value] of Object.entries(source)) {
    if (!isMeaningfulValue(value)) {
      if (!isMeaningfulValue(merged[key])) merged[key] = value;
      continue;
    }
    merged[key] = value;
  }

  return merged;
}

function summarizeDescriptionText(value, maxLength = 200) {
  const text = String(value || '')
    .replace(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function normalizeImageUrlList(values, maxLength = 24) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const url = String(value || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    result.push(url);
    if (result.length >= maxLength) break;
  }
  return result;
}

function mergeDescriptionWithImageUrls(description, imageUrls) {
  const urls = normalizeImageUrlList(imageUrls, 24);
  const base = String(description || '').trim();
  if (urls.length === 0) return base || null;

  const existing = new Set();
  const pattern = /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi;
  let match;
  while ((match = pattern.exec(base)) !== null) {
    const url = String(match[1] || '').trim();
    if (url) existing.add(url);
  }

  const missing = urls.filter((url) => !existing.has(url));
  if (!base) {
    return missing.map((url) => `![상세 이미지](${url})`).join('\n\n') || null;
  }
  if (missing.length === 0) return base;

  const appendedImages = missing.map((url) => `![상세 이미지](${url})`).join('\n\n');
  return `${base}\n\n${appendedImages}`;
}

function applySiteSpecificNormalizedOverrides(rawItem, normalized) {
  const next = { ...(normalized || {}) };
  const detailDescriptionMarkdown = String(rawItem?.detailDescriptionMarkdown || '').trim();
  const detailImageUrls = Array.isArray(rawItem?.detailImageUrls) ? rawItem.detailImageUrls : [];
  const preferredDescription = detailDescriptionMarkdown || String(next.description || '').trim();
  const mergedDescription = mergeDescriptionWithImageUrls(preferredDescription, detailImageUrls);
  if (mergedDescription) {
    next.description = mergedDescription;
    if (!String(next.summary || '').trim()) {
      next.summary = summarizeDescriptionText(mergedDescription, 200);
    }
  }

  const preferredPoster = String(rawItem?.detailPreferredPosterImageUrl || '').trim();
  if (preferredPoster) {
    next.posterImageUrl = preferredPoster;
  }

  return next;
}

function parseBooleanEnv(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

function parseNumberEnv(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function buildNeedsHumanReview() {
  return {
    decision: 'needs_human',
    confidence: 0.5,
    qualityScore: 60,
    reasons: ['AI 검수 비활성/실패로 수동 검수를 권장합니다.'],
    rationale: '기본 수동 검수 경로',
  };
}

function derivePublicationStatus(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (endDate && endDate < today) return 'ended';
  if (startDate && startDate > today) return 'upcoming';
  return 'ongoing';
}

function resolveModerationByReview(review, normalized, env) {
  const autoApproveEnabled = parseBooleanEnv(env.INGESTION_AI_AUTO_APPROVE, false);
  const minConfidence = parseNumberEnv(env.INGESTION_AI_AUTO_APPROVE_MIN_CONFIDENCE, 0.9, 0, 1);
  if (autoApproveEnabled && review.decision === 'accept' && review.confidence >= minConfidence) {
    return {
      status: derivePublicationStatus(normalized.startDate, normalized.endDate),
      publishedAt: new Date().toISOString(),
      autoApproved: true,
    };
  }
  return {
    status: 'pending_review',
    publishedAt: null,
    autoApproved: false,
  };
}

function applyRejectPolicy(review, env) {
  const autoRejectEnabled = parseBooleanEnv(env.INGESTION_AI_AUTO_REJECT, false);
  if (autoRejectEnabled || review.decision !== 'reject') return review;
  return {
    ...review,
    decision: 'needs_human',
    reasons: [...(review.reasons || []), '자동 반려 비활성화로 수동 검수로 전환'],
  };
}

function sumNullableNumbers(...values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((acc, cur) => acc + Number(cur), 0);
}

async function reviewNormalizedItem(normalized, env) {
  const enabled = parseBooleanEnv(env.INGESTION_AI_REVIEW_ENABLED, true);
  if (!enabled) {
    return {
      review: buildNeedsHumanReview(),
      llm: null,
    };
  }

  const llmReview = await reviewWithLLM(normalized, env);
  return {
    review: llmReview.review || buildNeedsHumanReview(),
    llm: llmReview,
  };
}

async function runSiteIngestion({ supabase, site, options, env }) {
  const scope = site.config.key;
  logStep(scope, `수집 시작: ${site.name} (${site.listUrl})`);

  const stats = {
    rawCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    rejectedCount: 0,
    skippedCount: 0,
  };

  let listHtml = '';
  let listFetchError = null;
  const allowDryRunSampleFallback = options.dryRun && parseBooleanEnv(env.INGESTION_DRYRUN_SAMPLE_FALLBACK, false);
  const allowDaeguEdgeFetch =
    site.config.key === 'daegu-art' && parseBooleanEnv(env.INGESTION_DAEGU_USE_EDGE_FETCH, false);
  try {
    const listResponse = await fetchText(site.listUrl, {
      insecureTls: Boolean(site?.config?.allowInsecureTls),
    });
    if (!listResponse.ok) {
      throw new Error(`목록 요청 실패 (${listResponse.status} ${listResponse.statusText})`);
    }
    listHtml = listResponse.text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    listFetchError = error instanceof Error ? error : new Error(message);
    if (allowDaeguEdgeFetch) {
      try {
        const edge = await fetchDaeguHtmlViaEdge(env, {
          url: site.listUrl,
          timeoutMs: 20000,
        });
        listHtml = edge.html;
        listFetchError = null;
        logStep(
          scope,
          `목록 fetch 실패, Edge function 대체 성공: title=${edge.meta.title || 'n/a'}, duration=${edge.meta.durationMs ?? '-'}ms`,
        );
      } catch (edgeError) {
        const edgeMessage = edgeError instanceof Error ? edgeError.message : String(edgeError);
        logStep(scope, `Edge function 대체 실패: ${edgeMessage}`);
        if (allowDryRunSampleFallback) {
          logStep(scope, `목록 fetch 실패로 샘플 HTML fallback 사용(INGESTION_DRYRUN_SAMPLE_FALLBACK=true): ${message}`);
          listHtml = `
        <html>
          <body>
            <a href="${site.listUrl}">${site.name} 샘플 전시</a>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Event",
                "name": "${site.name} 샘플 전시",
                "startDate": "2026-04-01",
                "endDate": "2026-05-31",
                "url": "${site.listUrl}",
                "location": { "@type": "Place", "name": "${site.name}" },
                "description": "네트워크 연결 없이 동작 확인을 위한 샘플 데이터"
              }
            </script>
          </body>
        </html>
      `;
        } else if (options.dryRun) {
          logStep(scope, `목록 fetch 실패 (dry-run 샘플 fallback 비활성): ${message}`);
          listHtml = '';
        } else {
          logStep(scope, `목록 fetch 실패, 어댑터 대체 경로 시도: ${message}`);
          listHtml = '';
        }
      }
    } else if (allowDryRunSampleFallback) {
      logStep(scope, `목록 fetch 실패로 샘플 HTML fallback 사용(INGESTION_DRYRUN_SAMPLE_FALLBACK=true): ${message}`);
      listHtml = `
        <html>
          <body>
            <a href="${site.listUrl}">${site.name} 샘플 전시</a>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Event",
                "name": "${site.name} 샘플 전시",
                "startDate": "2026-04-01",
                "endDate": "2026-05-31",
                "url": "${site.listUrl}",
                "location": { "@type": "Place", "name": "${site.name}" },
                "description": "네트워크 연결 없이 동작 확인을 위한 샘플 데이터"
              }
            </script>
          </body>
        </html>
      `;
    } else if (options.dryRun) {
      logStep(scope, `목록 fetch 실패 (dry-run 샘플 fallback 비활성): ${message}`);
      listHtml = '';
    } else {
      logStep(scope, `목록 fetch 실패, 어댑터 대체 경로 시도: ${message}`);
      listHtml = '';
    }
  }

  const adapter = pickAdapter(site.config.key);
  let rawItems = await Promise.resolve(
    adapter.extractListItems(listHtml, {
      siteKey: site.config.key,
      baseUrl: site.baseUrl,
      listUrl: site.listUrl,
    }),
  );

  if (options.limit) {
    rawItems = rawItems.slice(0, options.limit);
  }

  if (!options.dryRun && listFetchError && rawItems.length === 0) {
    throw listFetchError;
  }

  stats.rawCount = rawItems.length;
  logStep(scope, `원문 항목 ${rawItems.length}건 추출`);

  let jobId = null;
  if (!options.dryRun) {
    jobId = await createIngestionJob(supabase, site.id);
  }

  try {
    for (const rawItem of rawItems) {
      const enrichedRawItem = await enrichWithDetailContext(rawItem, {
        dryRun: options.dryRun,
      });
      const normalizedResult = await normalizeRawItem(enrichedRawItem, env);
      const checked = validateAndCoerceNormalized(normalizedResult.normalized);
      const dedupeKey = buildDedupeKey(checked.value);

      if (!checked.ok) {
        stats.rejectedCount += 1;
        if (!options.dryRun && jobId) {
          const rawId = await createRawItem(supabase, {
            job_id: jobId,
            source_site_id: site.id,
            source_external_id: enrichedRawItem.sourceExternalId,
            source_list_url: enrichedRawItem.listUrl,
            source_detail_url: enrichedRawItem.detailUrl,
            dedupe_key: dedupeKey,
            status: 'rejected',
            raw_payload: enrichedRawItem,
            normalized_payload: checked.value,
            validation_errors: checked.errors,
            llm_prompt_tokens: normalizedResult.llm?.usage?.prompt_tokens ?? null,
            llm_completion_tokens: normalizedResult.llm?.usage?.completion_tokens ?? null,
          });
          await updateRawItem(supabase, rawId, {
            status: 'rejected',
          });
        }
        continue;
      }

      const reviewResult = await reviewNormalizedItem(checked.value, env);
      const aiReview = applyRejectPolicy(reviewResult.review, env);
      if (reviewResult.llm && !reviewResult.llm.ok) {
        const reason = reviewResult.llm.error || reviewResult.llm.reason || '알 수 없는 검수 오류';
        logStep(scope, `LLM 검수 fallback 적용: ${reason}`);
      }

      logStep(scope, `AI 검수 결과: decision=${aiReview.decision}, confidence=${aiReview.confidence}`);
      const baseNormalizedPayload = {
        ...checked.value,
        _ai_review: aiReview,
      };
      const baseRawPayload = {
        ...enrichedRawItem,
        aiReview,
      };
      const promptTokens = sumNullableNumbers(
        normalizedResult.llm?.usage?.prompt_tokens,
        reviewResult.llm?.usage?.prompt_tokens,
      );
      const completionTokens = sumNullableNumbers(
        normalizedResult.llm?.usage?.completion_tokens,
        reviewResult.llm?.usage?.completion_tokens,
      );

      if (aiReview.decision === 'reject') {
        stats.rejectedCount += 1;
        if (!options.dryRun && jobId) {
          const reviewReason = aiReview.reasons?.join(' | ') || aiReview.rationale || 'AI 자동 반려';
          const rawId = await createRawItem(supabase, {
            job_id: jobId,
            source_site_id: site.id,
            source_external_id: enrichedRawItem.sourceExternalId,
            source_list_url: enrichedRawItem.listUrl,
            source_detail_url: enrichedRawItem.detailUrl,
            dedupe_key: dedupeKey,
            status: 'rejected',
            raw_payload: baseRawPayload,
            normalized_payload: baseNormalizedPayload,
            validation_errors: [`AI_REVIEW_REJECT: ${reviewReason}`],
            llm_prompt_tokens: promptTokens,
            llm_completion_tokens: completionTokens,
          });
          await updateRawItem(supabase, rawId, {
            status: 'rejected',
          });
        }
        continue;
      }

      if (options.dryRun) {
        stats.skippedCount += 1;
        continue;
      }

      const imageCandidates = collectImageCandidates(enrichedRawItem, checked.value);
      const storedImages = await uploadExhibitionImageSet({
        supabase,
        sourceSiteKey: site.config.key,
        sourceExternalId: enrichedRawItem.sourceExternalId || dedupeKey,
        title: checked.value.title,
        candidateUrls: imageCandidates,
        maxAdditionalImages: 0,
        fetchOptions: {
          allowDaeguEdgeFetch,
          env,
        },
      });
      if (storedImages.warnings.length > 0) {
        logStep(scope, `이미지 저장 경고 ${storedImages.warnings.length}건`);
      }
      const checkedPosterImageUrl = String(checked.value.posterImageUrl || '').trim();
      const fallbackPosterImageUrl =
        checkedPosterImageUrl && !isPlaceholderImageUrl(checkedPosterImageUrl) ? checkedPosterImageUrl : null;
      const upsertNormalized = {
        ...checked.value,
        posterImageUrl: storedImages.mainImageUrl || fallbackPosterImageUrl,
      };
      logStep(
        scope,
        `이미지 저장 결과: main=${storedImages.mainImageUrl ? 'ok' : 'none'}, additional=0`,
      );
      const rawPayload = {
        ...baseRawPayload,
        storedImages: {
          uploaded: storedImages.uploaded,
          warnings: storedImages.warnings,
        },
      };
      const normalizedPayload = {
        ...upsertNormalized,
        _ai_review: aiReview,
        _stored_images: {
          mainImageUrl: storedImages.mainImageUrl || null,
          additionalImageUrls: [],
        },
      };

      const moderation = resolveModerationByReview(aiReview, checked.value, env);
      if (moderation.autoApproved) {
        logStep(scope, `AI 자동 승인 적용: status=${moderation.status}`);
      }

      const rawId = await createRawItem(supabase, {
        job_id: jobId,
        source_site_id: site.id,
        source_external_id: enrichedRawItem.sourceExternalId,
        source_list_url: enrichedRawItem.listUrl,
        source_detail_url: enrichedRawItem.detailUrl,
        dedupe_key: dedupeKey,
        status: 'validated',
        raw_payload: rawPayload,
        normalized_payload: normalizedPayload,
        validation_errors: [],
        llm_prompt_tokens: promptTokens,
        llm_completion_tokens: completionTokens,
      });

      const upserted = await upsertExhibitionFromNormalized(supabase, {
        sourceSiteId: site.id,
        sourceExternalId: enrichedRawItem.sourceExternalId,
        normalized: upsertNormalized,
        additionalImageUrls: [],
        review: moderation,
      });

      const tagIds = await ensureTags(supabase, checked.value.tagCandidates);
      await replaceExhibitionTags(supabase, upserted.id, tagIds);

      await updateRawItem(supabase, rawId, {
        status: 'accepted',
      });

      if (upserted.action === 'inserted') {
        stats.insertedCount += 1;
      } else {
        stats.updatedCount += 1;
      }
    }

    if (!options.dryRun && jobId) {
      await finishIngestionJob(supabase, jobId, {
        status: 'succeeded',
        raw_count: stats.rawCount,
        inserted_count: stats.insertedCount,
        updated_count: stats.updatedCount,
        error_message: null,
      });
    }

    logStep(
      scope,
      `완료: raw=${stats.rawCount}, inserted=${stats.insertedCount}, updated=${stats.updatedCount}, rejected=${stats.rejectedCount}, skipped=${stats.skippedCount}`,
    );
    return stats;
  } catch (error) {
    if (!options.dryRun && jobId) {
      await finishIngestionJob(supabase, jobId, {
        status: 'failed',
        raw_count: stats.rawCount,
        inserted_count: stats.insertedCount,
        updated_count: stats.updatedCount,
        error_message: error instanceof Error ? error.message : '알 수 없는 오류',
      });
    }
    throw error;
  }
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  const selectedConfigs = getSiteConfigs(options.siteKeys);
  if (selectedConfigs.length === 0) {
    throw new Error('선택된 사이트가 없습니다. --site=mmca,sac 형식으로 전달하세요.');
  }

  const supabase = createSupabaseServiceClient(env, {
    allowAnonFallback: options.dryRun,
  });
  let sourceSites = [];
  let targets = [];
  try {
    sourceSites = await loadSourceSitesFromDb(supabase);
    targets = resolveTargetSites(sourceSites, selectedConfigs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!options.dryRun) {
      throw error;
    }
    logStep('ingestion', `source_sites 조회 실패로 정적 설정 fallback 사용: ${message}`);
    targets = selectedConfigs.map((config) => ({
      id: null,
      name: config.name,
      baseUrl: config.listUrl,
      listUrl: config.listUrl,
      config,
    }));
  }

  if (targets.length === 0) {
    throw new Error(
      `DB source_sites와 매칭되는 활성 사이트가 없습니다. (활성 site=${sourceSites.length}, 선택 key=${selectedConfigs
        .map((config) => config.key)
        .join(',')})`,
    );
  }

  logStep(
    'ingestion',
    `대상 ${targets.length}개 사이트 처리 시작 (dryRun=${options.dryRun ? 'true' : 'false'}, limit=${
      options.limit || 'none'
    })`,
  );

  let totalRaw = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalRejected = 0;
  let totalSkipped = 0;

  for (const site of targets) {
    const result = await runSiteIngestion({
      supabase,
      site,
      options,
      env,
    });
    totalRaw += result.rawCount;
    totalInserted += result.insertedCount;
    totalUpdated += result.updatedCount;
    totalRejected += result.rejectedCount;
    totalSkipped += result.skippedCount;
  }

  logStep(
    'ingestion',
    `전체 완료: raw=${totalRaw}, inserted=${totalInserted}, updated=${totalUpdated}, rejected=${totalRejected}, skipped=${totalSkipped}`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[ingestion] 실패:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
};
