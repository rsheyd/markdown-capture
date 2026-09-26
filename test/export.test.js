import test from 'node:test';
import { createHash, webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';
import { detectSource } from '../src/adapters.js';
import { assertExportResult, runExport } from '../src/export.js';

// Node 18 does not expose Web Crypto globally by default.
globalThis.crypto ??= webcrypto;

const payload = [
  { data: { children: [{ data: {
    id: 'abc123',
    title: 'Export me',
    author: 'poster',
    subreddit: 'test',
    permalink: '/r/test/comments/abc123/export_me/',
    selftext: 'Body'
  } }] } },
  { data: { children: [] } }
];

test('routes copy output through shared orchestration', async () => {
  const tab = { id: 8, url: 'https://www.reddit.com/r/test/comments/abc123/export_me/' };
  const source = detectSource(tab);
  let copied = '';

  const result = await runExport({ source, actionId: 'reddit-all-copy', tab }, {
    fetchRedditJson: async () => payload,
    copy: async markdown => { copied = markdown; },
    download: async () => assert.fail('download should not run')
  });

  assert.equal(result.output, 'copy');
  assert.equal(copied, result.markdown);
  assert.match(copied, /^<!-- Markdown Capture metadata\nSource URL: https:/);
  assert.doesNotMatch(copied, /Original Reddit post|Captured at:|SHA-256:/);
});

test('routes download output with normalized filename', async () => {
  const tab = { id: 8, url: 'https://www.reddit.com/r/test/comments/abc123/export_me/' };
  const source = detectSource(tab);
  let downloaded;

  const result = await runExport({ source, actionId: 'reddit-all-download', tab, includeIntegrity: true }, {
    fetchRedditJson: async () => payload,
    copy: async () => assert.fail('copy should not run'),
    download: async exportResult => { downloaded = exportResult; }
  });

  assert.equal(result.output, 'download');
  assert.equal(downloaded.filename, 'Export me.md');
  const body = downloaded.markdown.slice(downloaded.markdown.indexOf('-->\n\n') + 5);
  assert.equal(downloaded.markdown.match(/SHA-256: ([a-f0-9]{64})/)[1], createHash('sha256').update(body, 'utf8').digest('hex'));
  assert.match(downloaded.markdown, /Captured at: \d{4}-\d\d-\d\dT.*Z/);
});

test('rejects disabled and malformed adapter output', async () => {
  const tab = { id: 8, url: 'https://www.reddit.com/r/test/comments/abc123/export_me/' };
  const source = detectSource(tab);
  await assert.rejects(
    runExport({ source, actionId: 'reddit-comment-copy', tab }, {}),
    /not available/
  );
  assert.throws(
    () => assertExportResult({ markdown: '# Incomplete' }),
    /no title/
  );
});

for (const url of ['https://example.com/page', 'https://mail.google.com/mail/u/0/#inbox/abc', 'https://example.com/report.pdf']) {
  test(`shared metadata wraps non-selection capture from ${url}`, async () => {
    const tab = { id: 8, url };
    const source = detectSource(tab);
    const capture = { markdown: '# Title\n\nContent\n', title: 'Title', sourceUrl: url, filename: 'Title.md' };
    let copied;
    const result = await runExport({ source, actionId: source.actions.find(action => action.output === 'copy').id, tab, includeIntegrity: true }, {
      captureWebpage: async () => capture,
      capturePdfAsMarkdown: async () => capture,
      copy: async markdown => { copied = markdown; }
    });
    assert.equal(copied, result.markdown);
    assert.match(copied, /^<!-- Markdown Capture metadata/);
    assert.ok(copied.includes(`Source URL: ${url}\n`));
    assert.ok(copied.endsWith(capture.markdown));
    assert.match(copied, /SHA-256: [a-f0-9]{64}/);
  });
}
