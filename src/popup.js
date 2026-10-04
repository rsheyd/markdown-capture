import { detectSource } from './adapters.js';
import { runExport } from './export.js';
import { fetchPageImage, fetchCraigslistImage } from './image-capture.js';
import { createImageZip } from './image-export.js';

const actionsContainer = document.querySelector('#actions');
const primaryAction = document.querySelector('#primary-action');
const primaryDescription = document.querySelector('#primary-description');
const moreOptions = document.querySelector('#more-options');
const sourceLabel = document.querySelector('#source-label');
const status = document.querySelector('#status');
const integrityCheckbox = document.querySelector('#include-integrity');
const debugCheckbox = document.querySelector('#include-debug');
const preferenceKey = 'includeExportIntegrity';
const debugPreferenceKey = 'includeDebugInfo';
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const source = detectSource(tab);

const dependencies = {
  async fetchRedditJson(tabId, jsonUrl) {
    const response = await chrome.runtime.sendMessage({
      type: 'fetch-reddit-json',
      tabId,
      jsonUrl
    });
    if (!response?.ok) throw new Error(response?.error || 'Reddit acquisition failed');
    return response.payload;
  },

  async fetchGmailPdfAttachment(tabId, viewerUrl) {
    const { fetchGmailPdfAttachment } = await import('./gmail-pdf.js');
    return fetchGmailPdfAttachment(tabId, viewerUrl);
  },

  async capturePdfAsMarkdown(options) {
    const { capturePdfAsMarkdown } = await import('./pdf-capture.js');
    return capturePdfAsMarkdown(options);
  },

  async captureWebpage(tabId, sourceUrl, mode, images = false) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['vendor/webpage/webpage.js']
    });
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (url, captureMode, captureImages) => {
        if (captureMode === 'gmail') {
          return globalThis.MarkdownCaptureWebpage.captureGmailConversationDocument(document, url, captureImages);
        }
        if (captureMode === 'craigslist') {
          return globalThis.MarkdownCaptureWebpage.captureCraigslistDocument(document, url, captureImages);
        }
        return captureMode === 'full'
          ? globalThis.MarkdownCaptureWebpage.captureFullPageDocument(document, url, captureImages)
          : globalThis.MarkdownCaptureWebpage.captureWebpageDocument(document, url);
      },
      args: [sourceUrl, mode, images]
    });
    const result = results[0]?.result;
    if (!result) throw new Error('The web page did not return captured content.');
    return result;
  },

  async countCraigslistImages(tabId) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['vendor/webpage/webpage.js'] });
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => globalThis.MarkdownCaptureWebpage.craigslistGalleryUrls(document).length
    });
    const count = results[0]?.result;
    if (!Number.isInteger(count)) throw new Error('Could not read the Craigslist gallery.');
    return count;
  },

  async fetchImage(tabId, url) {
    showStatus('Downloading images… Keep this popup open.');
    if (source.id === 'craigslist') return fetchCraigslistImage(url);
    const results = await chrome.scripting.executeScript({ target: { tabId }, world: source.id === 'gmail' ? 'MAIN' : 'ISOLATED', func: fetchPageImage, args: [url] });
    const image = results[0]?.result;
    if (!image || image.error) throw new Error(image?.error || 'Image download failed');
    return { bytes: Uint8Array.from(atob(image.base64), character => character.charCodeAt(0)), type: image.type };
  },

  async downloadImages(result) {
    const url = URL.createObjectURL(createImageZip(result));
    try {
      await chrome.downloads.download({ url, filename: result.filename.replace(/\.md$/i, '.zip'), saveAs: true });
      // Chrome may read the blob after the download API returns.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  },

  copy(markdown) {
    return navigator.clipboard.writeText(markdown);
  },

  download(result) {
    const url = `data:text/markdown;charset=utf-8,${encodeURIComponent(result.markdown)}`;
    return chrome.downloads.download({ url, filename: result.filename, saveAs: true });
  }
};

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.classList.add('visible');
}

