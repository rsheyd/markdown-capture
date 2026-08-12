export function gmailPdfMessagePartId(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== 'mail.google.com' || !/^\/mail\/u\/\d+\/$/.test(url.pathname)) return null;

    const hashQuery = url.hash.includes('?') ? url.hash.slice(url.hash.indexOf('?') + 1) : '';
    const params = new URLSearchParams(hashQuery);
    if (params.get('projector') !== '1') return null;
    return params.get('messagePartId');
  } catch {
    return null;
  }
}

export function isGmailPdfViewerUrl(value) {
  return Boolean(gmailPdfMessagePartId(value));
}

export async function fetchGmailPdfAttachment(tabId, viewerUrl) {
  const messagePartId = gmailPdfMessagePartId(viewerUrl);
  if (!messagePartId) throw new Error('This is not a supported Gmail PDF viewer URL.');

  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async partId => {
      const links = [...document.querySelectorAll('a[href*="view=att"]')];
      for (const link of links) {
        try {
          const url = new URL(link.href);
          const attachmentId = url.searchParams.get('attid') || url.searchParams.get('realattid');
          if (attachmentId !== partId) continue;

          const labels = [
            link.getAttribute('aria-label'),
            link.getAttribute('title'),
            link.textContent,
            link.parentElement?.textContent
          ].filter(Boolean).map(value => value.trim());
          const pdfLabel = labels.find(value => /\.pdf/i.test(value));
          const title = pdfLabel?.match(/Preview attachment\s+(.+?\.pdf)/i)?.[1]
            || pdfLabel?.match(/([^/\\]+\.pdf)\b/i)?.[1]
            || 'Gmail attachment.pdf';

          let response;
          try {
            response = await fetch(url.href, {
              credentials: 'include',
              headers: { Accept: 'application/pdf' }
            });
          } catch (error) {
            return { error: `Gmail PDF request failed: ${error.message}` };
          }
          if (!response.ok) return { error: `Gmail PDF request failed with HTTP ${response.status}` };

          const bytes = new Uint8Array(await response.arrayBuffer());
          let binary = '';
          const chunkSize = 0x8000;
          for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
          }
          return { base64: btoa(binary), title };
        } catch {
          // Ignore unrelated or malformed attachment links.
        }
      }
      return null;
    },
    args: [messagePartId]
  });

  const attachment = injectionResults[0]?.result;
  if (attachment?.error) throw new Error(attachment.error);
  if (!attachment) {
    throw new Error('Could not find the matching PDF attachment in Gmail. Close and reopen the attachment preview, then try again.');
  }

  const binary = atob(attachment.base64);
  const data = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
  return { data, title: attachment.title };
}
