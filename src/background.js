import {
  getRedditJsonUrl,
  markdownFilename,
  redditJsonToMarkdown
} from './reddit.js';

async function fetchRedditJsonInTab(tabId, jsonUrl) {
  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async url => {
      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          credentials: 'include'
        });
        return {
          ok: response.ok,
          status: response.status,
          payload: response.ok ? await response.json() : null
        };
      } catch (error) {
        return { ok: false, status: 0, error: error.message };
      }
    },
    args: [jsonUrl]
  });

  const result = injectionResults[0]?.result;
  if (!result) throw new Error('Reddit tab did not return a response');
  if (!result.ok) {
    const detail = result.status ? `HTTP ${result.status}` : result.error;
    throw new Error(`Reddit request failed with ${detail || 'an unknown error'}`);
  }
  return result.payload;
}

async function exportMarkdown({ tabId, url, scope, output }) {
  const jsonUrl = getRedditJsonUrl(url, scope);
  if (!jsonUrl) throw new Error('This option requires a Reddit comment permalink');

  const payload = await fetchRedditJsonInTab(tabId, jsonUrl);
  const result = redditJsonToMarkdown(payload);

  if (output === 'download') {
    const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(result.markdown)}`;

    await chrome.downloads.download({
      url: dataUrl,
      filename: markdownFilename(result.title),
      saveAs: true
    });
  }

  return result;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'export-markdown') return false;

  exportMarkdown(message)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => {
      console.error('Reddit Markdown export failed', error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});
