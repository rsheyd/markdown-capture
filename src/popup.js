import { parseRedditPostUrl } from './reddit.js';

const status = document.querySelector('#status');
const buttons = [...document.querySelectorAll('button')];
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const parsed = tab?.url ? parseRedditPostUrl(tab.url) : null;

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.classList.add('visible');
}

if (!parsed) {
  buttons.forEach(button => { button.disabled = true; });
  showStatus('Open a Reddit post to export.', true);
} else if (!parsed.commentId) {
  document.querySelectorAll('.comment-only').forEach(element => {
    element.classList.add('disabled');
    if (element instanceof HTMLButtonElement) element.disabled = true;
  });
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    buttons.forEach(item => { item.disabled = true; });
    showStatus('Fetching Reddit comments…');

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'export-markdown',
        tabId: tab.id,
        url: tab.url,
        scope: button.dataset.scope,
        output: button.dataset.output
      });

      if (!result?.ok) throw new Error(result?.error || 'Export failed');
      if (button.dataset.output === 'copy') {
        await navigator.clipboard.writeText(result.markdown);
      }

      showStatus(button.dataset.output === 'copy' ? 'Copied to clipboard.' : 'Download ready.');
    } catch (error) {
      showStatus(error.message, true);
      buttons.forEach(item => {
        item.disabled = item.dataset.scope === 'comment' && !parsed.commentId;
      });
    }
  });
}
