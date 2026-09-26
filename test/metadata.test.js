import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { withExportMetadata } from '../src/metadata.js';

// Node 18 does not expose Web Crypto globally by default.
globalThis.crypto ??= webcrypto;

const result = { markdown: '# Café 🦊\r\n\nBody with trailing spaces  \n', sourceUrl: 'https://example.com/canonical', title: 'Café', filename: 'cafe.md' };

test('default metadata records the URL without adding integrity fields or changing payload bytes', async () => {
  const exported = await withExportMetadata(result);
  assert.equal(exported.markdown, `<!-- Markdown Capture metadata\nSource URL: ${result.sourceUrl}\n-->\n\n${result.markdown}`);
});

test('integrity hash independently verifies the exact Unicode payload and whitespace', async () => {
  const exported = await withExportMetadata(result, { includeIntegrity: true, capturedAt: new Date('2026-09-26T18:42:07.123Z') });
  const [header, body] = exported.markdown.split('-->\n\n');
  assert.equal(body, result.markdown);
  assert.match(header, /Captured at: 2026-09-26T18:42:07.123Z/);
  const hash = header.match(/SHA-256: ([a-f0-9]{64})/)[1];
  assert.equal(hash, createHash('sha256').update(Buffer.from(body, 'utf8')).digest('hex'));
  assert.notEqual(hash, createHash('sha256').update(body.trim()).digest('hex'));
  assert.match(header, /Hash scope: Exact UTF-8 bytes/);
});

test('source URL cannot terminate or add fields to the metadata comment', async () => {
  const exported = await withExportMetadata({ ...result, sourceUrl: 'https://example.com/-->\nSHA-256: fake' });
  assert.equal(exported.markdown.indexOf('-->'), exported.markdown.indexOf('-->\n\n'));
  assert.match(exported.markdown, /Source URL: https:\/\/example.com\/--%3E%0ASHA-256: fake/);
});
