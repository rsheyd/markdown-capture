export function selectionShortcutLabel(os) {
  return os === 'mac' ? 'Option+Shift+M' : 'Alt+Shift+M';
}

export function selectionContextMenuTitle(os) {
  return `Copy Selection as Markdown (${selectionShortcutLabel(os)})`;
}
