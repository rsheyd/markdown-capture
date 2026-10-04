import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import {
  captureCraigslistDocument,
  captureFullPageDocument,
  captureGmailConversationDocument,
  captureWebpageDocument,
  craigslistGalleryUrls,
  contentToMarkdown,
  selectionToMarkdown,
  webpageMarkdownFilename
} from '../src/webpage.js';

test('Craigslist export retains post details and every full-size gallery image in order', () => {
  const url = 'https://providence.craigslist.org/rvs/d/bristol-scamp-trailer/1234567890.html';
  const document = new JSDOM(`<!doctype html><title>Scamp trailer - craigslist</title><h1><span id="titletextonly">2014 Scamp 13 with Bathroom</span><span class="price">$13,500</span></h1><div class="attrgroup"><span>condition: good</span><span>length (feet): 13</span></div><div class="gallery"><img id="iwi" src="https://images.craigslist.org/first_600x450.jpg"><div id="thumbs" data-ids="1:first,2:second_photo,3:third"><a data-imgid="1:first"><img src="https://images.craigslist.org/first_50x50c.jpg"></a><a data-imgid="2:second_photo"><img src="https://images.craigslist.org/second_photo_50x50c.jpg"></a><a data-imgid="3:third"><img src="https://images.craigslist.org/third_50x50c.jpg"></a></div></div><section id="postingbody">Lightweight fiberglass trailer.</section>`, { url }).window.document;
  const result = captureCraigslistDocument(document, url, true);
  assert.match(result.markdown, /^# 2014 Scamp 13 with Bathroom/);
  assert.match(result.markdown, /Price: \$13,500/);
  assert.match(result.markdown, /condition: good/);
  assert.match(result.markdown, /Lightweight fiberglass trailer/);
  assert.deepEqual(result.imageAssets.map(image => image.url), ['first', 'second_photo', 'third'].map(id => `https://images.craigslist.org/${id}_1200x900.jpg`));
  assert.equal((result.markdown.match(/!\[Photo \d\]/g) || []).length, 3);
  assert.doesNotMatch(result.markdown, /50x50c|600x450/);
});

test('Craigslist export keeps image links in plain Markdown and rejects a missing post body', () => {
  const url = 'https://boston.craigslist.org/rvs/d/test/1234567890.html';
  const document = new JSDOM('<h1 id="titletextonly">Trailer</h1><div id="thumbs"><a><img src="https://images.craigslist.org/abc_300x300.jpg"></a></div><section id="postingbody">A trailer.</section>', { url }).window.document;
  const result = captureCraigslistDocument(document);
  assert.match(result.markdown, /https:\/\/images\.craigslist\.org\/abc_1200x900\.jpg/);
  document.querySelector('#postingbody').remove();
  assert.throws(() => captureCraigslistDocument(document), /Could not find the Craigslist post content/);
});

test('current Craigslist gallery links resolve all full-size images without losing the filename prefix', () => {
  const url = 'https://www.craigslist.org/view/d/bristol-trailer/nBYjPFY3H9nyYoEUw9Wbq4';
  const thumbs = Array.from({ length: 13 }, (_, index) => `<a class="thumb" data-imgid="photo_${index}" href="https://images.craigslist.org/00a0a_photo_${index}_0CI0t2_600x450.jpg"><img src="https://images.craigslist.org/00a0a_photo_${index}_0CI0t2_50x50c.jpg"></a>`).join('');
  const document = new JSDOM(`<h1><span id="titletextonly">Trailer</span><span class="price">$13,500</span></h1><div class="gallery"><div class="swipe"><div class="slide" data-imgid="photo_0"><img src="https://images.craigslist.org/00a0a_photo_0_0CI0t2_1200x900.jpg"></div></div><div id="thumbs">${thumbs}</div></div><div class="attrgroup"><div class="attr condition"><span class="labl">condition:</span><span class="valu">good</span></div></div><section id="postingbody">Lightweight trailer.</section>`, { url }).window.document;
  const urls = craigslistGalleryUrls(document);
  assert.equal(urls.length, 13);
  assert.equal(urls[0], 'https://images.craigslist.org/00a0a_photo_0_0CI0t2_1200x900.jpg');
  assert.equal(urls[12], 'https://images.craigslist.org/00a0a_photo_12_0CI0t2_1200x900.jpg');
  const result = captureCraigslistDocument(document, url, true);
  assert.equal(result.imageAssets.length, 13);
  assert.match(result.markdown, /condition: good/);
  assert.doesNotMatch(result.markdown, /600x450|50x50c/);
});

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

test('Gmail image ZIP capture includes inline photos and attached images without changing plain capture', () => {
  const url = 'https://mail.google.com/mail/u/0/#inbox/thread-id';
  const document = new JSDOM(`<!doctype html><title>Pictures - Gmail</title><h2 class="hP">Pictures</h2><section class="adn ads"><span class="gD" name="Alex" email="alex@example.com">Alex</span><div class="a3s"><p>See these photos.</p><img src="https://mail.google.com/mail/u/0/inline.jpg" alt=""><img src="https://mail.google.com/mail/u/0/images/cleardot.gif" alt=""></div><div class="aQH"><a href="https://mail.google.com/mail/u/0/?view=att&attid=0.1" title="Download attachment beach.png">Download</a><a href="https://mail.google.com/mail/u/0/?view=att&attid=0.2" title="Download attachment notes.pdf">Download</a></div></section>`, { url }).window.document;
  const plain = captureGmailConversationDocument(document);
  assert.doesNotMatch(plain.markdown, /beach\.png|Inline image/);
  const result = captureGmailConversationDocument(document, url, true);
  assert.match(result.markdown, /See these photos/);
  assert.match(result.markdown, /Inline image 1/);
  assert.match(result.markdown, /beach\.png/);
  assert.doesNotMatch(result.markdown, /notes\.pdf|cleardot/);
  assert.deepEqual(result.imageAssets.map(image => image.url), [
    'https://mail.google.com/mail/u/0/inline.jpg',
    'https://mail.google.com/mail/u/0/?view=att&attid=0.1'
  ]);
});

test('Gmail image ZIP captures an attachment-only message without borrowing another file label', () => {
  const url = 'https://mail.google.com/mail/u/0/#inbox/thread-id';
  const document = new JSDOM('<title>Attachments - Gmail</title><h2 class="hP">Attachments</h2><section class="adn ads"><span class="gD" email="alex@example.com">Alex</span><div class="a3s"></div><div class="aQH"><div><a href="https://mail.google.com/mail/u/0/?view=att&attid=0.1">Download</a><span>beach.png</span></div><div><a href="https://mail.google.com/mail/u/0/?view=att&attid=0.2">Download</a><span>notes.pdf</span></div></div></section>', { url }).window.document;
  const result = captureGmailConversationDocument(document, url, true);
  assert.deepEqual(result.imageAssets.map(image => image.url), ['https://mail.google.com/mail/u/0/?view=att&attid=0.1']);
  assert.match(result.markdown, /!\[beach\.png\]/);
  assert.doesNotMatch(result.markdown, /notes\.pdf/);
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

test('omits action controls across sources while preserving content and recorded reactions', () => {
  const document = new JSDOM('', { url: 'https://example.com/' }).window.document;
  const markdown = contentToMarkdown(`
    <p>A message with ❤️ in its content.</p>
    <div role="toolbar"><a href="/reply">Reply</a></div>
    <ul role="menu"><li role="menuitem">🙈</li><li>😂</li></ul>
    <button>Open Emoji Keyboard</button><span role="button">More options</span>
    <div role="tooltip">Hover help</div><div hidden>Hidden options</div>
    <div class="msg-s-event-listitem__actions-container"><span>Other message actions</span></div>
    <button role="checkbox" aria-checked="true">👍 1</button>
    <button aria-pressed="true">❤️ 2</button>
    <p><a href="/details">Message details</a></p>
  `, { baseUrl: document.URL, document });

  assert.match(markdown, /A message with ❤️ in its content/);
  assert.match(markdown, /👍 1/);
  assert.match(markdown, /❤️ 2/);
  assert.match(markdown, /\[Message details\]\(https:\/\/example.com\/details\)/);
  assert.doesNotMatch(markdown, /🙈|😂|Reply|Open Emoji Keyboard|More options|Hover help|Hidden options|Other message actions/);
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
  const policies = dom.window.MarkdownCaptureWebpage;
  const selectedHtml = '<p>Submitted</p><button>Manage</button><img alt="Statement" src="data:image/png;base64,AA">';
  for (const preserveSource of [false, true]) {
    const output = policies.contentToMarkdown(selectedHtml, { document: dom.window.document, baseUrl: dom.window.document.URL, preserveSource });
    assert.equal(output.includes('Manage'), preserveSource);
    assert.match(output, /Statement/);
    assert.doesNotMatch(output, /data:/);
  }


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

test('readable copy keeps transfer content without embedding thumbnail and status payloads', () => {
  const document = new JSDOM('', { url: 'https://example.com/confirmation' }).window.document;
  const html = `<h2>Transfer details</h2><p>From</p><p>Example HSA</p>
    <h2>Attachment details</h2><div><img alt="statement.pdf" src="data:image/jpeg;base64,${'A'.repeat(500000)}"><span>158 kB</span></div>
    <h2>Next steps</h2><div><img alt="complete status" src="data:image/svg+xml,encoded"><span>Complete</span><p>Your request is submitted</p></div>
    <img alt="" src="https://example.com/decorative.svg"><img alt="Chart" src="/chart.png">
    <p><a href="/next">Next transfer</a></p>`;
  const options = { document, baseUrl: document.URL };
  const markdown = contentToMarkdown(html, options);
  assert.ok(markdown.length < 500);
  assert.doesNotMatch(markdown, /data:|decorative|complete status/);
  assert.match(markdown, /statement\.pdf/);
  assert.match(markdown, /Complete/);
  assert.match(markdown, /Your request is submitted/);
  assert.match(markdown, /!\[Chart\]\(https:\/\/example.com\/chart.png\)/);
  assert.match(markdown, /\[Next transfer\]\(https:\/\/example.com\/next\)/);
  const preserved = contentToMarkdown(html, { ...options, preserveSource: true });
  assert.match(preserved, /complete status/);
  assert.match(preserved, /decorative.svg/);
  assert.doesNotMatch(preserved, /data:/);
});

test('both copy policies preserve meaning and structure and avoid temporary image URLs', () => {
  const document = new JSDOM('', { url: 'https://example.com/' }).window.document;
  const html = `<h2>Instructions</h2><ul><li>First</li><li>Second</li></ul>
    <pre><code>const x = 1;</code></pre><table><tr><th>Label</th><th>Value</th></tr><tr><td>Date</td><td>October 13</td></tr></table>
    <img src="blob:https://example.com/123" alt="Important diagram"><img src="data:image/png;base64,AA">
    <button>Manage transfer</button><p hidden>Hidden implementation</p>`;
  for (const preserveSource of [false, true]) {
    const markdown = contentToMarkdown(html, { document, baseUrl: document.URL, preserveSource });
    assert.match(markdown, /## Instructions/);
    assert.match(markdown, /-\s+First\n-\s+Second/);
    assert.match(markdown, /```\nconst x = 1;\n```/);
    assert.match(markdown, /\| Date \| October 13 \|/);
    assert.match(markdown, /Important diagram/);
    assert.match(markdown, /Image/);
    assert.doesNotMatch(markdown, /blob:|data:|Hidden implementation/);
    assert.equal(markdown.includes('Manage transfer'), preserveSource);
  }
});

test('image packaging retains meaningful embedded assets for the ZIP path', () => {
  const document = new JSDOM('').window.document;
  const imageAssets = [];
  const markdown = contentToMarkdown('<img alt="Diagram" src="data:image/png;base64,AA">', {
    document, baseUrl: 'https://example.com/', imageAssets
  });
  assert.equal(imageAssets.length, 1);
  assert.equal(imageAssets[0].url, 'data:image/png;base64,AA');
  assert.match(markdown, /markdown-capture-image-/);
});
