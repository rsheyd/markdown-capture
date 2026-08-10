import {
  getRedditJsonUrl,
  markdownFilename,
  redditJsonToMarkdown
} from './reddit.js';

const BADGE_DURATION_MS = 2500;

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

async function showBadge(tabId, text, color, title) {
  await Promise.all([
    chrome.action.setBadgeBackgroundColor({ tabId, color }),
    chrome.action.setBadgeText({ tabId, text }),
    chrome.action.setTitle({ tabId, title })
  ]);

  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    chrome.action.setTitle({
      tabId,
      title: 'Download Reddit post as Markdown'
    }).catch(() => {});
  }, BADGE_DURATION_MS);
}

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !tab.url) return;

  const jsonUrl = getRedditJsonUrl(tab.url);
  if (!jsonUrl) {
    await showBadge(tab.id, '!', '#b91c1c', 'Open a Reddit post before clicking');
    return;
  }

  try {
    await showBadge(tab.id, '…', '#4b5563', 'Fetching Reddit comments…');

    const payload = await fetchRedditJsonInTab(tab.id, jsonUrl);
    const result = redditJsonToMarkdown(payload);
    const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(result.markdown)}`;

    await chrome.downloads.download({
      url: dataUrl,
      filename: markdownFilename(result.title),
      saveAs: true
    });

    await showBadge(tab.id, '✓', '#15803d', 'Reddit post downloaded');
  } catch (error) {
    console.error('Reddit Markdown export failed', error);
    await showBadge(tab.id, '!', '#b91c1c', `Export failed: ${error.message}`);
  }
});
