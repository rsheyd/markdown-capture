import { createHash, webcrypto } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

// Node 18 does not expose Web Crypto globally by default.
globalThis.crypto ??= webcrypto;

test('popup copies the current selection through the shared capture path', async () => {
  const dom = new JSDOM(readFileSync(new URL('../src/popup.html', import.meta.url), 'utf8'), {
    url: 'https://example.com'
  });
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;
  const originalChrome = globalThis.chrome;
  const messages = [];
  const copied = [];

  try {
    globalThis.document = dom.window.document;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText: async text => copied.push(text) } }
    });
    globalThis.chrome = {
      tabs: { query: async () => [{ id: 1, url: 'https://example.com/page' }] },
      scripting: { executeScript: async () => [{ result: true }] },
      runtime: {
        sendMessage: async message => {
          messages.push(message);
          return { ok: true, markdown: '**Selected text**' };
        }
      }
    };

    dom.window.localStorage.setItem('includeExportIntegrity', 'true');
    await import('../src/popup.js');
    const checkbox = document.querySelector('#include-integrity');
    assert.equal(checkbox.checked, true);
    checkbox.checked = false;
    checkbox.dispatchEvent(new dom.window.Event('change'));
    assert.equal(dom.window.localStorage.getItem('includeExportIntegrity'), 'false');
    checkbox.checked = true;
    const button = [...document.querySelectorAll('button')]
      .find(item => item.textContent === 'Copy selection');
    assert.ok(button);
    button.click();
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(messages, [{ type: 'capture-selection-markdown', includeIntegrity: true, includeDebug: false }]);
    assert.deepEqual(copied, ['**Selected text**']);
    assert.equal(document.querySelector('#status').textContent, 'Selection copied to clipboard.');
    const preserveButton = document.querySelector('[data-action-id="selection-preserve-copy"]');
    assert.equal(preserveButton.textContent, 'Copy selection (preserve source)');
    preserveButton.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(messages[1], { type: 'capture-selection-markdown', preserveSource: true, includeIntegrity: true, includeDebug: false });
    assert.deepEqual(copied, ['**Selected text**', '**Selected text**']);
    assert.equal(document.querySelector('[data-action-id="selection-debug"]'), null);

  } finally {
    globalThis.document = originalDocument;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    globalThis.chrome = originalChrome;
    dom.window.close();
  }
});

test('popup remembers integrity choice across openings and applies it to non-selection exports', async () => {
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;
  const originalChrome = globalThis.chrome;
  const html = readFileSync(new URL('../src/popup.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://extension.example' });
  const reopened = new JSDOM(html, { url: 'https://extension.example' });
  const copied = [];
  const saved = {};
  try {
    globalThis.document = dom.window.document;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => copied.push(text) } } });
    globalThis.chrome = {
      tabs: { query: async () => [{ id: 1, url: 'https://www.reddit.com/r/test/comments/abc123/title/' }] },
      storage: { local: {
        get: async keys => Object.fromEntries(keys.map(key => [key, saved[key]])),
        set: async values => { Object.assign(saved, values); }
      } },
      runtime: { sendMessage: async () => ({ ok: true, payload: [
        { data: { children: [{ data: { title: 'Title', permalink: '/r/test/comments/abc123/title/', selftext: 'Body' } }] } },
        { data: { children: [] } }
      ] }) }
    };
    await import('../src/popup.js?integrity-first');
    const checkbox = document.querySelector('#include-integrity');
    assert.equal(checkbox.checked, false);
    checkbox.checked = true;
    checkbox.dispatchEvent(new dom.window.Event('change'));
    const debug = document.querySelector('#include-debug');
    debug.checked = true;
    debug.dispatchEvent(new dom.window.Event('change'));
    await new Promise(resolve => setImmediate(resolve));
    globalThis.document = reopened.window.document;
    await import('../src/popup.js?integrity-reopened');
    assert.equal(document.querySelector('#include-integrity').checked, true);
    assert.equal(document.querySelector('#include-debug').checked, true);
    document.querySelector('[data-action-id="reddit-all-copy"]').click();
    for (let attempts = 0; attempts < 50 && !copied.length; attempts++) {
      await new Promise(resolve => setTimeout(resolve, 2));
    }
    assert.equal(copied.length, 1);
    assert.match(copied[0], /Captured at: .*Z\nSHA-256: [a-f0-9]{64}/);
    assert.match(copied[0], /Markdown Capture debug/);
    assert.doesNotMatch(copied[0], /Original Reddit post/);
  } finally {
    globalThis.document = originalDocument;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    globalThis.chrome = originalChrome;
    dom.window.close();
    reopened.window.close();
  }
});

