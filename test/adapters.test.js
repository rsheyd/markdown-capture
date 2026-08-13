import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adapters,
  detectSource,
  getAdapter,
  getSourceAction
} from '../src/adapters.js';

test('registers adapters with the common contract', () => {
  assert.deepEqual(adapters.map(adapter => adapter.id), ['reddit', 'pdf']);
  for (const adapter of adapters) {
    assert.equal(typeof adapter.detect, 'function');
    assert.equal(typeof adapter.actions, 'function');
    assert.equal(typeof adapter.capture, 'function');
  }
});

test('detects Reddit and exposes only applicable thread actions', () => {
  const post = detectSource({
    url: 'https://www.reddit.com/r/test/comments/abc123/a_post/',
    title: 'A post'
  });
  assert.equal(post.id, 'reddit');
  assert.equal(getSourceAction(post, 'reddit-comment-copy').enabled, false);

  const comment = detectSource({
    url: 'https://www.reddit.com/r/test/comments/abc123/comment/def456/',
    title: 'A comment'
  });
  assert.equal(getSourceAction(comment, 'reddit-comment-copy').enabled, true);
});

test('detects direct and Gmail-viewer PDFs', () => {
  assert.equal(detectSource({ url: 'https://example.com/report.pdf' }).id, 'pdf');
  const gmail = detectSource({
    url: 'https://mail.google.com/mail/u/0/#inbox/example?projector=1&messagePartId=0.1'
  });
  assert.equal(gmail.id, 'pdf');
  assert.equal(gmail.detection.gmail, true);
});

test('returns no source for unsupported tabs and no adapter for unknown ids', () => {
  assert.equal(detectSource({ url: 'https://example.com/article' }), null);
  assert.equal(getAdapter('unknown'), null);
});

test('Reddit adapter captures a normalized result through injected acquisition', async () => {
  const source = detectSource({
    id: 7,
    url: 'https://www.reddit.com/r/test/comments/abc123/a_post/',
    title: 'A post'
  });
  const adapter = getAdapter(source.id);
  const action = getSourceAction(source, 'reddit-all-copy');
  const payload = [
    { data: { children: [{ data: {
      id: 'abc123',
      title: 'A post',
      author: 'poster',
      subreddit: 'test',
      permalink: '/r/test/comments/abc123/a_post/',
      selftext: 'Body'
    } }] } },
    { data: { children: [] } }
  ];

  const result = await adapter.capture({ tab: { id: 7, url: source.detection.parsed.url.toString() }, action }, {
    fetchRedditJson: async (tabId, jsonUrl) => {
      assert.equal(tabId, 7);
      assert.match(jsonUrl, /abc123\.json/);
      return payload;
    }
  });

  assert.deepEqual(Object.keys(result).sort(), ['filename', 'markdown', 'sourceUrl', 'title']);
  assert.equal(result.filename, 'A post.md');
});

test('PDF adapter delegates acquisition and preserves the normalized result', async () => {
  const tab = { id: 4, url: 'https://example.com/report.pdf', title: 'Report.pdf' };
  const source = detectSource(tab);
  const adapter = getAdapter(source.id);
  const expected = {
    filename: 'Report.md',
    markdown: '# Report\n',
    sourceUrl: tab.url,
    title: 'Report'
  };

  const result = await adapter.capture({ tab, detection: source.detection }, {
    capturePdfAsMarkdown: async options => {
      assert.equal(options.fetchUrl, tab.url);
      return expected;
    },
    fetchGmailPdfAttachment: async () => assert.fail('Gmail acquisition should not run')
  });
  assert.equal(result, expected);
});
