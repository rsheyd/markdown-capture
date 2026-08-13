async function fetchRedditJson(tabId, jsonUrl) {
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

const SELECTION_MENU_ID = 'copy-selection-markdown';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll()
    .then(() => chrome.contextMenus.create({
      id: SELECTION_MENU_ID,
      title: 'Copy Selection as Markdown',
      contexts: ['selection'],
      documentUrlPatterns: ['http://*/*', 'https://*/*']
    }))
    .catch(error => console.error('Could not create selection context menu', error));
});

async function showSelectionBadge(success) {
  await Promise.all([
    chrome.action.setBadgeBackgroundColor({ color: success ? '#15803d' : '#b91c1c' }),
    chrome.action.setBadgeText({ text: success ? '✓' : '!' })
  ]);
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' })
      .catch(error => console.error('Could not clear selection badge', error));
  }, 2500);
}

async function copySelectionAsMarkdown(info, tab) {
  if (!tab?.id) throw new Error('The selected tab is unavailable.');
  const target = Number.isInteger(info.frameId)
    ? { tabId: tab.id, frameIds: [info.frameId] }
    : { tabId: tab.id };
  const sourceUrl = info.frameUrl || tab.url;

  await chrome.scripting.executeScript({
    target,
    files: ['vendor/webpage/webpage.js']
  });
  const results = await chrome.scripting.executeScript({
    target,
    func: async url => {
      const markdown = globalThis.MarkdownCaptureWebpage.selectionToMarkdown(document, url);
      try {
        await navigator.clipboard.writeText(markdown);
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = markdown;
        textarea.setAttribute('readonly', '');
        textarea.style.cssText = 'position:fixed;left:-9999px;opacity:0';
        document.documentElement.append(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('Chrome did not allow the selection to be copied.');
      }
      return true;
    },
    args: [sourceUrl]
  });
  if (!results[0]?.result) throw new Error('The selected content was not copied.');
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== SELECTION_MENU_ID) return;
  copySelectionAsMarkdown(info, tab)
    .then(() => showSelectionBadge(true))
    .catch(error => {
      console.error('Selection Markdown copy failed', error);
      return showSelectionBadge(false);
    });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'fetch-reddit-json') return false;

  fetchRedditJson(message.tabId, message.jsonUrl)
    .then(payload => sendResponse({ ok: true, payload }))
    .catch(error => {
      console.error('Reddit acquisition failed', error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});
