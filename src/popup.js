import { detectSource } from './adapters.js';
import { runExport } from './export.js';

const actionsContainer = document.querySelector('#actions');
const sourceLabel = document.querySelector('#source-label');
const status = document.querySelector('#status');
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

function setButtonsDisabled(disabled) {
  actionsContainer.querySelectorAll('button').forEach(button => {
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
  showStatus('Open a supported Reddit post or PDF.', true);
} else {
  sourceLabel.textContent = source.label;
  sourceLabel.hidden = false;
  actionsContainer.hidden = false;

  let previousGroup = null;
  for (const action of source.actions) {
    appendAction(action, previousGroup);
    previousGroup = action.group || null;
  }

  actionsContainer.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action-id]');
    if (!button) return;

    const action = source.actions.find(item => item.id === button.dataset.actionId);
    setButtonsDisabled(true);
    showStatus(source.id === 'pdf' ? 'Reading PDF…' : 'Fetching Reddit comments…');

    try {
      const result = await runExport({ source, actionId: action.id, tab }, dependencies);
      showStatus(result.output === 'copy' ? 'Copied to clipboard.' : 'Download ready.');
    } catch (error) {
      showStatus(error.message, true);
      setButtonsDisabled(false);
    }
  });
}
