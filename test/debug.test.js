import test from 'node:test';
import assert from 'node:assert/strict';
import { appendDebugInfo } from '../src/debug.js';

test('debug comment retains parseable captured details without allowing comment termination', () => {
  const markdown = appendDebugInfo('# Title\n', { selectionHtml: '<p>--></p>', reason: 'HTTP 403' });
  assert.equal((markdown.match(/-->/g) || []).length, 1);
  const json = markdown.match(/<!-- Markdown Capture debug\n([\s\S]*?)\n-->/)?.[1];
  assert.deepEqual(JSON.parse(json), { selectionHtml: '<p>--></p>', reason: 'HTTP 403' });
  assert.match(markdown, /^# Title\n\n<!-- Markdown Capture debug/);
});
