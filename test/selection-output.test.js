import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionDebugReport, selectionOutput } from '../src/selection-output.js';

test('does not restore controls removed from converted content via the text fallback', () => {
  assert.deepEqual(selectionOutput('Message content', '🙈\n😂\nOpen Emoji Keyboard\nMessage content'), {
    markdown: 'Message content',
    mode: 'html'
  });
});

test('preserves browser line breaks when HTML conversion collapses a selection', () => {
  assert.deepEqual(selectionOutput('First message Second message', 'First message\n\nSecond message'), {
    markdown: 'First message\n\nSecond message',
    mode: 'line-preserving-text-fallback'
  });
});

test('keeps converted Markdown when it already has structure and links', () => {
  const markdown = 'First message\n\n[Link](https://example.com)';
  assert.deepEqual(selectionOutput(markdown, 'First message\n\nLink'), {
    markdown,
    mode: 'html'
  });
});

test('uses Chrome context-menu text if the DOM selection has disappeared', () => {
  assert.deepEqual(selectionOutput('', '', 'First message\nSecond message'), {
    markdown: 'First message\nSecond message',
    mode: 'plain-text-fallback'
  });
});

test('debug report includes source and both capture inputs', () => {
  const report = JSON.parse(selectionDebugReport({
    sourceUrl: 'https://example.com/',
    frameId: 0,
    selectionHtml: '<p>First</p>',
    selectionText: 'First',
    contextMenuText: 'First',
    convertedMarkdown: 'First',
    markdown: 'First',
    mode: 'html'
  }));
  assert.equal(report.selectionHtml, '<p>First</p>');
  assert.equal(report.sourceUrl, 'https://example.com/');
  assert.equal(report.mode, 'html');
});
