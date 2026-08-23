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

function webpageResult(document, sourceUrl, content, parsedTitle) {
  const title = cleanText(parsedTitle || document.title, 'Untitled webpage');
  const resolvedSourceUrl = canonicalUrl(document, sourceUrl);
  const body = contentToMarkdown(content, {
    baseUrl: document.baseURI || sourceUrl,
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

function normalizedWords(value) {
  return new Set(cleanText(value).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
}

function substantiallyMatchesTitle(heading, title) {
  const headingWords = normalizedWords(heading);
  const titleWords = normalizedWords(title);
  if (headingWords.size < 4 || !titleWords.size) return false;
  let shared = 0;
  for (const word of headingWords) {
    if (titleWords.has(word)) shared += 1;
  }
  return shared / headingWords.size >= 0.8;
}

function removeVisuallyHiddenContent(source, clone, document) {
  const getComputedStyle = document.defaultView?.getComputedStyle;
  if (!getComputedStyle) return;
  const sourceElements = [...source.querySelectorAll('*')];
  const clonedElements = [...clone.querySelectorAll('*')];
  sourceElements.forEach((element, index) => {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      clonedElements[index]?.remove();
    }
  });
}

function removeAdjacentDuplicateLinks(root) {
  root.querySelectorAll('a + a').forEach(link => {
    const previous = link.previousElementSibling;
    const text = cleanText(link.textContent);
    if (text && text.length <= 120 && text === cleanText(previous?.textContent)
      && link.getAttribute('href') === previous?.getAttribute('href')) {
      link.remove();
    }
  });
}

function pruneEmptyContent(root) {
  const selector = 'h1,h2,h3,h4,h5,h6,p,li,div,section,article,header,footer';
  [...root.querySelectorAll(selector)].reverse().forEach(node => {
    if (!cleanText(node.textContent) && !node.querySelector('img,video,audio,table,pre,hr')) {
      node.remove();
    }
  });
}

export function captureWebpageDocument(document, sourceUrl = document.URL) {
  const parsed = new Readability(document.cloneNode(true)).parse();
  if (!parsed?.content) {
    throw new Error('Could not identify the main content on this page.');
  }

  return webpageResult(document, sourceUrl, parsed.content, parsed.title);
}

export function captureFullPageDocument(document, sourceUrl = document.URL) {
  const source = document.querySelector('main') || document.body;
  if (!source) throw new Error('The page did not contain capturable content.');

  const content = source.cloneNode(true);
  removeVisuallyHiddenContent(source, content, document);
  content.querySelectorAll([
    'script',
    'style',
    'noscript',
    'template',
    'nav',
    'form',
    'button',
    'input',
    'select',
    'textarea',
    'dialog',
    'menu',
    '[contenteditable]:not([contenteditable="false"])',
    '[hidden]',
    '[aria-hidden="true"]',
    '[role="navigation"]',
    '[role="dialog"]',
    '[role="menu"]',
    '[role="menubar"]',
    '[role="textbox"]'
  ].join(',')).forEach(node => node.remove());

  const firstHeading = content.querySelector('h1,h2');
  if (firstHeading && substantiallyMatchesTitle(firstHeading.textContent, document.title)) {
    firstHeading.remove();
  }
  removeAdjacentDuplicateLinks(content);
  pruneEmptyContent(content);

  return webpageResult(document, sourceUrl, content.innerHTML, document.title);
}

export function selectionToMarkdown(document, sourceUrl = document.URL) {
  const selection = document.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) {
    throw new Error('No page content is selected.');
  }

  const container = document.createElement('div');
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    if (range.collapsed) continue;
    const section = document.createElement('div');
    section.append(range.cloneContents());
    container.append(section);
  }

  const markdown = contentToMarkdown(container.innerHTML, {
    baseUrl: document.baseURI || sourceUrl,
    document
  });
  if (!markdown) throw new Error('The selection did not contain convertible content.');
  return markdown;
}
