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

export function contentToMarkdown(content, { baseUrl, document, imageAssets, preserveSource = false }) {
  const container = document.createElement('div');
  container.innerHTML = content;
  // Keep content and recorded state, rather than the controls used to act on it.
  container.querySelectorAll('[hidden], [aria-hidden="true"]').forEach(node => node.remove());
  if (!preserveSource) container.querySelectorAll([
    '[role="menu"]', '[role="menubar"]', '[role="menuitem"]',
    '[role="menuitemcheckbox"]', '[role="menuitemradio"]',
    '[role="toolbar"]', '[role="tooltip"]',
    'button:not([role="checkbox"]):not([role="radio"]):not([aria-pressed="true"])',
    '[role="button"]:not([aria-pressed="true"])',
    '.msg-s-event-listitem__actions-container'
  ].join(',')).forEach(node => node.remove());
  normalizeContentUrls(container, baseUrl);
  // Ordinary Markdown references portable images; binary assets belong in ZIP exports.
  const portableImage = image => /^https?:/i.test(image.getAttribute('src') || '');
  container.querySelectorAll('img').forEach(image => {
    const alt = (image.getAttribute('alt') || '').trim();
    const nearbyText = Array.from(image.parentElement.childNodes, node => node.textContent).join(' ').trim().toLowerCase();
    const statusLabel = alt.replace(/ status$/i, '').toLowerCase();
    const decorative = image.getAttribute('role') === 'presentation' || image.getAttribute('role') === 'none' || image.getAttribute('alt') === '';
    const redundantStatus = / status$/i.test(alt) && nearbyText.split(/\s+/).includes(statusLabel);
    if (!preserveSource && (decorative || redundantStatus)) {
      image.remove();
    } else if (!imageAssets && !portableImage(image)) {
      image.replaceWith(document.createTextNode(` ${alt || '[Image]'} `));
    }
  });


  const turndown = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    headingStyle: 'atx'
  });
  turndown.use(gfm);
  if (imageAssets) turndown.addRule('localImageAsset', {
    filter: 'img',
    replacement(_content, node) {
      const url = node.getAttribute('src');
      if (!url) return '';
      const reference = `markdown-capture-image-${globalThis.crypto.randomUUID()}`;
      imageAssets.push({ url, reference });
      const alt = (node.getAttribute('alt') || '').replace(/[\\[\]]/g, '\\$&').replace(/\s+/g, ' ');
      return `![${alt}](<${reference}>)`;
    }
  });
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

