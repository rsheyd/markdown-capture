export function threadsConversationUrl(value) {
  try {
    const url = new URL(value);
    const path = url.pathname.match(/^\/messages\/t\/(\d+)\/?$/);
    return url.origin === 'https://www.threads.com' && path
      ? `${url.origin}/messages/t/${path[1]}`
      : null;
  } catch {
    return null;
  }
}

// Chrome serializes this function for execution in the active tab. Keep its helpers inside it.
export async function collectThreadsHistory(expectedSourceUrl, {
  document = globalThis.document,
  pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  maxSteps = 500,
  convert = (...args) => globalThis.MarkdownCaptureWebpage.contentToMarkdown(...args)
} = {}) {
  function profileHandle(link) {
    return link?.getAttribute('href').match(/^\/(@[\w.]+)\/?$/)?.[1];
  }

  function slots(list) {
    return Array.from(list.children).filter(row => row.hasAttribute('data-virtualized'));
  }

  function readThreadsBatch(list) {
    const rows = slots(list);
    return rows.flatMap((row, index) => {
      if (row.getAttribute('data-virtualized') !== 'false') return [];
      const message = row.querySelector('[data-message-id]');
      if (!message) return [];
      const sender = Array.from(message.querySelectorAll('a[href^="/@"]')).find(link => link.querySelector('img'));
      // Threads applies these alignment classes even when a grouped row has no avatar.
      const alignment = message.lastElementChild?.classList;
      const outgoing = alignment?.contains('x13a6bvl');
      const incoming = alignment?.contains('x1nhvcw1');
      const direction = outgoing === incoming ? undefined : outgoing ? 'outgoing' : 'incoming';
      const copy = row.cloneNode(true);
      const attachments = copy.querySelectorAll('img[alt="Message attachment"]');
      for (const attachment of attachments) {
        const placeholder = copy.ownerDocument.createTextNode('[Message attachment]');
        (attachment.closest('button, [role="button"]') ?? attachment).replaceWith(placeholder);
      }
      for (const element of copy.querySelectorAll('button, [role="button"], [aria-hidden="true"], svg, a[href^="/@"] img')) {
        element.remove();
      }
      return [{
        id: message.getAttribute('data-message-id'),
        fromEnd: rows.length - index,
        sender: profileHandle(sender),
        direction,
        html: copy.innerHTML
      }];
    });
  }

  const url = new URL(document.URL);
  const thread = url.pathname.match(/^\/messages\/t\/(\d+)\/?$/);
  if (url.origin !== 'https://www.threads.com' || !thread) {
    throw new Error('Open one Threads conversation before exporting.');
  }
  const sourceUrl = `${url.origin}/messages/t/${thread[1]}`;
  if (sourceUrl !== expectedSourceUrl) throw new Error('The active Threads conversation changed.');
  const grids = Array.from(document.querySelectorAll('[role="grid"]'))
    .filter(grid => grid.firstElementChild && slots(grid.firstElementChild).length);
  if (grids.length !== 1) throw new Error('Could not identify a single Threads message list.');

  const [grid] = grids;
  const profileLinks = Array.from(document.querySelectorAll('a[href^="/@"]'))
    .filter(link => link.textContent.trim() === 'Profile' && !grid.contains(link));
  const self = profileLinks.length === 1 ? profileHandle(profileLinks[0]) : undefined;
  const initialPosition = grid.scrollTop;
  const messages = new Map();
  const positions = new Map();
  let topConfirmed = false;
  let layoutChanged = false;
  let settledAtTop = 0;
  let previousSlotCount = 0;

  try {
    grid.scrollTop = grid.scrollHeight;
    await pause(350);
    const startedAtBottom = grid.scrollHeight - grid.clientHeight - grid.scrollTop <= 2;
    for (let step = 0; step < maxSteps; step++) {
      if (document.URL !== url.href) throw new Error('The active Threads conversation changed.');
      if (!grid.isConnected) break;
      const list = grid.firstElementChild;
      if (!list) break;
      const count = slots(list).length;
      for (const message of readThreadsBatch(list)) {
        if ((positions.has(message.fromEnd) && positions.get(message.fromEnd) !== message.id) ||
            (messages.has(message.id) && messages.get(message.id).fromEnd !== message.fromEnd)) {
          layoutChanged = true;
        }
        positions.set(message.fromEnd, message.id);
        messages.set(message.id, message);
      }

      if (grid.scrollTop <= 1) {
        settledAtTop = count === previousSlotCount ? settledAtTop + 1 : 0;
        if (settledAtTop >= 3) {
          // The profile card is supporting evidence that the UI reached its beginning.
          topConfirmed = startedAtBottom && !list.firstElementChild?.hasAttribute('data-virtualized') &&
            Boolean(list.firstElementChild?.querySelector('a[href^="/@"]'));
          break;
        }
      } else {
        settledAtTop = 0;
        grid.scrollTop -= Math.max(1, Math.floor(grid.clientHeight * 0.65));
      }
      previousSlotCount = count;
      await pause(grid.scrollTop <= 1 ? 550 : 160);
    }
  } finally {
    if (grid.isConnected && document.URL === url.href) grid.scrollTop = initialPosition;
  }

  if (!messages.size) throw new Error('No Threads messages were captured.');
  const rows = Array.from(messages.values()).sort((a, b) => b.fromEnd - a.fromEnd);
  const slotCount = grid.isConnected && grid.firstElementChild ? slots(grid.firstElementChild).length : 0;
  const complete = topConfirmed && !layoutChanged && rows.length === slotCount;
  const profileCard = grid.firstElementChild?.firstElementChild;
  const peer = profileCard?.hasAttribute('data-virtualized') ? undefined :
    profileHandle(profileCard?.querySelector('a[href^="/@"]'));
  const otherSenders = new Set(rows.map(row => row.sender).filter(Boolean));
  const singlePeer = complete && otherSenders.size === 1 && otherSenders.has(peer) ? peer : undefined;
  const sections = rows.map(({ html, sender, direction }) => {
    const label = sender ?? (direction === 'outgoing' ? self ?? 'You' :
      direction === 'incoming' ? singlePeer ?? 'Incoming sender unknown' : 'Sender unknown');
    const body = convert(html, { baseUrl: url.href, document }).trim() || '[Message content unavailable]';
    return `**${label.replaceAll('_', '\\_')}**\n\n${body}`;
  });
  const title = 'Threads conversation';
  const status = complete ? '' : '> Partial export. The collector could not verify coverage of the conversation shown by Threads.\n\n';
  return {
    complete,
    title,
    sourceUrl,
    messageCount: rows.length,
    filename: `threads-conversation-${thread[1]}${complete ? '' : '-partial'}.md`,
    markdown: `# ${title}\n\n${status}${sections.join('\n\n---\n\n')}\n`
  };
}
