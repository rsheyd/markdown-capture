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
  // Keep content and recorded state, rather than the controls used to act on it.
  container.querySelectorAll([
    '[hidden]', '[aria-hidden="true"]',
    '[role="menu"]', '[role="menubar"]', '[role="menuitem"]',
    '[role="menuitemcheckbox"]', '[role="menuitemradio"]',
    '[role="toolbar"]', '[role="tooltip"]',
    'button:not([role="checkbox"]):not([role="radio"]):not([aria-pressed="true"])',
    '[role="button"]:not([aria-pressed="true"])',
    '.msg-s-event-listitem__actions-container'
  ].join(',')).forEach(node => node.remove());
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
  turndown.addRule('formControlState', {
    filter(node) {
      return node.nodeName === 'SPAN' && node.hasAttribute('data-markdown-capture-control-state');
    },
    replacement(_content, node) {
      return node.getAttribute('data-markdown-capture-control-state');
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
  const sourceElements = [...source.querySelectorAll('*')];
  const clonedElements = [...clone.querySelectorAll('*')];
  const clonedBySource = new Map(sourceElements.map((element, index) => [element, clonedElements[index]]));
  const getComputedStyle = document.defaultView?.getComputedStyle;
  if (!getComputedStyle) return clonedBySource;
  sourceElements.forEach((element, index) => {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      clonedElements[index]?.remove();
    }
  });
  return clonedBySource;
}

function replaceControl(control, replacement, root) {
  if (!root.contains(control)) return;
  if (replacement) control.replaceWith(replacement);
  else control.remove();
}

function serializeFormControls(source, clone, clonedBySource) {
  const sourceControls = [...source.querySelectorAll('input,select,textarea')];

  sourceControls.forEach(control => {
    const clonedControl = clonedBySource.get(control);
    if (!clonedControl || !clone.contains(clonedControl)) return;

    const replacement = clone.ownerDocument.createElement(
      control.nodeName === 'TEXTAREA' ? 'div' : 'span'
    );

    if (control.nodeName === 'SELECT') {
      replacement.textContent = [...control.selectedOptions]
        .map(option => cleanText(option.textContent || option.value))
        .filter(Boolean)
        .join(', ');
    } else if (control.nodeName === 'TEXTAREA') {
      replacement.textContent = control.value;
    } else {
      const type = cleanText(control.type).toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        const state = type === 'checkbox'
          ? (control.checked ? '[x]' : '[ ]')
          : (control.checked ? '(x)' : '( )');
        replacement.textContent = state;
        replacement.setAttribute('data-markdown-capture-control-state', state);
      } else if (!['button', 'file', 'hidden', 'image', 'password', 'reset', 'submit'].includes(type)) {
        replacement.textContent = control.value;
      }
    }

    replaceControl(clonedControl, cleanText(replacement.textContent) ? replacement : null, clone);
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

function isGmailDocument(document) {
  try {
    return new URL(document.URL).hostname === 'mail.google.com';
  } catch {
    return false;
  }
}

function unwrapElement(element) {
  element.replaceWith(...element.childNodes);
}

function cleanGmailMessageBody(body, { removeQuotedHistory = false } = {}) {
  const removableSelectors = [
    'script',
    'style',
    'noscript',
    'template',
    'button',
    '[role="button"]',
    '[aria-hidden="true"]',
    '.gmail_extra'
  ];
  if (removeQuotedHistory) removableSelectors.push('.gmail_quote');
  body.querySelectorAll(removableSelectors.join(',')).forEach(node => node.remove());

  body.querySelectorAll('img').forEach(image => {
    const source = image.getAttribute('src') || '';
    const width = Number.parseInt(image.getAttribute('width') || '', 10);
    const height = Number.parseInt(image.getAttribute('height') || '', 10);
    if (source.includes('/images/cleardot.gif') || width === 1 || height === 1) image.remove();
  });

  body.querySelectorAll('table').forEach(table => {
    const presentation = table.getAttribute('role') === 'presentation';
    const hasHeadings = Boolean(table.querySelector('th'));
    if (presentation || !hasHeadings) {
      table.querySelectorAll('tr').forEach(row => {
        [...row.querySelectorAll(':scope > td')].slice(0, -1).forEach(cell => {
          cell.append(body.ownerDocument.createTextNode(' '));
        });
        const separator = body.ownerDocument.createElement('br');
        row.append(separator);
      });
      [...table.querySelectorAll('tbody,thead,tfoot,tr,td')].reverse().forEach(unwrapElement);
      unwrapElement(table);
    }
  });

  pruneEmptyContent(body);
}

function gmailMessageMetadata(message) {
  const senderNode = message.querySelector('.gD[email], [data-hovercard-id][email]');
  const senderName = cleanText(senderNode?.getAttribute('name') || senderNode?.textContent);
  const senderEmail = cleanText(senderNode?.getAttribute('email'));
  const sender = senderName && senderEmail && senderName !== senderEmail
    ? `${senderName} <${senderEmail}>`
    : senderName || senderEmail;
  const timestampNode = message.querySelector('.g3[title], [data-tooltip*="20"][title]');
  const timestamp = cleanText(timestampNode?.getAttribute('title') || timestampNode?.textContent);
  const recipients = cleanText(message.querySelector('.hb')?.textContent);
  return { recipients, sender, timestamp };
}

export function captureGmailConversationDocument(document, sourceUrl = document.URL) {
  if (!isGmailDocument(document)) throw new Error('This is not a Gmail conversation.');

  const messages = [...document.querySelectorAll('.adn.ads, .adn')]
    .filter((message, index, all) => message.querySelector('.a3s')
      && !all.some(other => other !== message && other.contains(message)));
  if (!messages.length) {
    throw new Error('Could not find any loaded messages. Open the conversation and expand the messages, then try again.');
  }

  const subject = cleanText(
    document.querySelector('h2.hP, [data-thread-perm-id] h2')?.textContent,
    cleanText(document.title.replace(/\s+-\s+Gmail\s*$/i, ''), 'Gmail conversation')
  );
  const conversation = document.createElement('div');
  messages.forEach((message, index) => {
    const body = message.querySelector('.a3s').cloneNode(true);
    cleanGmailMessageBody(body, { removeQuotedHistory: messages.length > 1 });
    if (!cleanText(body.textContent) && !body.querySelector('img,table,pre')) return;

    const { recipients, sender, timestamp } = gmailMessageMetadata(message);
    const heading = [sender || 'Unknown sender', timestamp].filter(Boolean).join(' — ');
    if (index) conversation.append(document.createElement('hr'));
    const headingNode = document.createElement('h2');
    headingNode.textContent = heading;
    conversation.append(headingNode);
    if (recipients) {
      const metadata = document.createElement('p');
      metadata.textContent = recipients;
      conversation.append(metadata);
    }
    conversation.append(body);
  });

  if (!conversation.childNodes.length) {
    throw new Error('The loaded Gmail messages did not contain readable content.');
  }
  return webpageResult(document, sourceUrl, conversation.innerHTML, subject);
}

export function captureWebpageDocument(document, sourceUrl = document.URL) {
  if (isGmailDocument(document)) return captureGmailConversationDocument(document, sourceUrl);
  const parsed = new Readability(document.cloneNode(true)).parse();
  if (!parsed?.content) {
    throw new Error('Could not identify the main content on this page.');
  }

  return webpageResult(document, sourceUrl, parsed.content, parsed.title);
}

export function captureFullPageDocument(document, sourceUrl = document.URL) {
  if (isGmailDocument(document)) return captureGmailConversationDocument(document, sourceUrl);
  const source = document.querySelector('main') || document.body;
  if (!source) throw new Error('The page did not contain capturable content.');

  const content = source.cloneNode(true);
  const clonedBySource = removeVisuallyHiddenContent(source, content, document);
  serializeFormControls(source, content, clonedBySource);
  content.querySelectorAll([
    'script',
    'style',
    'noscript',
    'template',
    'nav',
    'button',
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
