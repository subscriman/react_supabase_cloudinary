#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { fetchDaeguHtmlViaEdge } = require('./edge-fetch');
const { fetchText } = require('./http');
const { pickAdapter } = require('./adapters');
const { SITE_CONFIGS, getSiteConfigs } = require('./site-config');
const { fallbackNormalize, validateAndCoerceNormalized } = require('./normalize');

dotenv.config({ path: '.env' });

function parseArgs(argv) {
  const args = {
    siteKeys: [],
    sampleSize: 3,
    output: '',
    timeoutMs: 20000,
  };

  for (const token of argv) {
    if (token.startsWith('--site=')) {
      args.siteKeys = token
        .replace('--site=', '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      continue;
    }
    if (token.startsWith('--sample=')) {
      const value = Number(token.replace('--sample=', ''));
      if (Number.isFinite(value) && value >= 1 && value <= 20) args.sampleSize = Math.floor(value);
      continue;
    }
    if (token.startsWith('--timeout=')) {
      const value = Number(token.replace('--timeout=', ''));
      if (Number.isFinite(value) && value >= 5000 && value <= 60000) args.timeoutMs = Math.floor(value);
      continue;
    }
    if (token.startsWith('--output=')) {
      args.output = token.replace('--output=', '').trim();
      continue;
    }
  }

  return args;
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[audit] [${timestamp}] ${message}`);
}

function isHttpUrl(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractHost(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    return new URL(text).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function toPercent(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function summarizeValidationErrors(items) {
  const counter = new Map();
  for (const item of items) {
    for (const error of item.validationErrors) {
      counter.set(error, (counter.get(error) || 0) + 1);
    }
  }

  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({
      name,
      count,
    }));
}

function computeGrade(metrics) {
  if (metrics.itemCount === 0) return 'C';
  const core = (metrics.detailUrlRate + metrics.validSchemaRate + metrics.datePairRate) / 3;
  if (metrics.itemCount >= 8 && core >= 75) return 'A';
  if (metrics.itemCount >= 3 && core >= 45) return 'B';
  return 'C';
}

function formatRate(value) {
  return `${value.toFixed(1)}%`;
}

function parseBooleanEnv(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

async function auditOneSite(site, options) {
  const baseHost = extractHost(site.listUrl);
  const adapter = pickAdapter(site.key);

  const result = {
    key: site.key,
    name: site.name,
    listUrl: site.listUrl,
    status: 'ok',
    error: null,
    itemCount: 0,
    uniqueByUrlTitleCount: 0,
    metrics: {
      titleRate: 0,
      detailUrlRate: 0,
      sourceExternalIdRate: 0,
      venueRate: 0,
      datePairRate: 0,
      imageRate: 0,
      validSchemaRate: 0,
      sameHostDetailRate: 0,
    },
    topValidationErrors: [],
    samples: [],
  };

  let listHtml = '';
  try {
    const listResponse = await fetchText(site.listUrl, {
      timeoutMs: options.timeoutMs,
      insecureTls: Boolean(site.allowInsecureTls),
    });
    if (!listResponse.ok) {
      throw new Error(`목록 요청 실패 (${listResponse.status} ${listResponse.statusText})`);
    }
    listHtml = listResponse.text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const allowDaeguEdgeFetch =
      site.key === 'daegu-art' && parseBooleanEnv(process.env.INGESTION_DAEGU_USE_EDGE_FETCH, false);
    if (!allowDaeguEdgeFetch) {
      result.status = 'fetch_failed';
      result.error = message;
      return result;
    }

    try {
      const edge = await fetchDaeguHtmlViaEdge(process.env, {
        url: site.listUrl,
        timeoutMs: options.timeoutMs,
      });
      listHtml = edge.html;
    } catch (edgeError) {
      const edgeMessage = edgeError instanceof Error ? edgeError.message : String(edgeError);
      result.status = 'fetch_failed';
      result.error = `${message} | edge_fallback_failed: ${edgeMessage}`;
      return result;
    }
  }

  let rawItems = [];
  try {
    rawItems = await Promise.resolve(
      adapter.extractListItems(listHtml, {
        siteKey: site.key,
        baseUrl: site.listUrl,
        listUrl: site.listUrl,
      }),
    );
  } catch (error) {
    result.status = 'adapter_failed';
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }

  const normalizedRows = (rawItems || []).map((rawItem) => {
    const normalized = fallbackNormalize(rawItem);
    const validated = validateAndCoerceNormalized(normalized);
    const detailUrl = String(rawItem?.detailUrl || '').trim();
    const detailHost = extractHost(detailUrl);
    return {
      title: String(rawItem?.title || '').trim(),
      detailUrl,
      sourceExternalId: String(rawItem?.sourceExternalId || '').trim(),
      venueName: String(normalized.venueName || '').trim(),
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      imageUrl: String(normalized.posterImageUrl || '').trim(),
      isValid: validated.ok,
      validationErrors: validated.ok ? [] : validated.errors,
      sameHostDetail: Boolean(detailHost && baseHost && detailHost.includes(baseHost)),
    };
  });

  const uniqueKeys = new Set(
    normalizedRows.map((row) => `${row.title.toLowerCase()}::${row.detailUrl.toLowerCase()}`),
  );

  result.itemCount = normalizedRows.length;
  result.uniqueByUrlTitleCount = uniqueKeys.size;

  const titleCount = normalizedRows.filter((row) => row.title.length > 0).length;
  const detailCount = normalizedRows.filter((row) => isHttpUrl(row.detailUrl)).length;
  const sourceExternalIdCount = normalizedRows.filter((row) => row.sourceExternalId.length > 0).length;
  const venueCount = normalizedRows.filter((row) => row.venueName.length > 0).length;
  const datePairCount = normalizedRows.filter((row) => row.startDate && row.endDate).length;
  const imageCount = normalizedRows.filter((row) => isHttpUrl(row.imageUrl)).length;
  const validCount = normalizedRows.filter((row) => row.isValid).length;
  const sameHostDetailCount = normalizedRows.filter((row) => row.sameHostDetail).length;

  result.metrics = {
    titleRate: toPercent(titleCount, normalizedRows.length),
    detailUrlRate: toPercent(detailCount, normalizedRows.length),
    sourceExternalIdRate: toPercent(sourceExternalIdCount, normalizedRows.length),
    venueRate: toPercent(venueCount, normalizedRows.length),
    datePairRate: toPercent(datePairCount, normalizedRows.length),
    imageRate: toPercent(imageCount, normalizedRows.length),
    validSchemaRate: toPercent(validCount, normalizedRows.length),
    sameHostDetailRate: toPercent(sameHostDetailCount, normalizedRows.length),
  };

  result.topValidationErrors = summarizeValidationErrors(normalizedRows);
  result.samples = normalizedRows.slice(0, options.sampleSize).map((row) => ({
    title: row.title,
    detailUrl: row.detailUrl,
    sourceExternalId: row.sourceExternalId || null,
    venueName: row.venueName || null,
    startDate: row.startDate || null,
    endDate: row.endDate || null,
    imageUrl: row.imageUrl || null,
    isValid: row.isValid,
  }));

  return result;
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# 수집 사이트 진단 리포트');
  lines.push('');
  lines.push(`- 실행 시각: ${report.generatedAt}`);
  lines.push(`- 대상 사이트: ${report.sites.length}개`);
  lines.push(`- 샘플 개수: 사이트당 ${report.sampleSize}개`);
  lines.push('');
  lines.push('## 요약');
  lines.push('');
  lines.push('| 사이트 | 건수 | detail | date | venue | image | valid | grade |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|:---:|');
  for (const site of report.sites) {
    const grade = computeGrade({
      itemCount: site.itemCount,
      detailUrlRate: site.metrics.detailUrlRate,
      validSchemaRate: site.metrics.validSchemaRate,
      datePairRate: site.metrics.datePairRate,
    });
    if (site.status !== 'ok') {
      lines.push(`| ${site.key} | 0 | - | - | - | - | - | C |`);
    } else {
      lines.push(
        `| ${site.key} | ${site.itemCount} | ${formatRate(site.metrics.detailUrlRate)} | ${formatRate(site.metrics.datePairRate)} | ${formatRate(site.metrics.venueRate)} | ${formatRate(site.metrics.imageRate)} | ${formatRate(site.metrics.validSchemaRate)} | ${grade} |`,
      );
    }
  }
  lines.push('');

  for (const site of report.sites) {
    lines.push(`## ${site.name} (${site.key})`);
    lines.push('');
    lines.push(`- 목록 URL: ${site.listUrl}`);
    lines.push(`- 상태: ${site.status}`);
    if (site.error) {
      lines.push(`- 오류: ${site.error}`);
      lines.push('');
      continue;
    }
    lines.push(`- 추출 건수: ${site.itemCount} (unique key: ${site.uniqueByUrlTitleCount})`);
    lines.push(`- detailUrl 비율: ${formatRate(site.metrics.detailUrlRate)}`);
    lines.push(`- sourceExternalId 비율: ${formatRate(site.metrics.sourceExternalIdRate)}`);
    lines.push(`- venue 비율: ${formatRate(site.metrics.venueRate)}`);
    lines.push(`- date pair 비율: ${formatRate(site.metrics.datePairRate)}`);
    lines.push(`- image 비율: ${formatRate(site.metrics.imageRate)}`);
    lines.push(`- 유효 스키마 비율: ${formatRate(site.metrics.validSchemaRate)}`);
    lines.push(`- detail host 일치 비율: ${formatRate(site.metrics.sameHostDetailRate)}`);
    if (site.topValidationErrors.length > 0) {
      lines.push('- 주요 validation 오류:');
      for (const item of site.topValidationErrors) {
        lines.push(`  - ${item.name}: ${item.count}`);
      }
    }
    lines.push('- 샘플:');
    for (const sample of site.samples) {
      lines.push(`  - ${sample.title || '(제목없음)'}`);
      lines.push(`    - detail: ${sample.detailUrl || '(없음)'}`);
      lines.push(`    - venue/date/image: ${sample.venueName || '-'} / ${sample.startDate || '-'}~${sample.endDate || '-'} / ${sample.imageUrl || '-'}`);
      lines.push(`    - valid: ${sample.isValid ? 'yes' : 'no'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const sites = getSiteConfigs(options.siteKeys);
  if (!sites.length) {
    throw new Error('감사 대상 사이트가 없습니다. --site=mmca,sac 형식으로 지정하세요.');
  }

  log(`진단 시작: ${sites.length}개 사이트`);
  const reports = [];
  for (const site of sites) {
    log(`진단 중: ${site.key}`);
    const one = await auditOneSite(site, options);
    reports.push(one);
    if (one.status !== 'ok') {
      log(`실패: ${site.key} (${one.error || one.status})`);
    } else {
      log(
        `완료: ${site.key} raw=${one.itemCount}, valid=${one.metrics.validSchemaRate}%, detail=${one.metrics.detailUrlRate}%`,
      );
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sampleSize: options.sampleSize,
    sites: reports,
  };

  const outputPath =
    options.output ||
    path.join(
      'docs',
      `수집_사이트_진단_리포트_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.md`,
    );
  const absolutePath = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, toMarkdown(report), 'utf8');
  log(`리포트 저장: ${absolutePath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[audit] 실패:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
};
