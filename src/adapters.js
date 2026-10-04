import {
  getRedditJsonUrl,
  parseRedditPostUrl,
  redditJsonToMarkdown
} from './reddit.js';
import { isPdfUrl } from './pdf.js';
import { isGmailPdfViewerUrl } from './gmail-pdf.js';

function action(id, label, output, extra = {}) {
  return { id, label, output, ...extra };
}

const redditAdapter = {
  id: 'reddit',
  label: 'Reddit post',

  detect(tab) {
    const parsed = tab?.url ? parseRedditPostUrl(tab.url) : null;
    return parsed ? { parsed } : null;
  },

  actions({ parsed }) {
    return [
      action('reddit-all-download', 'Download Markdown', 'download', {
        group: 'All comments',
        scope: 'all'
      }),
      action('reddit-all-copy', 'Copy Markdown', 'copy', {
        group: 'All comments',
        scope: 'all'
      }),
      action('reddit-comment-download', 'Download Markdown', 'download', {
        group: 'This comment thread',
        scope: 'comment',
        enabled: Boolean(parsed.commentId)
      }),
      action('reddit-comment-copy', 'Copy Markdown', 'copy', {
        group: 'This comment thread',
        scope: 'comment',
        enabled: Boolean(parsed.commentId)
      })
    ];
  },

  async capture({ tab, action: selectedAction }, dependencies) {
    const jsonUrl = getRedditJsonUrl(tab.url, selectedAction.scope);
    if (!jsonUrl) throw new Error('This option requires a Reddit comment permalink');
    const payload = await dependencies.fetchRedditJson(tab.id, jsonUrl);
    return redditJsonToMarkdown(payload);
  }
};

const pdfAdapter = {
  id: 'pdf',
  label: 'PDF document',

  detect(tab) {
    if (!tab?.url) return null;
    const gmail = isGmailPdfViewerUrl(tab.url);
    return isPdfUrl(tab.url) || gmail ? { gmail } : null;
  },

  actions() {
    return [action('pdf-copy', 'Copy PDF as Markdown', 'copy')];
  },

  async capture({ tab, detection }, dependencies) {
    let data;
    let title = tab.title;
    if (detection.gmail) {
      const attachment = await dependencies.fetchGmailPdfAttachment(tab.id, tab.url);
      data = attachment.data;
      title = attachment.title;
    }

    return dependencies.capturePdfAsMarkdown({
      data,
      fetchUrl: tab.url,
      sourceUrl: tab.url,
      title
    });
  }
};

const webpageAdapter = {
  id: 'webpage',
  label: 'Webpage (best effort)',

  detect(tab) {
    if (!tab?.url) return null;
    try {
      const url = new URL(tab.url);
      return ['http:', 'https:'].includes(url.protocol) ? {} : null;
    } catch {
      return null;
    }
  },

  actions() {
    return [
      action('webpage-copy', 'Copy main content', 'copy', { mode: 'main' }),
      action('webpage-full-copy', 'Copy page content', 'copy', { mode: 'full' }),
      action('webpage-full-download', 'Download page content', 'download', { mode: 'full' }),
      action('webpage-images-download', 'Download with images', 'download', { mode: 'full', images: true })
    ];
  },

  capture({ tab, action: selectedAction }, dependencies) {
    return dependencies.captureWebpage(tab.id, tab.url, selectedAction.mode, Boolean(selectedAction.images));
  }
};

const craigslistAdapter = {
  id: 'craigslist',
  label: 'Craigslist post',

  detect(tab) {
    if (!tab?.url) return null;
    try {
      const url = new URL(tab.url);
      const craigslistHost = url.hostname === 'craigslist.org' || url.hostname.endsWith('.craigslist.org');
      const legacyPost = /\/d\/[^/]+\/\d+\.html$/.test(url.pathname);
      const currentPost = /^\/view\/d\/[^/]+\/[A-Za-z0-9]+\/?$/.test(url.pathname);
      return url.protocol === 'https:' && craigslistHost && (legacyPost || currentPost) ? {} : null;
    } catch {
      return null;
    }
  },

  actions() {
    return [
      action('craigslist-copy', 'Copy post', 'copy', { mode: 'craigslist' }),
      action('craigslist-download', 'Download Markdown', 'download', { mode: 'craigslist' }),
      action('craigslist-images-download', 'Download with images', 'download', { mode: 'craigslist', images: true })
    ];
  },

  capture({ tab, action: selectedAction }, dependencies) {
    return dependencies.captureWebpage(tab.id, tab.url, selectedAction.mode, Boolean(selectedAction.images));
  }
};

const gmailAdapter = {
  id: 'gmail',
  label: 'Gmail conversation',

  detect(tab) {
    if (!tab?.url) return null;
    try {
      const url = new URL(tab.url);
      return url.hostname === 'mail.google.com' && !isGmailPdfViewerUrl(tab.url) ? {} : null;
    } catch {
      return null;
    }
  },

  actions() {
    return [
      action('gmail-copy', 'Copy Conversation', 'copy', { mode: 'gmail' }),
      action('gmail-download', 'Download Conversation', 'download', { mode: 'gmail' }),
      action('gmail-images-download', 'Download with images', 'download', { mode: 'gmail', images: true })
    ];
  },

  capture({ tab, action: selectedAction }, dependencies) {
    return dependencies.captureWebpage(tab.id, tab.url, selectedAction.mode, Boolean(selectedAction.images));
  }
};

export const adapters = [redditAdapter, pdfAdapter, gmailAdapter, craigslistAdapter, webpageAdapter];

export function detectSource(tab) {
  for (const adapter of adapters) {
    const detection = adapter.detect(tab);
    if (!detection) continue;
    return {
      id: adapter.id,
      label: adapter.label,
      actions: adapter.actions(detection),
      detection
    };
  }
  return null;
}

export function getAdapter(id) {
  return adapters.find(adapter => adapter.id === id) || null;
}

export function getSourceAction(source, actionId) {
  return source?.actions.find(item => item.id === actionId) || null;
}
