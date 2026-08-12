import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDocument } from '../vendor/pdfjs/pdf.mjs';
import {
  isPdfUrl,
  pdfMarkdownFilename,
  pdfPageItemsToMarkdown,
  pdfPagesToMarkdown,
  pdfTitleFromUrl
} from '../src/pdf.js';

test('recognizes straightforward HTTP PDF URLs', () => {
  assert.equal(isPdfUrl('https://example.com/files/report.pdf?download=1'), true);
  assert.equal(isPdfUrl('http://example.com/REPORT.PDF'), true);
  assert.equal(isPdfUrl('https://example.com/view?id=12'), false);
  assert.equal(isPdfUrl('file:///tmp/report.pdf'), false);
});

test('derives a readable title from a PDF URL', () => {
  assert.equal(pdfTitleFromUrl('https://example.com/a/useful_report.pdf'), 'useful report');
  assert.equal(pdfTitleFromUrl('not a URL'), 'PDF document');
});

test('creates a safe Markdown filename for a PDF', () => {
  assert.equal(pdfMarkdownFilename('Annual: Report?'), 'Annual Report.md');
  assert.equal(pdfMarkdownFilename(''), 'pdf-document.md');
});

test('reconstructs simple lines and paragraphs from positioned text items', () => {
  const result = pdfPageItemsToMarkdown([
    { str: 'First', transform: [1, 0, 0, 12, 10, 100], width: 25, height: 12 },
    { str: 'line', transform: [1, 0, 0, 12, 40, 100], width: 20, height: 12, hasEOL: true },
    { str: 'continues', transform: [1, 0, 0, 12, 10, 86], width: 40, height: 12, hasEOL: true },
    { str: 'New paragraph', transform: [1, 0, 0, 12, 10, 55], width: 70, height: 12 }
  ]);

  assert.equal(result, 'First line continues\n\nNew paragraph');
});

test('prioritizes visual top-to-bottom order over PDF content-stream order', () => {
  const result = pdfPageItemsToMarkdown([
    { str: 'Bottom section', transform: [1, 0, 0, 12, 10, 20], width: 70, height: 12, hasEOL: true },
    { str: 'Right item', transform: [1, 0, 0, 12, 200, 70], width: 55, height: 12, hasEOL: true },
    { str: 'Page heading', transform: [1, 0, 0, 20, 10, 100], width: 110, height: 20, hasEOL: true },
    { str: 'Left item', transform: [1, 0, 0, 12, 10, 70], width: 45, height: 12 }
  ]);

  assert.equal(result, 'Page heading\n\nLeft item Right item\n\nBottom section');
});

test('wraps extracted pages with title and source metadata', () => {
  const result = pdfPagesToMarkdown({
    pages: ['First page.', 'Second page.'],
    sourceUrl: 'https://example.com/report.pdf',
    title: 'Annual Report'
  });
  assert.match(result.markdown, /^# Annual Report/);
  assert.equal(result.filename, 'Annual Report.md');
  assert.match(result.markdown, /\[Source PDF\]\(https:\/\/example.com\/report.pdf\)/);
  assert.match(result.markdown, /First page\.\n\n---\n\nSecond page\./);
});

test('rejects PDFs without extractable text', () => {
  assert.throws(
    () => pdfPagesToMarkdown({ pages: ['', ''], sourceUrl: 'https://example.com/scan.pdf', title: 'Scan' }),
    /OCR is not supported/
  );
});

test('extracts the checked-in text PDF fixture with the bundled PDF.js build', async () => {
  const data = new Uint8Array(await readFile(new URL('./fixtures/basic-text.pdf', import.meta.url)));
  const document = await getDocument({ data, verbosity: 0 }).promise;
  const page = await document.getPage(1);
  const content = await page.getTextContent();
  const markdown = pdfPageItemsToMarkdown(content.items);

  assert.match(markdown, /Markdown Capture PDF fixture/);
  assert.match(markdown, /This text should be extractable locally/);
  await document.destroy();
});
