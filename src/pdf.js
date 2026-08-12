const PDF_PATH_PATTERN = /\.pdf$/i;

export function isPdfUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && PDF_PATH_PATTERN.test(url.pathname);
  } catch {
    return false;
  }
}

export function pdfTitleFromUrl(value) {
  try {
    const name = new URL(value).pathname.split('/').filter(Boolean).at(-1) || 'PDF document';
    return decodeURIComponent(name)
      .replace(PDF_PATH_PATTERN, '')
      .replace(/[-_]+/g, ' ')
      .trim() || 'PDF document';
  } catch {
    return 'PDF document';
  }
}

export function pdfMarkdownFilename(title) {
  const safe = cleanText(title)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\.+$/g, '')
    .slice(0, 120)
    .trim();
  return `${safe || 'pdf-document'}.md`;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function itemHeight(item) {
  return Math.abs(item.height || item.transform?.[3] || 12);
}

function sortItemsTopToBottom(items) {
  return items.map((item, index) => ({ item, index })).sort((left, right) => {
    const leftY = Number(left.item.transform?.[5] || 0);
    const rightY = Number(right.item.transform?.[5] || 0);
    const lineTolerance = Math.max(2, Math.min(itemHeight(left.item), itemHeight(right.item)) * 0.5);
    const verticalDifference = rightY - leftY;

    if (Math.abs(verticalDifference) > lineTolerance) return verticalDifference;

    const leftX = Number(left.item.transform?.[4] || 0);
    const rightX = Number(right.item.transform?.[4] || 0);
    return leftX - rightX || left.index - right.index;
  }).map(({ item }) => item);
}

function itemsToLines(items) {
  const lines = [];
  let current = null;

  function finishLine() {
    if (current?.text.trim()) lines.push(current);
    current = null;
  }

  for (const item of sortItemsTopToBottom(items)) {
    const text = cleanText(item.str);
    if (!text) {
      if (item.hasEOL) finishLine();
      continue;
    }

    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);
    const height = itemHeight(item);
    const startsNewLine = current && Math.abs(y - current.y) > Math.max(2, height * 0.5);
    if (startsNewLine) finishLine();

    if (!current) {
      current = { text, x, y, height, endX: x + Number(item.width || 0) };
    } else {
      const gap = x - current.endX;
      const separator = gap > height * 0.08 ? ' ' : '';
      current.text += `${separator}${text}`;
      current.height = Math.max(current.height, height);
      current.endX = Math.max(current.endX, x + Number(item.width || 0));
    }

    if (item.hasEOL) finishLine();
  }

  finishLine();
  return lines;
}

export function pdfPageItemsToMarkdown(items) {
  const lines = itemsToLines(items);
  const paragraphs = [];
  let paragraph = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const previous = lines[index - 1];
    const verticalGap = previous ? Math.abs(previous.y - line.y) : 0;
    const startsParagraph = previous && verticalGap > Math.max(previous.height, line.height) * 1.4;

    if (startsParagraph && paragraph.length) {
      paragraphs.push(paragraph.join(' '));
      paragraph = [];
    }
    paragraph.push(line.text);
  }

  if (paragraph.length) paragraphs.push(paragraph.join(' '));
  return paragraphs.join('\n\n').trim();
}

export function pdfPagesToMarkdown({ pages, sourceUrl, title }) {
  const cleanTitle = cleanText(title) || pdfTitleFromUrl(sourceUrl);
  const body = pages.map(page => page.trim()).filter(Boolean).join('\n\n---\n\n');
  if (!body) {
    throw new Error('This PDF contains no extractable text. It may be scanned or image-only; OCR is not supported yet.');
  }

  return {
    filename: pdfMarkdownFilename(cleanTitle),
    markdown: `# ${cleanTitle}\n\n[Source PDF](${sourceUrl})\n\n${body}\n`,
    sourceUrl,
    title: cleanTitle
  };
}
