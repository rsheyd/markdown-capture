import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

function cleanText(value, fallback = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function absoluteUrl(value, baseUrl) {
  if (!value) return value;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

export function webpageMarkdownFilename(title) {
  const safe = cleanText(title, 'webpage')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/[. ]+$/g, '')
    .slice(0, 120)
    .trim();
  return `${safe || 'webpage'}.md`;
}

export function normalizeContentUrls(root, baseUrl) {
  root.querySelectorAll('a[href]').forEach(link => {
    link.setAttribute('href', absoluteUrl(link.getAttribute('href'), baseUrl));
  });
  root.querySelectorAll('img[src]').forEach(image => {
    image.setAttribute('src', absoluteUrl(image.getAttribute('src'), baseUrl));
  });
  return root;
}

export function contentToMarkdown(content, { baseUrl, document }) {
  const container = document.createElement('div');
  container.innerHTML = content;
  normalizeContentUrls(container, baseUrl);

  const turndown = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    headingStyle: 'atx'
  });
  turndown.use(gfm);
  turndown.addRule('fencedCodeBlockWithLanguage', {
    filter(node) {
      return node.nodeName === 'PRE' && node.firstElementChild?.nodeName === 'CODE';
    },
    replacement(_content, node) {
      const code = node.firstElementChild;
      const language = code.className.match(/(?:^|\s)language-([^\s]+)/)?.[1] || '';
      const value = code.textContent.replace(/\n$/, '');
      return `\n\n\`\`\`${language}\n${value}\n\`\`\`\n\n`;
    }
  });
  turndown.addRule('gfmStrikethrough', {
    filter: ['del', 's', 'strike'],
    replacement(content) {
      return `~~${content}~~`;
    }
  });
  turndown.remove(['script', 'style', 'noscript', 'template']);
  return turndown.turndown(container).trim();
}

function canonicalUrl(document, fallbackUrl) {
  const value = document.querySelector('link[rel~="canonical"]')?.getAttribute('href');
  return absoluteUrl(value, fallbackUrl) || fallbackUrl;
}

export function captureWebpageDocument(document, sourceUrl = document.URL) {
  const parsed = new Readability(document.cloneNode(true)).parse();
  if (!parsed?.content) {
    throw new Error('Could not identify the main content on this page.');
  }

  const title = cleanText(parsed.title || document.title, 'Untitled webpage');
  const resolvedSourceUrl = canonicalUrl(document, sourceUrl);
  const body = contentToMarkdown(parsed.content, {
    baseUrl: resolvedSourceUrl,
    document
  });
  if (!body) throw new Error('The page did not contain readable content.');

  return {
    filename: webpageMarkdownFilename(title),
    markdown: `# ${title}\n\n[Source page](${resolvedSourceUrl})\n\n${body}\n`,
    sourceUrl: resolvedSourceUrl,
    title
  };
}
