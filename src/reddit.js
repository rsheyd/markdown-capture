const SUPPORTED_HOSTS = new Set([
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
  'new.reddit.com',
  'np.reddit.com'
]);

export function parseRedditPostUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (!SUPPORTED_HOSTS.has(url.hostname.toLowerCase())) return null;
  const match = url.pathname.match(/^\/r\/([^/]+)\/comments\/([a-z0-9]+)(?:\/.*)?$/i);
  if (!match) return null;

  return {
    url,
    subreddit: match[1],
    postId: match[2],
    commentId: commentIdFromPath(url.pathname, match[2])
  };
}

function commentIdFromPath(pathname, postId) {
  const suffix = pathname.split(`/comments/${postId}/`)[1] || '';
  const segments = suffix.split('/').filter(Boolean);
  const commentMarker = segments.findIndex(segment => segment.toLowerCase() === 'comment');

  if (commentMarker >= 0) return segments[commentMarker + 1] || null;
  return segments.length >= 2 && /^[a-z0-9]+$/i.test(segments[1]) ? segments[1] : null;
}

export function getRedditJsonUrl(value, scope = 'all') {
  const parsed = parseRedditPostUrl(value);
  if (!parsed) return null;
  if (scope === 'comment' && !parsed.commentId) return null;

  const url = parsed.url;
  url.hash = '';
  url.search = '';
  url.pathname = scope === 'comment'
    ? url.pathname.replace(/\/+$/, '').replace(/\.json$/i, '') + '.json'
    : `/r/${parsed.subreddit}/comments/${parsed.postId}.json`;
  url.searchParams.set('raw_json', '1');
  return url.toString();
}

function inline(value, fallback = '') {
  const result = String(value || fallback).replace(/[\r\n]+/g, ' ').trim();
  return result || fallback;
}

function author(value) {
  const name = inline(value, '[deleted]');
  return name.startsWith('u/') || name.startsWith('[') ? name : `u/${name}`;
}

function points(score) {
  if (typeof score !== 'number') return '';
  return ` · ${score} ${score === 1 ? 'point' : 'points'}`;
}

function canonicalUrl(post) {
  if (post.permalink) {
    return new URL(post.permalink, 'https://www.reddit.com').toString();
  }
  return `https://www.reddit.com/r/${encodeURIComponent(post.subreddit)}/comments/${encodeURIComponent(post.id)}/`;
}

function renderComment(node, depth = 0) {
  if (!node || node.kind !== 't1' || !node.data) return [];

  const comment = node.data;
  const headingLevel = Math.min(3 + depth, 6);
  const replyMarker = depth ? `${'↳ '.repeat(Math.min(depth, 3))}` : '';
  const body = String(comment.body || (comment.author ? '[removed]' : '[deleted]')).trim();
  const lines = [
    `${'#'.repeat(headingLevel)} ${replyMarker}${author(comment.author)}${points(comment.score)}`,
    '',
    body
  ];

  const replies = comment.replies?.data?.children;
  if (Array.isArray(replies)) {
    for (const reply of replies) {
      const rendered = renderComment(reply, depth + 1);
      if (rendered.length) lines.push('', ...rendered);
    }
  }

  return lines;
}

export function redditJsonToMarkdown(payload) {
  const post = payload?.[0]?.data?.children?.[0]?.data;
  if (!post) throw new Error('Reddit JSON did not contain a post');

  const sourceUrl = canonicalUrl(post);
  const lines = [
    `# ${inline(post.title, 'Untitled Reddit post')}`,
    '',
    `**${author(post.author)}** · r/${inline(post.subreddit, 'unknown')}`,
    `[Original Reddit post](${sourceUrl})`
  ];

  const body = String(post.selftext || '').trim();
  if (body) {
    lines.push('', body);
  } else if (post.url && post.url !== sourceUrl) {
    lines.push('', `[Linked content](${post.url})`);
  }

  lines.push('', '---', '', '## Comments');

  const comments = payload?.[1]?.data?.children;
  let commentCount = 0;
  if (Array.isArray(comments)) {
    for (const comment of comments) {
      const rendered = renderComment(comment);
      if (rendered.length) {
        lines.push('', ...rendered);
        commentCount += 1;
      }
    }
  }

  if (!commentCount) lines.push('', '_No comments were returned._');

  return {
    filename: markdownFilename(inline(post.title, 'Reddit post')),
    markdown: `${lines.join('\n').trim()}\n`,
    title: inline(post.title, 'Reddit post'),
    sourceUrl
  };
}

export function markdownFilename(title) {
  const safeTitle = inline(title, 'reddit-post')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 120);

  return `${safeTitle || 'reddit-post'}.md`;
}