function savePreference(key, value) {
  try {
    const save = chrome.storage?.local?.set({ [key]: value });
    save?.catch(() => showStatus('Could not remember the export preference.', true));
  } catch {
    showStatus('Could not remember the export preference.', true);
  }
}

function setButtonsDisabled(disabled) {
  document.querySelectorAll('#actions button, #primary-action, #status button').forEach(button => {
    button.disabled = disabled || button.dataset.enabled === 'false';
  });
}

function appendAction(action, previousGroup) {
  if (action.group && action.group !== previousGroup) {
    const label = document.createElement('div');
    label.className = 'group-label';
    label.textContent = action.group;
    if (action.enabled === false) label.classList.add('disabled');
    actionsContainer.append(label);
  }

  const button = document.createElement('button');
  button.textContent = action.label;
  button.dataset.actionId = action.id;
  button.dataset.enabled = String(action.enabled !== false);
  button.disabled = action.enabled === false;
  actionsContainer.append(button);
}

if (!source) {
  showStatus('Open an HTTP(S) webpage, Reddit post, or supported PDF.', true);
} else {
  document.querySelector('#export-options').hidden = false;
  try {
    const stored = await chrome.storage?.local?.get([preferenceKey, debugPreferenceKey]) || {};
    const priorIntegrity = document.defaultView.localStorage.getItem(preferenceKey) === 'true';
    integrityCheckbox.checked = stored[preferenceKey] ?? priorIntegrity;
    debugCheckbox.checked = stored[debugPreferenceKey] ?? false;
    if (stored[preferenceKey] === undefined && priorIntegrity) {
      await chrome.storage?.local?.set({ [preferenceKey]: true });
    }
  } catch {
    showStatus('Could not load the saved export preference.', true);
  }
  integrityCheckbox.addEventListener('change', () => {
    try {
      document.defaultView.localStorage.setItem(preferenceKey, String(integrityCheckbox.checked));
      savePreference(preferenceKey, integrityCheckbox.checked);
    } catch {
      showStatus('Could not remember this preference. It applies to this popup only.', true);
    }
  });
  debugCheckbox.addEventListener('change', () => {
    savePreference(debugPreferenceKey, debugCheckbox.checked);
  });
  sourceLabel.textContent = source.label;
  sourceLabel.hidden = false;
  actionsContainer.hidden = false;
  moreOptions.hidden = false;

  if (source.id === 'webpage') {
    let hasSelection = false;
    try {
      const frames = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
          const selection = document.getSelection();
          return Boolean(selection?.toString().trim() || (selection?.rangeCount && !selection.isCollapsed));
        }
      });
      hasSelection = frames.some(frame => frame.result === true);
    } catch {
      // Main-content copy remains available if Chrome cannot inspect a frame.
    }
    const selectedAction = hasSelection
      ? { id: 'selection-copy', label: 'Copy selection', description: 'Copies the highlighted text as Markdown.' }
      : { id: 'webpage-copy', label: 'Copy main content', description: 'Copies the article or central text as Markdown.' };
    primaryAction.textContent = selectedAction.label;
    primaryAction.dataset.actionId = selectedAction.id;
    primaryAction.dataset.enabled = 'true';
    primaryAction.hidden = false;
    primaryDescription.textContent = selectedAction.description;
    primaryDescription.hidden = false;

    if (hasSelection) {
      appendAction({ id: 'selection-preserve-copy', label: 'Copy selection (preserve source)', group: 'Copy' }, null);
      appendAction({ id: 'webpage-copy', label: 'Copy main content', group: 'Copy' }, 'Copy');
      appendAction({ id: 'webpage-full-copy', label: 'Copy page content', group: 'Copy' }, 'Copy');
    } else {
      appendAction({ id: 'webpage-full-copy', label: 'Copy page content', group: 'Copy' }, null);
    }
    appendAction({ id: 'webpage-full-download', label: 'Download page content', group: 'Download' }, 'Copy');
    appendAction({ id: 'webpage-images-download', label: 'Download with images', group: 'Download' }, 'Download');
  } else {
    moreOptions.hidden = true;
    moreOptions.before(actionsContainer);
    actionsContainer.after(document.querySelector('#export-options'));
    if (source.id === 'craigslist') {
      const imageAction = source.actions.find(action => action.id === 'craigslist-images-download');
      try {
        const count = await dependencies.countCraigslistImages(tab.id);
        imageAction.label = `Download with images (${count} detected)`;
      } catch {
        imageAction.label = 'Download with images (count unavailable)';
      }
    }
    let previousGroup = null;
    for (const action of source.actions) {
      appendAction(action, previousGroup);
      previousGroup = action.group || null;
    }
    if (source.id === 'gmail' || source.id === 'reddit' || source.id === 'craigslist') {
      appendAction({ id: 'selection-copy', label: 'Copy Selection as Markdown', group: 'Selection' }, previousGroup);
      appendAction({ id: 'selection-preserve-copy', label: 'Copy Selection as Markdown (preserve source)', group: 'Selection' }, 'Selection');
    }
  }

  async function performAction(button) {
    if (!button?.dataset.actionId) return;
    if (button.dataset.actionId === 'selection-copy' || button.dataset.actionId === 'selection-preserve-copy') {
      setButtonsDisabled(true);
      showStatus('Reading selection…');
      try {
        const response = await chrome.runtime.sendMessage({ type: 'capture-selection-markdown', ...(button.dataset.actionId === 'selection-preserve-copy' ? { preserveSource: true } : {}), includeIntegrity: integrityCheckbox.checked, includeDebug: debugCheckbox.checked });
        if (!response?.ok) throw new Error(response?.error || 'Could not capture the selection.');
        await navigator.clipboard.writeText(response.markdown);
        showStatus('Selection copied to clipboard.');
      } catch (error) {
        showStatus(error.message, true);
      } finally {
        setButtonsDisabled(false);
      }
      return;
    }

    const action = source.actions.find(item => item.id === button.dataset.actionId);
    if (!action) return;
    setButtonsDisabled(true);
    const progress = source.id === 'pdf'
      ? 'Reading PDF…'
      : source.id === 'reddit'
        ? 'Fetching Reddit comments…'
        : 'Reading page…';
    showStatus(progress);

    try {
      if (action.id === 'craigslist-images-download') {
        const granted = await chrome.permissions.request({ origins: ['https://images.craigslist.org/*'] });
        if (!granted) throw new Error('Craigslist image access was not granted. No ZIP was downloaded.');
      }
      const result = await runExport({ source, actionId: action.id, tab, includeIntegrity: integrityCheckbox.checked, includeDebug: debugCheckbox.checked }, dependencies);
      showStatus(result.imageFailures?.length
        ? `ZIP ready. ${result.imageFailures.length} image(s) could not be saved; original links retained.`
        : result.assets ? `ZIP ready with ${result.assets.length} image(s).`
          : result.output === 'copy' ? 'Copied to clipboard.' : 'Download ready.');
    } catch (error) {
      if (action.id === 'webpage-copy' && /Could not identify the main content/.test(error.message)) {
        showStatus('Could not find the main content. Try copying the page content.', true);
        const fallback = document.createElement('button');
        fallback.textContent = 'Copy page content';
        fallback.dataset.actionId = 'webpage-full-copy';
        status.append(fallback);
      } else {
        showStatus(error.message, true);
      }
    } finally {
      setButtonsDisabled(false);
    }
  }

  primaryAction.addEventListener('click', event => performAction(event.currentTarget));
  status.addEventListener('click', event => performAction(event.target.closest('button[data-action-id]')));
  actionsContainer.addEventListener('click', event => performAction(event.target.closest('button[data-action-id]')));
}
