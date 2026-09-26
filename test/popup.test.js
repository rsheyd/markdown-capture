import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

test('popup copies the current selection through the shared capture path', async () => {
  const dom = new JSDOM('<div id="source-label" hidden></div><section id="actions" hidden></section><p id="status"></p>', {
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

    await import('../src/popup.js');
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
