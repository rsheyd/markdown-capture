import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webcrypto, createHash } from 'node:crypto';
import { captureFullPageDocument, captureGmailConversationDocument } from '../src/webpage.js';
import { localizeImages, createImageZip, imageLimits } from '../src/image-export.js';
import { detectSource } from '../src/adapters.js';
import { runExport } from '../src/export.js';
globalThis.crypto ??= webcrypto;
function capture() {
  const dom = new JSDOM('<title>Photo note</title><main><p>See <a href="/photo.png">photo</a></p><img src="/photo.png" alt="A [photo]"><img src="/photo.png"><img src="/missing.png"><button><img src="/control.png"></button><pre><code>![sample](https://example.com/photo.png)</code></pre></main>', { url: 'https://example.com/page' });
  return captureFullPageDocument(dom.window.document, dom.window.document.URL, true);
}
test('downloads captured images once, preserves failed images, links and code', async () => {
  const input = capture();
  assert.equal(input.imageAssets.length, 3);
  const calls = [];
  const result = await localizeImages(input, async url => {
    calls.push(url);
    if (url.endsWith('missing.png')) throw new Error('HTTP 404');
    return { bytes: new Uint8Array([1, 2, 3]), type: 'image/png' };
  });
  assert.equal(calls.length, 2);
  assert.equal(result.assets.length, 1);
  assert.equal(result.imageFailures.length, 1);
  assert.match(result.markdown, /Photo%20note-images\/image-1.png/);
  assert.match(result.markdown, /https:\/\/example.com\/missing.png/);
  assert.match(result.markdown, /\[photo\]\(https:\/\/example.com\/photo.png\)/);
  assert.match(result.markdown, /!\[sample\]\(https:\/\/example.com\/photo.png\)/);
  assert.doesNotMatch(result.markdown, /markdown-capture-image-/);
});
test('rejects non-images, oversized assets and unsupported URLs without broken placeholders', async () => {
  const input = { filename: 'a.md', markdown: '![a](<a>) ![b](<b>) ![c](<c>)', imageAssets: [
    { reference: 'a', url: 'https://example.com/a' }, { reference: 'b', url: 'https://example.com/b' }, { reference: 'c', url: 'file:///private.png' }
  ] };
  const result = await localizeImages(input, async url => ({ type: url.endsWith('/a') ? 'text/html' : 'image/png', bytes: new Uint8Array(imageLimits.bytes + 1) }));
  assert.equal(result.assets.length, 0);
  assert.equal(result.imageFailures.length, 3);
  assert.match(result.markdown, /file:\/\/\/private.png/);
});
test('ZIP passes independent CRC check and contains exact Markdown and image bytes', async () => {
  const result = await localizeImages(capture(), async () => ({ bytes: new Uint8Array([1, 2, 3]), type: 'image/png' }));
  const dir = mkdtempSync(join(tmpdir(), 'markdown-images-'));
  const zip = join(dir, 'export.zip');
  try {
    writeFileSync(zip, new Uint8Array(await createImageZip(result).arrayBuffer()));
    execFileSync('/usr/bin/unzip', ['-t', zip]);
    assert.equal(execFileSync('/usr/bin/unzip', ['-p', zip, result.filename], { encoding: 'utf8' }), result.markdown);
    assert.deepEqual([...execFileSync('/usr/bin/unzip', ['-p', zip, result.assets[0].path])], [1, 2, 3]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('image download hashes the rewritten Markdown and routes only to ZIP output', async () => {
  const tab = { id: 1, url: 'https://example.com/page' };
  let downloaded;
  const result = await runExport({ tab, source: detectSource(tab), actionId: 'webpage-images-download', includeIntegrity: true }, {
    captureWebpage: async (_id, _url, mode, images) => { assert.equal(mode, 'full'); assert.equal(images, true); return capture(); },
    fetchImage: async () => ({ bytes: new Uint8Array([1]), type: 'image/png' }),
    downloadImages: async value => { downloaded = value; },
    download: () => assert.fail('plain download called')
  });
  assert.equal(downloaded.markdown, result.markdown);
  const body = result.markdown.slice(result.markdown.indexOf('-->\n\n') + 5);
  assert.equal(result.markdown.match(/SHA-256: ([a-f0-9]{64})/)[1], createHash('sha256').update(body).digest('hex'));
  assert.match(downloaded.markdown, /image-1.png/);
});

test('debug-enabled image ZIP records detected URLs and fetch failures inside hashed Markdown', async () => {
  const tab = { id: 1, url: 'https://example.com/page' };
  const result = await runExport({ tab, source: detectSource(tab), actionId: 'webpage-images-download', includeIntegrity: true, includeDebug: true }, {
    captureWebpage: async () => capture(),
    fetchImage: async (_tabId, url) => {
      if (url.endsWith('missing.png')) throw new Error('Failed to fetch');
      return { bytes: new Uint8Array([1]), type: 'image/png' };
    },
    downloadImages: async () => {}
  });
  const body = result.markdown.slice(result.markdown.indexOf('-->\n\n') + 5);
  assert.equal(result.markdown.match(/SHA-256: ([a-f0-9]{64})/)[1], createHash('sha256').update(body).digest('hex'));
  const report = JSON.parse(body.match(/<!-- Markdown Capture debug\n([\s\S]*?)\n-->/)[1]);
  assert.equal(report.detectedImageUrls.length, 3);
  assert.equal(report.savedImagePaths.length, 1);
  assert.match(report.imageFailures[0].reason, /Failed to fetch/);
  assert.equal(report.imageFailures[0].url, 'https://example.com/missing.png');
});

test('Gmail image action writes an attached photo into the shared ZIP result', async () => {
  const tab = { id: 4, url: 'https://mail.google.com/mail/u/0/#inbox/thread-id' };
  const document = new JSDOM('<title>Photos - Gmail</title><h2 class="hP">Photos</h2><section class="adn ads"><span class="gD" email="alex@example.com">Alex</span><div class="a3s">Attached is the photo.</div><div><a href="https://mail.google.com/mail/u/0/?view=att&attid=0.1" title="photo.jpg">Download</a></div></section>', { url: tab.url }).window.document;
  let downloaded;
  const result = await runExport({ tab, source: detectSource(tab), actionId: 'gmail-images-download' }, {
    captureWebpage: async (_tabId, _url, mode, images) => {
      assert.deepEqual([mode, images], ['gmail', true]);
      return captureGmailConversationDocument(document, tab.url, images);
    },
    fetchImage: async (_tabId, url) => {
      assert.match(url, /view=att/);
      return { bytes: new Uint8Array([1, 2, 3]), type: 'image/jpeg' };
    },
    downloadImages: async value => { downloaded = value; }
  });
  assert.equal(result.assets.length, 1);
  assert.equal(downloaded.assets[0].path, 'Photos-images/image-1.jpg');
  assert.match(result.markdown, /Photos-images\/image-1\.jpg/);
  assert.equal(result.imageFailures.length, 0);
});