test('service worker forwards popup preservation policy and installs one selection menu', async () => {
  const originalChrome = globalThis.chrome;
  const originalDocument = globalThis.document;
  const originalConverter = globalThis.MarkdownCaptureWebpage;
  const { contentToMarkdown } = await import('../src/webpage.js');
  const dom = new JSDOM('', { url: 'https://example.com/' });
  const callbacks = {};
  const menus = [];
  const written = [];
  const preferences = { includeExportIntegrity: false, includeDebugInfo: false };
  const html = '<p>Transfer submitted</p><button>Manage transfer</button><img alt="Statement" src="data:image/png;base64,AA">';
  try {
    globalThis.document = dom.window.document;
    globalThis.MarkdownCaptureWebpage = { contentToMarkdown };
    globalThis.chrome = {
      tabs: { query: async () => [{ id: 1, url: document.URL }] },
      runtime: {
        onInstalled: { addListener: fn => { callbacks.install = fn; } },
        onMessage: { addListener: fn => { callbacks.message = fn; } },
        getPlatformInfo: async () => ({ os: 'mac' })
      },
      commands: { onCommand: { addListener(fn) { callbacks.command = fn; } } },
      contextMenus: {
        onClicked: { addListener(fn) { callbacks.click = fn; } },
        removeAll: async () => {},
        create: async menu => { menus.push(menu); }
      },
      scripting: {
        executeScript: async options => {
          if (options.files) return [];
          if (options.injectImmediately) return [{ frameId: 0, result: { html, text: 'Transfer submitted', sourceUrl: document.URL } }];
          if (options.args?.length === 1) {
            written.push(options.args[0]);
            return [{ result: true }];
          }
          return [{ result: options.func(...options.args) }];
        }
      },
      storage: { local: { get: async () => preferences } },
      action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async () => {} }
    };
    await import('../src/background.js');
    callbacks.install();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(menus.length, 1);
    assert.equal(menus[0].id, 'copy-selection-markdown');
    for (const preserveSource of [false, true]) {
      const response = await new Promise(resolve => {
        assert.equal(callbacks.message({ type: 'capture-selection-markdown', preserveSource }, {}, resolve), true);
      });
      assert.equal(response.ok, true);
      assert.equal(response.markdown.includes('Manage transfer'), preserveSource);
      assert.match(response.markdown, /Statement/);
      assert.doesNotMatch(response.markdown, /data:/);
    }
    const enriched = await new Promise(resolve => {
      callbacks.message({ type: 'capture-selection-markdown', includeIntegrity: true, includeDebug: true }, {}, resolve);
    });
    assert.equal(enriched.ok, true);
    assert.match(enriched.markdown, /Captured at: .*Z\nSHA-256: [a-f0-9]{64}/);
    assert.match(enriched.markdown, /Markdown Capture debug/);
    assert.match(enriched.markdown, /selectionHtml/);
    const selectionBody = enriched.markdown.slice(enriched.markdown.indexOf('-->\n\n') + 5);
    assert.equal(enriched.markdown.match(/SHA-256: ([a-f0-9]{64})/)[1], createHash('sha256').update(selectionBody).digest('hex'));
    preferences.includeExportIntegrity = true;
    preferences.includeDebugInfo = true;
    callbacks.click({ menuItemId: 'copy-selection-markdown', frameId: 0, frameUrl: document.URL, selectionText: 'Transfer submitted' }, { id: 1, url: document.URL });
    for (let attempts = 0; attempts < 30 && written.length < 1; attempts++) await new Promise(resolve => setTimeout(resolve, 2));
    callbacks.command('copy-selection-markdown');
    for (let attempts = 0; attempts < 30 && written.length < 2; attempts++) await new Promise(resolve => setTimeout(resolve, 2));
    assert.equal(written.length, 2);
    for (const output of written) {
      assert.match(output, /SHA-256: [a-f0-9]{64}/);
      assert.match(output, /Markdown Capture debug/);
    }
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.document = originalDocument;
    globalThis.MarkdownCaptureWebpage = originalConverter;
    dom.window.close();
  }
});

