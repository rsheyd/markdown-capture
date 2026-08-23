export function extractSelection(rootDocument = document) {
  const selection = rootDocument.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return null;

  const container = rootDocument.createElement('div');
  for (let index = 0; index < selection.rangeCount; index += 1) {
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
    text: selection.toString().trim(),
    sourceUrl: rootDocument.URL
  };
}

export function extractSelectionHtml(rootDocument = document) {
  return extractSelection(rootDocument)?.html || '';
}
