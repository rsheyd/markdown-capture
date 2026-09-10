import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import {
  captureFullPageDocument,
  captureGmailConversationDocument,
  captureWebpageDocument,
  contentToMarkdown,
  selectionToMarkdown,
  webpageMarkdownFilename
} from '../src/webpage.js';

async function fixture(name, url = `https://example.com/articles/${name}`) {
  const html = await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  return new JSDOM(html, { url }).window.document;
}

test('extracts article content while omitting page chrome and normalizing URLs', async () => {
  const document = await fixture('webpage-article.html');
  const result = captureWebpageDocument(document);

  assert.equal(result.title, 'Field Notes: Tidal Marshes');
  assert.equal(result.filename, 'Field Notes Tidal Marshes.md');
  assert.equal(result.sourceUrl, 'https://example.com/notes/tidal-marshes');
  assert.match(result.markdown, /^# Field Notes: Tidal Marshes/);
  assert.match(result.markdown, /\[A current survey map\]\(https:\/\/example\.com\/maps\/marsh\.pdf\)/);
  assert.match(result.markdown, /!\[A tidal marsh at low water\]\(https:\/\/example\.com\/images\/marsh\.jpg\)/);
  assert.doesNotMatch(result.markdown, /Pricing|Cookie settings/);
});

test('captures full multi-region page content with conservative generic cleanup', async () => {
  const document = await fixture('webpage-discussion.html', 'https://example.com/issues/38');
  document.title = 'Example issue with enough title words · Issue tracker';
  const result = captureFullPageDocument(document);

  assert.match(result.markdown, /Original issue body/);
  assert.match(result.markdown, /First useful comment/);
  assert.match(result.markdown, /Second useful comment/);
  assert.match(result.markdown, /Important compatibility note/);
  assert.equal(result.markdown.match(/New issue/g)?.length, 1);
  assert.equal(result.markdown.match(/Example issue with enough title words/g)?.length, 1);
  assert.match(result.markdown, /Draft reply/);
  assert.doesNotMatch(result.markdown, /Repository navigation|Submit comment|Draft inline editor|Hidden keyboard instructions/);
});

test('captures every loaded Gmail message without application chrome or duplicated quotes', async () => {
  const document = await fixture('gmail-conversation.html', 'https://mail.google.com/mail/u/0/#inbox/thread-id');
  const result = captureGmailConversationDocument(document);

  assert.equal(result.title, 'Re: Account migration');
  assert.equal(result.filename, 'Re Account migration.md');
  assert.match(result.markdown, /## Alex Rivera <alex@example\.com> — Sep 9, 2026, 4:15 PM/);
  assert.match(result.markdown, /to me\n\nCan you confirm the migration window/);
  assert.match(result.markdown, /## Sam Lee <sam@example\.net> — Sep 10, 2026, 8:03 AM/);
  assert.match(result.markdown, /The migration window is confirmed/);
  assert.match(result.markdown, /\*\*Sam Lee\*\* Operations/);
  assert.match(result.markdown, /\| Phase\s+\| Status\s+\|/);
  assert.doesNotMatch(result.markdown, /Inbox navigation|Reply|older duplicated message|cleardot/);
});

test('routes both generic capture actions through Gmail conversation capture', async () => {
  const document = await fixture('gmail-conversation.html', 'https://mail.google.com/mail/u/0/#inbox/thread-id');
  assert.match(captureWebpageDocument(document).markdown, /Alex Rivera/);
  assert.match(captureFullPageDocument(document).markdown, /Sam Lee/);
});

test('preserves forwarded or quoted content when Gmail exposes one loaded message', () => {
  const document = new JSDOM(`
    <title>Forwarded request - Gmail</title>
    <h2 class="hP">Forwarded request</h2>
    <section class="adn ads">
      <span class="gD" name="Alex" email="alex@example.com">Alex</span>
      <span class="g3" title="Sep 10, 2026, 9:00 AM">9:00 AM</span>
      <div class="a3s">
        <p>Please review the message below.</p>
        <div class="gmail_quote"><p>Forwarded message content that must remain.</p></div>
      </div>
    </section>
  `, { url: 'https://mail.google.com/mail/u/0/#inbox/thread-id' }).window.document;

  const result = captureGmailConversationDocument(document);
  assert.match(result.markdown, /Please review the message below/);
  assert.match(result.markdown, /Forwarded message content that must remain/);
});

test('preserves form content and meaningful control state in full-page capture', async () => {
  const result = captureFullPageDocument(await fixture('webpage-form.html'));

  assert.match(result.markdown, /Screening questions/);
  assert.match(result.markdown, /Please answer the following questions/);
  assert.match(result.markdown, /\(x\) Yes/);
  assert.match(result.markdown, /\( \) No/);
  assert.match(result.markdown, /Five years working with runtime platforms/);
  assert.match(result.markdown, /North America/);
  assert.match(result.markdown, /Available \[x\]/);
  assert.match(result.markdown, /Reference Case 42/);
  assert.doesNotMatch(result.markdown, /visual-secret|private-token|secret|Submit response/);
});

test('preserves fenced code blocks and inline code from documentation', async () => {
  const result = captureWebpageDocument(await fixture('webpage-documentation.html'));
  assert.match(result.markdown, /```(?:js)?\nconst widget/);
  assert.match(result.markdown, /`createWidget`/);
  assert.doesNotMatch(result.markdown, /Documentation navigation/);
});

test('preserves GFM tables', async () => {
  const result = captureWebpageDocument(await fixture('webpage-table.html'));
  assert.match(result.markdown, /\| Release\s+\| Status\s+\|/);
  assert.match(result.markdown, /\| Stable\s+\| Supported\s+\|/);
});

test('preserves ordered and nested unordered lists', async () => {
  const result = captureWebpageDocument(await fixture('webpage-lists.html'));
  assert.match(result.markdown, /1\.\s+Run the test suite\./);
  assert.match(result.markdown, /\s+-\s+Confirm the version\./);
});

test('converts HTML fragments with GFM structures through the shared converter', () => {
  const document = new JSDOM('', { url: 'https://example.com/base/' }).window.document;
  const markdown = contentToMarkdown('<p><del>Old</del> and <a href="next">new</a>.</p>', {
    baseUrl: document.URL,
    document
  });
  assert.equal(markdown, '~~Old~~ and [new](https://example.com/base/next).');
});

test('creates safe filenames and rejects documents without readable content', () => {
  assert.equal(webpageMarkdownFilename('Guide: One?'), 'Guide One.md');
  const document = new JSDOM('<title>Empty</title>', {
    url: 'https://example.com/empty'
  }).window.document;
  assert.throws(() => captureWebpageDocument(document), /Could not identify/);
});

test('checked-in browser bundle exposes the converter and captures a fixture', async () => {
  const [bundle, html] = await Promise.all([
    readFile(new URL('../vendor/webpage/webpage.js', import.meta.url), 'utf8'),
    readFile(new URL('./fixtures/webpage-article.html', import.meta.url), 'utf8')
  ]);
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.com/articles/field-notes'
  });
  dom.window.eval(bundle);
  const result = dom.window.MarkdownCaptureWebpage.captureWebpageDocument(dom.window.document);
  assert.equal(result.title, 'Field Notes: Tidal Marshes');
  assert.match(result.markdown, /Salt marshes sit between land and sea/);
  assert.equal(typeof dom.window.MarkdownCaptureWebpage.captureFullPageDocument, 'function');

  const paragraph = dom.window.document.querySelector('article p');
  const range = dom.window.document.createRange();
  range.selectNode(paragraph);
  const selection = dom.window.document.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  assert.match(
    dom.window.MarkdownCaptureWebpage.selectionToMarkdown(dom.window.document),
    /Salt marshes sit between land and sea/
  );
});

test('converts the selected DOM and makes its links and images absolute', () => {
  const dom = new JSDOM(`
    <article>
      <p id="first">Read <a href="../guide">the guide</a>.</p>
      <p id="second"><strong>Then</strong> inspect <img src="images/result.png" alt="the result">.</p>
    </article>
  `, { url: 'https://example.com/articles/current/' });
  const { document } = dom.window;
  const range = document.createRange();
  range.setStartBefore(document.querySelector('#first'));
  range.setEndAfter(document.querySelector('#second'));
  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  const markdown = selectionToMarkdown(document);
  assert.match(markdown, /\[the guide\]\(https:\/\/example\.com\/articles\/guide\)/);
  assert.match(markdown, /\*\*Then\*\*/);
  assert.match(markdown, /!\[the result\]\(https:\/\/example\.com\/articles\/current\/images\/result\.png\)/);
});

test('rejects an empty selection', () => {
  const document = new JSDOM('<p>Nothing selected</p>', {
    url: 'https://example.com/'
  }).window.document;
  assert.throws(() => selectionToMarkdown(document), /No page content is selected/);
});

test('converts every non-collapsed DOM range exposed by the selection', () => {
  const document = new JSDOM('<p id="one">First range</p><p id="two">Second range</p>', {
    url: 'https://example.com/'
  }).window.document;
  const ranges = ['one', 'two'].map(id => {
    const range = document.createRange();
    range.selectNode(document.querySelector(`#${id}`));
    return range;
  });
  document.getSelection = () => ({
    getRangeAt: index => ranges[index],
    isCollapsed: false,
    rangeCount: ranges.length
  });

  assert.equal(selectionToMarkdown(document), 'First range\n\nSecond range');
});