function webpageResult(document, sourceUrl, content, parsedTitle, captureImages = false) {
  const imageAssets = captureImages ? [] : undefined;
  const title = cleanText(parsedTitle || document.title, 'Untitled webpage');
  const resolvedSourceUrl = canonicalUrl(document, sourceUrl);
  const body = contentToMarkdown(content, {
    baseUrl: document.baseURI || sourceUrl,
    document,
    imageAssets
  });
  if (!body) throw new Error('The page did not contain readable content.');

  return {
    ...(imageAssets ? { imageAssets } : {}),
    filename: webpageMarkdownFilename(title),
    markdown: `# ${title}\n\n${body}\n`,
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

const gmailImageExtensions = /\.(?:jpe?g|png|gif|webp|avif|bmp|heic|heif)\b/i;

function gmailImageAttachments(message, document) {
  const attachments = [];
  const seen = new Set();
  for (const link of message.querySelectorAll('a[href*="view=att"]')) {
    let url;
    try { url = new URL(link.getAttribute('href'), document.baseURI); } catch { continue; }
    if (url.protocol !== 'https:' || url.hostname !== 'mail.google.com' || url.searchParams.get('view') !== 'att' || seen.has(url.href)) continue;
    const siblingLabels = [...(link.parentElement?.children || [])].filter(node => node !== link).map(node => node.textContent);
    const labels = [link.getAttribute('download'), url.searchParams.get('filename'), url.searchParams.get('name'), link.getAttribute('aria-label'), link.getAttribute('title'), link.textContent, ...siblingLabels];
    let label = labels.map(value => cleanText(value)).find(value => gmailImageExtensions.test(value));
    if (!label) {
      const parentLabel = cleanText(link.parentElement?.textContent);
      if ((parentLabel.match(/\.[a-z0-9]{2,6}\b/gi) || []).length === 1 && gmailImageExtensions.test(parentLabel)) label = parentLabel;
    }
    if (!label) continue;
    const filename = label.replace(/^(?:download|preview)(?:\s+attachment)?\s+/i, '')
      .match(/([^/\\<>:"|?*]+\.(?:jpe?g|png|gif|webp|avif|bmp|heic|heif))\b/i)?.[1]?.trim() || 'Image attachment';
    attachments.push({ url: url.href, filename });
    seen.add(url.href);
  }
  return attachments;
}

export function captureGmailConversationDocument(document, sourceUrl = document.URL, captureImages = false) {
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
    const originalBody = message.querySelector('.a3s');
    const body = originalBody.cloneNode(true);
    cleanGmailMessageBody(body, { removeQuotedHistory: messages.length > 1 });
    const attachments = captureImages ? gmailImageAttachments(message, document) : [];
    if (captureImages) {
      const originals = [...originalBody.querySelectorAll('img')];
      const clones = [...body.querySelectorAll('img')];
      for (const [imageIndex, cloned] of clones.entries()) {
        const original = originals.find(image => image.getAttribute('src') === cloned.getAttribute('src'));
        const url = original?.currentSrc || cloned.getAttribute('src');
        if (url) cloned.setAttribute('src', url);
        if (!cleanText(cloned.getAttribute('alt'))) cloned.setAttribute('alt', `Inline image ${imageIndex + 1}`);
      }
    }
    if (!cleanText(body.textContent) && !body.querySelector('img,table,pre') && !attachments.length) return;

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
    if (attachments.length) {
      const headingNode = document.createElement('h3');
      headingNode.textContent = 'Image attachments';
      conversation.append(headingNode);
      for (const attachment of attachments) {
        const paragraph = document.createElement('p');
        const image = document.createElement('img');
        image.setAttribute('src', attachment.url);
        image.setAttribute('alt', attachment.filename);
        paragraph.append(image);
        conversation.append(paragraph);
      }
    }
  });

  if (!conversation.childNodes.length) {
    throw new Error('The loaded Gmail messages did not contain readable content.');
  }
  return webpageResult(document, sourceUrl, conversation.innerHTML, subject, captureImages);
}

export function captureWebpageDocument(document, sourceUrl = document.URL) {
  if (isGmailDocument(document)) return captureGmailConversationDocument(document, sourceUrl);
  const parsed = new Readability(document.cloneNode(true)).parse();
  if (!parsed?.content) {
    throw new Error('Could not identify the main content on this page.');
  }

  return webpageResult(document, sourceUrl, parsed.content, parsed.title);
}

export function captureFullPageDocument(document, sourceUrl = document.URL, captureImages = false) {
  if (isGmailDocument(document)) return captureGmailConversationDocument(document, sourceUrl);
  const source = document.querySelector('main') || document.body;
  if (!source) throw new Error('The page did not contain capturable content.');

  const content = source.cloneNode(true);
  const clonedBySource = removeVisuallyHiddenContent(source, content, document);
  serializeFormControls(source, content, clonedBySource);
  if (captureImages) {
    for (const [original, cloned] of clonedBySource) {
      if (original.nodeName === 'IMG') {
        const url = original.currentSrc || original.getAttribute('src') || original.getAttribute('data-src');
        if (url) cloned.setAttribute('src', url);
      }
    }
  }
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

  return webpageResult(document, sourceUrl, content.innerHTML, document.title, captureImages);
}

export function craigslistGalleryUrls(document) {
  const urls = [];
  const seen = new Set();
  const add = value => {
    if (!value) return;
    const url = absoluteUrl(value, document.baseURI);
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };
  const fullSizeUrl = value => {
    if (!value) return null;
    const id = value.match(/^(?:\d+:)?([A-Za-z0-9_-]+)$/)?.[1];
    if (id) return `https://images.craigslist.org/${id}_1200x900.jpg`;
    const url = absoluteUrl(value, document.baseURI);
    if (!/^https?:\/\/images\.craigslist\.org\//i.test(url)) return null;
    return url.replace(/_(?:50x50c|300x300|600x450)(?=\.[a-z]+(?:$|[?#]))/i, '_1200x900');
  };

  const gallery = document.querySelector('.gallery, #thumbs');
  if (!gallery) return urls;
  const thumbnails = document.querySelector('#thumbs') || gallery;
  for (const link of thumbnails.querySelectorAll('a[href]')) add(fullSizeUrl(link.getAttribute('href')));
  if (urls.length) return urls;
  for (const item of [gallery, ...gallery.querySelectorAll('[data-ids]')]) {
    for (const entry of (item.getAttribute('data-ids') || '').split(',')) add(fullSizeUrl(entry.trim()));
  }
  for (const item of gallery.querySelectorAll('[data-imgid], a, img')) {
    const image = item.matches('img') ? item : item.querySelector('img');
    const url = fullSizeUrl(item.getAttribute('href'))
      || fullSizeUrl(image?.getAttribute('data-imgid'))
      || fullSizeUrl(image?.getAttribute('data-src'))
      || fullSizeUrl(image?.getAttribute('src'))
      || fullSizeUrl(item.getAttribute('data-imgid'));
    add(url);
  }
  if (!urls.length) add(fullSizeUrl(document.querySelector('#iwi, .gallery img')?.getAttribute('src')));
  return urls;
}

export function captureCraigslistDocument(document, sourceUrl = document.URL, captureImages = false) {
  const title = cleanText(document.querySelector('#titletextonly')?.textContent || document.querySelector('h1')?.textContent || document.title, 'Craigslist post');
  const post = document.querySelector('#postingbody');
  if (!post) throw new Error('Could not find the Craigslist post content.');
  const content = document.createElement('div');
  const price = cleanText(document.querySelector('.price')?.textContent);
  if (price) {
    const line = document.createElement('p');
    line.textContent = `Price: ${price}`;
    content.append(line);
  }
  const attributes = document.querySelectorAll('.attrgroup .attr, .attrgroup > span');
  if (attributes.length) {
    const details = document.createElement('ul');
    for (const item of attributes) {
      const value = item.matches('.attr')
        ? cleanText(Array.from(item.children, child => cleanText(child.textContent)).filter(Boolean).join(' '))
        : cleanText(item.textContent);
      if (!value) continue;
      const line = document.createElement('li');
      line.textContent = value;
      details.append(line);
    }
    if (details.children.length) content.append(details);
  }
  const body = post.cloneNode(true);
  body.querySelectorAll('.print-information, .qr-code-container, script, style').forEach(node => node.remove());
  content.append(body);
  const gallery = craigslistGalleryUrls(document);
  if (gallery.length) {
    const heading = document.createElement('h2');
    heading.textContent = 'Photos';
    content.append(heading);
    for (const [index, url] of gallery.entries()) {
      const paragraph = document.createElement('p');
      const image = document.createElement('img');
      image.setAttribute('src', url);
      image.setAttribute('alt', `Photo ${index + 1}`);
      paragraph.append(image);
      content.append(paragraph);
    }
  }
  return webpageResult(document, sourceUrl, content.innerHTML, title, captureImages);
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
