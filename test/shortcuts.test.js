import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectionContextMenuTitle,
  selectionShortcutLabel
} from '../src/shortcuts.js';

test('formats the selection shortcut for macOS context menus', () => {
  assert.equal(selectionShortcutLabel('mac'), 'Option+Shift+M');
  assert.equal(
    selectionContextMenuTitle('mac'),
    'Copy Selection as Markdown (Option+Shift+M)'
  );
});

test('formats the selection shortcut for other platforms', () => {
  for (const os of ['win', 'linux', 'cros', 'openbsd']) {
    assert.equal(selectionShortcutLabel(os), 'Alt+Shift+M');
    assert.equal(
      selectionContextMenuTitle(os),
      'Copy Selection as Markdown (Alt+Shift+M)'
    );
  }
});
