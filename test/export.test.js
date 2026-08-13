import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSource } from '../src/adapters.js';
import { assertExportResult, runExport } from '../src/export.js';

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
});

test('routes download output with normalized filename', async () => {
  const tab = { id: 8, url: 'https://www.reddit.com/r/test/comments/abc123/export_me/' };
  const source = detectSource(tab);
  let downloaded;

  const result = await runExport({ source, actionId: 'reddit-all-download', tab }, {
    fetchRedditJson: async () => payload,
    copy: async () => assert.fail('copy should not run'),
    download: async exportResult => { downloaded = exportResult; }
  });

  assert.equal(result.output, 'download');
  assert.equal(downloaded.filename, 'Export me.md');
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
