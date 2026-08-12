import { parseRedditPostUrl } from './reddit.js';
import { isPdfUrl } from './pdf.js';
import { isGmailPdfViewerUrl } from './gmail-pdf.js';

const status = document.querySelector('#status');
const redditActions = document.querySelector('#reddit-actions');
const pdfActions = document.querySelector('#pdf-actions');
const redditButtons = [...redditActions.querySelectorAll('button')];
const copyPdfButton = document.querySelector('#copy-pdf');
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const parsed = tab?.url ? parseRedditPostUrl(tab.url) : null;
const directPdf = tab?.url ? isPdfUrl(tab.url) : false;
const gmailPdf = tab?.url ? isGmailPdfViewerUrl(tab.url) : false;
const pdf = directPdf || gmailPdf;

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.classList.add('visible');
}

if (parsed) {
  redditActions.hidden = false;
} else if (pdf) {
  pdfActions.hidden = false;
} else {
  showStatus('Open a supported Reddit post or PDF.', true);
}

if (parsed && !parsed.commentId) {
  document.querySelectorAll('.comment-only').forEach(element => {
    element.classList.add('disabled');
    if (element instanceof HTMLButtonElement) element.disabled = true;
  });
}

for (const button of redditButtons) {
  button.addEventListener('click', async () => {
    redditButtons.forEach(item => { item.disabled = true; });
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
      redditButtons.forEach(item => {
        item.disabled = item.dataset.scope === 'comment' && !parsed.commentId;
      });
    }
  });
}

copyPdfButton.addEventListener('click', async () => {
  copyPdfButton.disabled = true;
  showStatus('Reading PDF…');

  try {
    const { capturePdfAsMarkdown } = await import('./pdf-capture.js');
    let fetchUrl = tab.url;
    let data;
    let title = tab.title;
    if (gmailPdf) {
      const { fetchGmailPdfAttachment } = await import('./gmail-pdf.js');
      const attachment = await fetchGmailPdfAttachment(tab.id, tab.url);
      data = attachment.data;
      title = attachment.title;
    }

    const result = await capturePdfAsMarkdown({
      data,
      fetchUrl,
      sourceUrl: tab.url,
      title
    });
    await navigator.clipboard.writeText(result.markdown);
    showStatus('Copied PDF to clipboard.');
  } catch (error) {
    showStatus(error.message, true);
    copyPdfButton.disabled = false;
  }
});
