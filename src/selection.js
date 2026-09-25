export function extractSelection(rootDocument = document) {
  const selection = rootDocument.getSelection();
  const text = selection?.toString().trim() || '';
  if ((!selection?.rangeCount || selection.isCollapsed) && !text) return null;

  const container = rootDocument.createElement('div');
  for (let index = 0; index < (selection?.rangeCount || 0); index += 1) {
    const range = selection.getRangeAt(index);
    if (!range.collapsed) container.append(range.cloneContents());
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
