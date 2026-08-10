import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRedditJsonUrl,
  markdownFilename,
  parseRedditPostUrl,
  redditJsonToMarkdown
} from '../src/reddit.js';

function listing(post, comments = []) {
  return [
    { data: { children: [{ kind: 't3', data: post }] } },
    { data: { children: comments } }
  ];
}

const post = {
  id: 'abc123',
  title: 'A useful post',
  author: 'poster',
  subreddit: 'test',
  permalink: '/r/test/comments/abc123/a_useful_post/',
  selftext: 'Post **body**.'
};

test('recognizes normal Reddit post URL variants', () => {
  for (const host of ['reddit.com', 'www.reddit.com', 'old.reddit.com', 'new.reddit.com', 'np.reddit.com']) {
    assert.ok(parseRedditPostUrl(`https://${host}/r/test/comments/abc123/title/`));
  }
  assert.equal(parseRedditPostUrl('https://www.reddit.com/r/test/'), null);
  assert.equal(parseRedditPostUrl('https://example.com/r/test/comments/abc123/title/'), null);
});

test('builds a JSON URL without a duplicate suffix', () => {
  const result = new URL(getRedditJsonUrl(
    'https://old.reddit.com/r/test/comments/abc123/title.json?sort=top#comment'
  ));
  assert.equal(result.hostname, 'old.reddit.com');
  assert.equal(result.pathname, '/r/test/comments/abc123/title.json');
  assert.equal(result.searchParams.get('sort'), 'top');
  assert.equal(result.searchParams.get('raw_json'), '1');
  assert.equal(result.hash, '');
});

test('renders a post and recursive comments while ignoring more objects', () => {
  const payload = listing(post, [
    {
      kind: 't1',
      data: {
        author: 'first',
        score: 42,
        body: 'First comment',
        replies: { data: { children: [
          { kind: 'more', data: {} },
          {
            kind: 't1',
            data: { author: 'reply', score: 1, body: 'Nested reply', replies: '' }
          }
        ] } }
      }
    },
    { kind: 'more', data: {} }
  ]);

  const result = redditJsonToMarkdown(payload);
  assert.match(result.markdown, /^# A useful post/m);
  assert.match(result.markdown, /\*\*u\/poster\*\* · r\/test/);
  assert.match(result.markdown, /### u\/first · 42 points/);
  assert.match(result.markdown, /#### ↳ u\/reply · 1 point/);
  assert.doesNotMatch(result.markdown, /undefined/);
});

test('handles link posts and deleted comments', () => {
  const payload = listing({
    ...post,
    selftext: '',
    url: 'https://example.com/article'
  }, [
    { kind: 't1', data: { author: null, score: null, body: '', replies: '' } }
  ]);

  const result = redditJsonToMarkdown(payload).markdown;
  assert.match(result, /\[Linked content\]\(https:\/\/example.com\/article\)/);
  assert.match(result, /\[deleted\]/);
});

test('reports an empty returned comment listing', () => {
  assert.match(redditJsonToMarkdown(listing(post)).markdown, /_No comments were returned\._/);
});

test('creates a safe Markdown filename', () => {
  assert.equal(markdownFilename(' Question: <one> / two? '), 'Question one two.md');
  assert.equal(markdownFilename(''), 'reddit-post.md');
  assert.ok(markdownFilename('x'.repeat(200)).length <= 123);
});

test('rejects malformed Reddit data', () => {
  assert.throws(() => redditJsonToMarkdown([]), /did not contain a post/);
});
