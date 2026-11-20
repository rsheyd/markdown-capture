import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { collectThreadsHistory } from '../src/threads.js';

function virtualConversation({ hasStart = true, skipMiddle = false, group = false } = {}) {
  let scrollTop = 50;
  const linkTo = handle => ({ getAttribute: () => `/@${handle}`, querySelector: () => ({}) });
  const self = { ...linkTo('local_user'), textContent: 'Profile' };
  const grid = {
    isConnected: true,
    contains: () => false,
    clientHeight: 100,
    scrollHeight: 300,
    get scrollTop() { return scrollTop; },
    set scrollTop(position) { scrollTop = Math.min(200, Math.max(0, position)); },
    get firstElementChild() {
      const firstElementChild = {
        hasAttribute: () => false,
        querySelector: () => hasStart ? linkTo('peer') : null
      };
      const rows = ['Oldest', 'Repeated message', 'Repeated message', 'Newest'].map((text, index) => {
        const rendered = (index === 0 && scrollTop < 65) ||
          (index === 1 && scrollTop < 140 && !skipMiddle) ||
          (index === 2 && scrollTop >= 65) ||
          (index === 3 && scrollTop >= 130);
        return {
          hasAttribute: () => true,
          getAttribute: () => String(!rendered),
          querySelector: () => ({
            getAttribute: () => `message-${index}`,
            lastElementChild: {
              classList: { contains: value => value === (index === 1 ? 'x13a6bvl' : 'x1nhvcw1') }
            },
            querySelectorAll: () => index === 0 ? [linkTo('peer')] :
              group && index === 3 ? [linkTo('second_peer')] : []
          }),
          cloneNode: () => ({ innerHTML: text, querySelectorAll: () => [] })
        };
      });
      return { firstElementChild, children: [firstElementChild, ...rows] };
    }
  };
  return {
    grid,
    document: {
      URL: 'https://www.threads.com/messages/t/123',
      querySelectorAll: selector => selector === '[role="grid"]' ? [grid] : [self]
    }
  };
}

const options = { pause: async () => {}, convert: html => html };

test('collects virtual messages in order and deduplicates overlapping batches by ID', async () => {
  const { document, grid } = virtualConversation();
  const result = await collectThreadsHistory(document.URL, { ...options, document });
  assert.equal(result.complete, true);
  assert.equal(result.messageCount, 4);
  assert.deepEqual(Array.from(result.markdown.matchAll(/^\*\*(.+)\*\*$/gm), match => match[1]),
    ['@peer', '@local\\_user', '@peer', '@peer']);
  assert.match(result.markdown.replace(/^\*\*.+\*\*\n\n/gm, ''), /Oldest\n\n---\n\nRepeated message\n\n---\n\nRepeated message\n\n---\n\nNewest/);
  assert.equal(grid.scrollTop, 50);
});

test('marks missing rows or an unverified start as partial', async () => {
  for (const config of [{ skipMiddle: true }, { hasStart: false }]) {
    const { document } = virtualConversation(config);
    const result = await collectThreadsHistory(document.URL, { ...options, document });
    assert.equal(result.complete, false);
    assert.match(result.filename, /-partial\.md$/);
    assert.match(result.markdown, /Partial export/);
  }
});

test('keeps the sender unknown for an avatarless incoming group message', async () => {
  const { document } = virtualConversation({ group: true });
  const result = await collectThreadsHistory(document.URL, { ...options, document });
  assert.match(result.markdown, /\*\*Incoming sender unknown\*\*/);
});

test('the serialized browser collector runs with the shared converter and rejects a different conversation', async () => {
  const { document } = virtualConversation();
  const collect = runInNewContext(`(${collectThreadsHistory.toString()})`, {
    URL,
    document,
    setTimeout: callback => callback(),
    MarkdownCaptureWebpage: { contentToMarkdown: html => html }
  });
  const result = await collect(document.URL);
  assert.equal(result.sourceUrl, document.URL);
  assert.equal(result.complete, true);
  assert.equal(result.messageCount, 4);
  await assert.rejects(collect('https://www.threads.com/messages/t/456'), /conversation changed/);
});
