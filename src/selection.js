export function extractSelection(rootDocument = document) {
  const selection = rootDocument.getSelection();
  const text = selection?.toString().trim() || '';
  if ((!selection?.rangeCount || selection.isCollapsed) && !text) return null;

  const container = rootDocument.createElement('div');
  const appendRanges = selected => {
    for (let index = 0; index < (selected?.rangeCount || 0); index += 1) {
      const range = selected.getRangeAt(index);
      if (!range.collapsed) container.append(range.cloneContents());
    }
  };
  appendRanges(selection);

  if (!container.hasChildNodes() && text) {
    const roots = [rootDocument];
    for (const root of roots) {
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot) roots.push(element.shadowRoot);
      }
    }
    for (const root of roots.slice(1)) {
      const shadowSelection = root.getSelection?.();
      if (shadowSelection?.toString().trim() !== text) continue;
      appendRanges(shadowSelection);
      if (container.hasChildNodes()) break;
    }
  }

  container.querySelectorAll('a[href]').forEach(link => {
    link.setAttribute('href', link.href);
  });
  container.querySelectorAll('img[src]').forEach(image => {
    image.setAttribute('src', image.src);
  });
  return {
    html: container.innerHTML,
    text,
    sourceUrl: rootDocument.URL
  };
}

export function extractSelectionHtml(rootDocument = document) {
  return extractSelection(rootDocument)?.html || '';
}
