// Hash the unchanged UTF-8 payload; the complete header and blank separator
// precede it and are explicitly outside the hash scope.
export async function withExportMetadata(result, { includeIntegrity = false, capturedAt = new Date() } = {}) {
  const sourceUrl = result.sourceUrl.replace(/[<>\r\n]/g, character => encodeURIComponent(character));
  const fields = ['<!-- Markdown Capture metadata', `Source URL: ${sourceUrl}`];
  if (includeIntegrity) {
    const bytes = new TextEncoder().encode(result.markdown);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    fields.push(
      `Captured at: ${capturedAt.toISOString()}`,
      `SHA-256: ${hash}`,
      'Hash scope: Exact UTF-8 bytes after the closing metadata marker and its two LF characters, including all whitespace and the final newline.'
    );
  }
  return { ...result, markdown: `${fields.join('\n')}\n-->\n\n${result.markdown}` };
}
