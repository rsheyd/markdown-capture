// Runs in the active page so same-origin authenticated images retain access.
// Cross-origin images still require the image server to allow CORS.
export async function fetchPageImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const limit = 10 * 1024 * 1024;
  try {
    const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error('Response is not an image');
    if (Number(response.headers.get('content-length')) > limit) throw new Error('Image exceeds 10 MB');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new Error('Image exceeds 10 MB'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    // executeScript results must be JSON serializable.
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    return { base64: btoa(binary), type };
  } catch (error) {
    return { error: error.message };
  } finally {
    clearTimeout(timer);
  }
}
