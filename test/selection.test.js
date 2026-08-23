import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { extractSelection, extractSelectionHtml } from '../src/selection.js';
import { contentToMarkdown } from '../src/webpage.js';

test('captures LinkedIn-like selected HTML before conversion', async () => {
  const html = await readFile(new URL('./fixtures/linkedin-selection.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://www.linkedin.com/feed/' });
  const { document } = dom.window;
  const conversation = document.querySelector('.conversation-event');
  const range = document.createRange();
  range.selectNodeContents(conversation);
  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  const selectionHtml = extractSelectionHtml(document);
  selection.removeAllRanges();
  const markdown = contentToMarkdown(selectionHtml, {
    baseUrl: document.baseURI,
    document
  });

  assert.match(markdown, /\[\*\*Meredith Barry\*\*\]\(https:\/\/www\.linkedin\.com\/in\/meredith-barry\)/);
  assert.match(markdown, /Hey Roman, killer background\.\n\nI’m partnered with/);
  assert.match(markdown, /\[Traversal\]\(https:\/\/www\.traversal\.com\/\)/);
});

test('captures the selection metadata needed by keyboard shortcuts', () => {
  const document = new JSDOM('<p>Select <strong>this</strong></p>', {
    url: 'https://example.com/article'
  }).window.document;
  const range = document.createRange();
  range.selectNodeContents(document.querySelector('p'));
  document.getSelection().addRange(range);

  assert.deepEqual(extractSelection(document), {
    html: 'Select <strong>this</strong>',
    text: 'Select this',
    sourceUrl: 'https://example.com/article'
  });
});

test('returns empty HTML when the live selection is unavailable', () => {
  const document = new JSDOM('<p>Nothing selected</p>', {
    url: 'https://example.com/'
  }).window.document;
  assert.equal(extractSelectionHtml(document), '');
  assert.equal(extractSelection(document), null);
});
