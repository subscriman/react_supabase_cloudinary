#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const podspecPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'third-party-podspecs',
  'boost.podspec',
);

const expectedChecksum = 'f0397ba6e982c4450f27bf32a2a83292aba035b827a5623a14636ea583318c41';
const expectedUrl = 'https://archives.boost.io/release/1.76.0/source/boost_1_76_0.tar.bz2';

if (!fs.existsSync(podspecPath)) {
  console.log(`[boost-patch] Skip: podspec not found at ${podspecPath}`);
  process.exit(0);
}

const content = fs.readFileSync(podspecPath, 'utf8');

let patched = content
  .replace(
    'https://boostorg.jfrog.io/artifactory/main/release/1.76.0/source/boost_1_76_0.tar.bz2',
    expectedUrl,
  )
  .replace(/:sha256 => '[0-9a-f]+'/, `:sha256 => '${expectedChecksum}'`);

if (patched === content) {
  console.log('[boost-patch] Already patched.');
  process.exit(0);
}

fs.writeFileSync(podspecPath, patched, 'utf8');
console.log('[boost-patch] Patched boost source URL/checksum.');
