import { extractSelection } from './selection.js';
import { selectionContextMenuTitle } from './shortcuts.js';

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
  Promise.all([
    chrome.contextMenus.removeAll(),
    chrome.runtime.getPlatformInfo()
  ])
    .then(([, platform]) => chrome.contextMenus.create({
      id: SELECTION_MENU_ID,
      title: selectionContextMenuTitle(platform.os),
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

async function writeTextInTab(text, tabId, frameId) {
  const target = Number.isInteger(frameId)
    ? { tabId, frameIds: [frameId] }
    : { tabId };
  const results = await chrome.scripting.executeScript({
    target,
    func: async value => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.cssText = 'position:fixed;left:-9999px;opacity:0';
        document.documentElement.append(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('Chrome did not allow text to be copied.');
      }
      return true;
    },
    args: [text]
  });
  if (!results[0]?.result) throw new Error('The text was not copied.');
}

async function copyCapturedSelection({ tabId, frameId, sourceUrl, selectionHtml, selectionText }) {
  const target = Number.isInteger(frameId)
    ? { tabId, frameIds: [frameId] }
    : { tabId };
  let markdown = '';
  if (selectionHtml) {
    await chrome.scripting.executeScript({
      target,
      files: ['vendor/webpage/webpage.js']
    });
    const conversionResults = await chrome.scripting.executeScript({
      target,
      func: (html, url) => globalThis.MarkdownCaptureWebpage.contentToMarkdown(html, {
        baseUrl: document.baseURI || url,
        document
      }),
      args: [selectionHtml, sourceUrl]
    });
    markdown = conversionResults[0]?.result || '';
  }
  const mode = markdown ? 'html' : 'plain-text-fallback';
  markdown ||= selectionText?.trim();
  if (!markdown) throw new Error('The selection did not produce Markdown.');
  console.info('Selection Markdown capture', {
    frameId,
    htmlLength: selectionHtml?.length || 0,
    mode,
    sourceUrl
  });
  await writeTextInTab(markdown, tabId, frameId);
}

async function copySelectionAsMarkdown(info, tab) {
  if (!tab?.id) throw new Error('The selected tab is unavailable.');
  const target = Number.isInteger(info.frameId)
    ? { tabId: tab.id, frameIds: [info.frameId] }
    : { tabId: tab.id };
  const selectionResults = await chrome.scripting.executeScript({
    target,
    func: extractSelection,
    injectImmediately: true
  });
  const selection = selectionResults[0]?.result;
  return copyCapturedSelection({
    tabId: tab.id,
    frameId: info.frameId,
    sourceUrl: info.frameUrl || tab.url,
    selectionHtml: selection?.html,
    selectionText: selection?.text || info.selectionText
  });
}

async function copyActiveSelectionAsMarkdown() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('The selected tab is unavailable.');
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: extractSelection,
    injectImmediately: true
  });
  const selectedFrame = results.find(result => result.result);
  if (!selectedFrame) throw new Error('Select some webpage content first.');
  return copyCapturedSelection({
    tabId: tab.id,
    frameId: selectedFrame.frameId,
    sourceUrl: selectedFrame.result.sourceUrl || tab.url,
    selectionHtml: selectedFrame.result.html,
    selectionText: selectedFrame.result.text
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== SELECTION_MENU_ID) return;
  copySelectionAsMarkdown(info, tab)
    .then(() => showSelectionBadge(true))
    .catch(async error => {
      console.error('Selection Markdown copy failed', error);
      try {
        if (tab?.id) {
          const sourceUrl = info.frameUrl || tab.url || 'unknown URL';
          await writeTextInTab(
            `Markdown Capture error: ${error.message}\nURL: ${sourceUrl}`,
            tab.id,
            info.frameId
          );
        }
      } catch (clipboardError) {
        console.error('Could not copy the selection error', clipboardError);
      }
      return showSelectionBadge(false);
    });
});

chrome.commands.onCommand.addListener(command => {
  if (command !== SELECTION_MENU_ID) return;
  copyActiveSelectionAsMarkdown()
    .then(() => showSelectionBadge(true))
    .catch(error => {
      console.error('Keyboard selection Markdown copy failed', error);
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
