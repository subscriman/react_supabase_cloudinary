/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');

const requiredByScope = {
  root: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL_NAME'],
  ingestion: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'LLM_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL_NAME'],
  web: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  mobile: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
};

const optionalByScope = {
  web: ['NEXT_PUBLIC_SITE_URL'],
};

const filesByScope = {
  root: path.join(rootDir, '.env'),
  ingestion: path.join(rootDir, '.env'),
  web: path.join(rootDir, 'web', '.env.local'),
  mobile: path.join(rootDir, 'mobile', '.env'),
};

function loadFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return dotenv.parse(content);
}

function pickScopes(arg) {
  if (!arg || arg === 'all') {
    return ['root', 'web', 'mobile', 'ingestion'];
  }
  if (arg === 'root' || arg === 'web' || arg === 'mobile' || arg === 'ingestion') {
    return [arg];
  }

  console.error(`Unknown scope: ${arg}`);
  console.error('Usage: node scripts/check-env.js [all|root|web|mobile|ingestion]');
  process.exit(2);
}

function printResult(scope, missing, filePath) {
  if (missing.length === 0) {
    console.log(`✅ ${scope}: required env keys are configured (${path.relative(rootDir, filePath)})`);
    return;
  }

  console.log(`❌ ${scope}: missing ${missing.length} key(s) (${path.relative(rootDir, filePath)})`);
  for (const key of missing) {
    console.log(`   - ${key}`);
  }
}

function printOptionalWarnings(scope, filePath, missingOptional) {
  if (!missingOptional || missingOptional.length === 0) return;
  console.log(`⚠️  ${scope}: optional key missing (${path.relative(rootDir, filePath)})`);
  for (const key of missingOptional) {
    console.log(`   - ${key}`);
  }
}

function checkScope(scope) {
  const required = requiredByScope[scope];
  const filePath = filesByScope[scope];
  const fromFile = loadFile(filePath);
  const missing = [];
  const missingOptional = [];

  for (const key of required) {
    const value = process.env[key] || fromFile[key];
    if (!value || String(value).trim().length === 0) {
      missing.push(key);
    }
  }

  for (const key of optionalByScope[scope] ?? []) {
    const value = process.env[key] || fromFile[key];
    if (!value || String(value).trim().length === 0) {
      missingOptional.push(key);
    }
  }

  printResult(scope, missing, filePath);
  printOptionalWarnings(scope, filePath, missingOptional);
  return missing.length === 0;
}

function main() {
  const scopes = pickScopes(process.argv[2]);
  let ok = true;

  for (const scope of scopes) {
    const scopeOk = checkScope(scope);
    ok = ok && scopeOk;
  }

  if (!ok) {
    process.exit(1);
  }
}

main();
