import { webcrypto } from 'node:crypto';
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
      .find(item => item.textContent === 'Copy Selection as Markdown');
    assert.ok(button);
    button.click();
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(messages, [{ type: 'capture-selection-markdown' }]);
    assert.deepEqual(copied, ['**Selected text**']);
    assert.equal(document.querySelector('#status').textContent, 'Selection copied to clipboard.');
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
  try {
    globalThis.document = dom.window.document;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => copied.push(text) } } });
    globalThis.chrome = {
      tabs: { query: async () => [{ id: 1, url: 'https://www.reddit.com/r/test/comments/abc123/title/' }] },
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
    reopened.window.localStorage.setItem('includeExportIntegrity', dom.window.localStorage.getItem('includeExportIntegrity'));
    globalThis.document = reopened.window.document;
    await import('../src/popup.js?integrity-reopened');
    assert.equal(document.querySelector('#include-integrity').checked, true);
    document.querySelector('[data-action-id="reddit-all-copy"]').click();
    for (let attempts = 0; attempts < 50 && !copied.length; attempts++) {
      await new Promise(resolve => setTimeout(resolve, 2));
    }
    assert.equal(copied.length, 1);
    assert.match(copied[0], /Captured at: .*Z\nSHA-256: [a-f0-9]{64}/);
    assert.doesNotMatch(copied[0], /Original Reddit post/);
  } finally {
    globalThis.document = originalDocument;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    globalThis.chrome = originalChrome;
    dom.window.close();
    reopened.window.close();
  }
});
