// Keep diagnostics in the exported Markdown, without changing its rendered view.
// Escape hyphens as JSON Unicode escapes so captured text cannot close the HTML comment.
export function appendDebugInfo(markdown, details) {
  const report = JSON.stringify(details, null, 2).replace(/-/g, '\\u002d');
  return `${markdown.replace(/\s*$/, '')}\n\n<!-- Markdown Capture debug\n${report}\n-->\n`;
}