test('webpage popup leads with main content and offers page-content fallback after extraction failure', async () => {
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;
  const originalChrome = globalThis.chrome;
  const dom = new JSDOM(readFileSync(new URL('../src/popup.html', import.meta.url), 'utf8'), { url: 'https://example.com/' });
  const copied = [];
  const captures = [];
  try {
    globalThis.document = dom.window.document;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => copied.push(value) } } });
    globalThis.chrome = {
      tabs: { query: async () => [{ id: 1, url: 'https://example.com/results', title: 'Results' }] },
      scripting: { executeScript: async options => {
        if (options.files) return [];
        if (options.target.allFrames) return [{ result: false }];
        captures.push(options.args[1]);
        if (options.args[1] === 'main') throw new Error('Could not identify the main content on this page.');
        return [{ result: { markdown: '# Results\n\nFirst result\n', title: 'Results', sourceUrl: 'https://example.com/results', filename: 'Results.md' } }];
      } }
    };
    await import('../src/popup.js?no-selection-fallback');
    assert.equal(document.querySelector('#primary-action').textContent, 'Copy main content');
    assert.equal(document.querySelector('#more-options').open, false);
    assert.ok(document.querySelector('[data-action-id="webpage-full-copy"]'));
    assert.equal(document.querySelector('[data-action-id="selection-preserve-copy"]'), null);
    document.querySelector('#primary-action').click();
    await new Promise(resolve => setImmediate(resolve));
    const fallback = document.querySelector('#status [data-action-id="webpage-full-copy"]');
    assert.equal(fallback.textContent, 'Copy page content');
    fallback.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(captures, ['main', 'full']);
    assert.equal(copied.length, 1);
    assert.match(copied[0], /First result/);
  } finally {
    globalThis.document = originalDocument;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    globalThis.chrome = originalChrome;
    dom.window.close();
  }
});

test('Craigslist popup shows the detected gallery count before download', async () => {
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;
  const originalChrome = globalThis.chrome;
  const dom = new JSDOM(readFileSync(new URL('../src/popup.html', import.meta.url), 'utf8'), { url: 'https://extension.example' });
  const scripts = [];
  try {
    globalThis.document = dom.window.document;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async () => {} } } });
    globalThis.chrome = {
      tabs: { query: async () => [{ id: 8, url: 'https://www.craigslist.org/view/d/bristol-trailer/nBYjPFY3H9nyYoEUw9Wbq4' }] },
      scripting: { executeScript: async options => {
        scripts.push(options);
        return options.files ? [] : [{ result: 13 }];
      } }
    };
    await import('../src/popup.js?craigslist-image-count');
    assert.equal(document.querySelector('#source-label').textContent, 'Craigslist post');
    assert.equal(document.querySelector('[data-action-id="craigslist-images-download"]').textContent, 'Download with images (13 detected)');
    assert.deepEqual(scripts[0].files, ['vendor/webpage/webpage.js']);
    assert.equal(scripts[1].target.tabId, 8);
  } finally {
    globalThis.document = originalDocument;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    globalThis.chrome = originalChrome;
    dom.window.close();
  }
});

test('Craigslist image download requests host access on click and cancels when declined', async () => {
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;
  const originalChrome = globalThis.chrome;
  const dom = new JSDOM(readFileSync(new URL('../src/popup.html', import.meta.url), 'utf8'), { url: 'https://extension.example' });
  const requests = [];
  const scripts = [];
  try {
    globalThis.document = dom.window.document;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async () => {} } } });
    globalThis.chrome = {
      tabs: { query: async () => [{ id: 8, url: 'https://www.craigslist.org/view/d/bristol-trailer/nBYjPFY3H9nyYoEUw9Wbq4' }] },
      permissions: { request: options => { requests.push(options); return Promise.resolve(false); } },
      scripting: { executeScript: async options => {
        scripts.push(options);
        return options.files ? [] : [{ result: 13 }];
      } }
    };
    await import('../src/popup.js?craigslist-permission-denied');
    const before = scripts.length;
    document.querySelector('[data-action-id="craigslist-images-download"]').click();
    assert.deepEqual(requests, [{ origins: ['https://images.craigslist.org/*'] }]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(scripts.length, before);
    assert.match(document.querySelector('#status').textContent, /Craigslist image access was not granted/);
  } finally {
    globalThis.document = originalDocument;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    globalThis.chrome = originalChrome;
    dom.window.close();
  }
});
