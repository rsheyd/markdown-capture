// Pure asset rewriting and a ZIP writer using uncompressed entries (images are
// already compressed). No hosted conversion or runtime dependency is needed.
export const imageLimits = { count: 100, bytes: 10 * 1024 * 1024, total: 50 * 1024 * 1024 };
const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif', 'image/bmp': 'bmp', 'image/x-icon': 'ico', 'image/heic': 'heic', 'image/heif': 'heif' };

export async function localizeImages(result, fetchImage) {
  const assets = [];
  const failures = [];
  const resolved = new Map();
  const folder = `${result.filename.replace(/\.md$/i, '')}-images`;
  let markdown = result.markdown;
  let total = 0;
  for (const image of result.imageAssets || []) {
    if (!resolved.has(image.url)) {
      let path = image.url;
      try {
        if (resolved.size >= imageLimits.count) throw new Error('Image count limit reached');
        if (!/^(https?:|data:image\/|blob:)/i.test(image.url)) throw new Error('Unsupported image URL');
        const { bytes, type } = await fetchImage(image.url);
        const extension = extensions[type?.split(';')[0].toLowerCase()];
        if (!extension || !(bytes instanceof Uint8Array) || !bytes.length) throw new Error('Unsupported or empty image');
        if (bytes.length > imageLimits.bytes || total + bytes.length > imageLimits.total) throw new Error('Image size limit reached');
        path = `${folder}/image-${assets.length + 1}.${extension}`;
        assets.push({ path, bytes });
        total += bytes.length;
      } catch (error) {
        failures.push({ url: image.url, reason: error.message });
      }
      resolved.set(image.url, path);
    }
    // Replace only the generated image destination, never links or prose.
    const path = resolved.get(image.url);
    const destination = path === image.url ? path.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\s/g, c => encodeURIComponent(c)) : path.split('/').map(encodeURIComponent).join('/');
    markdown = markdown.replace(`](<${image.reference}>)`, `](<${destination}>)`);
  }
  return { ...result, markdown, assets, imageFailures: failures };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createImageZip(result) {
  const encoder = new TextEncoder();
  const files = [{ path: result.filename, bytes: encoder.encode(result.markdown) }, ...(result.assets || [])];
  const chunks = [];
  const directory = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.path);
    const crc = crc32(file.bytes);
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x800, true); // UTF-8 filenames
    view.setUint16(12, 0x21, true); // 1980-01-01
    view.setUint32(14, crc, true);
    view.setUint32(18, file.bytes.length, true);
    view.setUint32(22, file.bytes.length, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    chunks.push(header, file.bytes);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    central.set(header.subarray(4, 26), 6);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    directory.push(central);
    offset += header.length + file.bytes.length;
  }
  const size = directory.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, size, true);
  ev.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end], { type: 'application/zip' });
}
