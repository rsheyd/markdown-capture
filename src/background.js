import { extractSelection } from './selection.js';
import { selectionDebugReport, selectionOutput } from './selection-output.js';
import { selectionContextMenuTitle } from './shortcuts.js';
import { appendDebugInfo } from './debug.js';
import { withExportMetadata } from './metadata.js';

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
  const action = chrome.action;
  await Promise.all([
    action.setBadgeBackgroundColor({ color: success ? '#15803d' : '#b91c1c' }),
    action.setBadgeText({ text: success ? '✓' : '!' })
  ]);
  setTimeout(() => {
    action.setBadgeText({ text: '' })
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

async function copyCapturedSelection({ tabId, frameId, sourceUrl, selectionHtml, selectionText, contextMenuText = '', write = true, preserveSource = false, options }) {
  const target = Number.isInteger(frameId)
    ? { tabId, frameIds: [frameId] }
    : { tabId };
  let convertedMarkdown = '';
  if (selectionHtml) {
    await chrome.scripting.executeScript({
      target,
      files: ['vendor/webpage/webpage.js']
    });
    const conversionResults = await chrome.scripting.executeScript({
      target,
      func: (html, url, preserve) => globalThis.MarkdownCaptureWebpage.contentToMarkdown(html, {
        baseUrl: document.baseURI || url,
        preserveSource: preserve,
        document
      }),
      args: [selectionHtml, sourceUrl, preserveSource]
    });
    convertedMarkdown = conversionResults[0]?.result || '';
  }
  const { markdown, mode } = selectionOutput(convertedMarkdown, selectionText, contextMenuText);
  console.info('Selection Markdown capture', {
    frameId,
    htmlLength: selectionHtml?.length || 0,
    mode,
    sourceUrl
  });
  const preferences = options || await chrome.storage?.local?.get(['includeExportIntegrity', 'includeDebugInfo']) || {};
  const includeIntegrity = preferences.includeExportIntegrity === true;
  const includeDebug = preferences.includeDebugInfo === true;
  const annotated = includeDebug
    ? appendDebugInfo(markdown, JSON.parse(selectionDebugReport({ sourceUrl, frameId, selectionHtml, selectionText, contextMenuText, convertedMarkdown, markdown, mode })))
    : markdown;
  const output = includeIntegrity
    ? (await withExportMetadata({ markdown: annotated, sourceUrl }, { includeIntegrity: true })).markdown
    : annotated;
  if (write) await writeTextInTab(output, tabId, frameId);
  return output;
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
    selectionText: selection?.text || '',
    contextMenuText: info.selectionText || ''
  });
}

async function copyActiveSelectionAsMarkdown(write = true, preserveSource = false, options) {
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
    selectionText: selectedFrame.result.text,
    write,
    preserveSource,
    options
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
  if (message?.type === 'capture-selection-markdown') {
    copyActiveSelectionAsMarkdown(false, message.preserveSource === true, {
      includeExportIntegrity: message.includeIntegrity === true,
      includeDebugInfo: message.includeDebug === true
    })
      .then(output => sendResponse({ ok: true, markdown: output }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type !== 'fetch-reddit-json') return false;

  fetchRedditJson(message.tabId, message.jsonUrl)
    .then(payload => sendResponse({ ok: true, payload }))
    .catch(error => {
      console.error('Reddit acquisition failed', error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});
