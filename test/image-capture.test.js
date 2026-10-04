import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCraigslistImage } from '../src/image-capture.js';

test('Craigslist image fetch uses the exact permitted host and omits credentials', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, credentials: options.credentials });
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
    };
    const result = await fetchCraigslistImage('https://images.craigslist.org/photo_1200x900.jpg');
    assert.deepEqual([...result.bytes], [1, 2, 3]);
    assert.equal(result.type, 'image/jpeg');
    assert.deepEqual(calls, [{ url: 'https://images.craigslist.org/photo_1200x900.jpg', credentials: 'omit' }]);
    for (const url of ['http://images.craigslist.org/photo.jpg', 'https://images.craigslist.org.evil.test/photo.jpg', 'https://user@images.craigslist.org/photo.jpg']) {
      await assert.rejects(fetchCraigslistImage(url), /outside the permitted Craigslist host/);
    }
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
