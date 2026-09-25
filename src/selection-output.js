export function selectionOutput(markdown, selectionText, contextMenuText = '') {
  const htmlMarkdown = markdown?.trim() || '';
  const browserText = selectionText?.trim() || '';
  const chromeText = contextMenuText?.trim() || '';
  const multilineText = [browserText, chromeText].find(text => (text.match(/\n/g) || []).length >= 2);

  if (htmlMarkdown && !htmlMarkdown.includes('\n') && multilineText) {
    return { markdown: multilineText, mode: 'line-preserving-text-fallback' };
  }
  if (htmlMarkdown) return { markdown: htmlMarkdown, mode: 'html' };
  if (browserText || chromeText) {
    return { markdown: browserText || chromeText, mode: 'plain-text-fallback' };
  }
  throw new Error('The selection did not produce Markdown.');
}

export function selectionDebugReport({ sourceUrl, frameId, selectionHtml, selectionText, contextMenuText, convertedMarkdown, markdown, mode }) {
  return JSON.stringify({
    sourceUrl,
    frameId,
    mode,
    markdown,
    convertedMarkdown,
    selectionText,
    contextMenuText,
    selectionHtml,
    note: 'Chrome native Ctrl+C clipboard formats are not captured. This report stays local until you paste or share it.'
  }, null, 2);
}
