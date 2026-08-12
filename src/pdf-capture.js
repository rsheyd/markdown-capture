import {
  GlobalWorkerOptions,
  getDocument
} from '../vendor/pdfjs/pdf.mjs';
import {
  pdfPageItemsToMarkdown,
  pdfPagesToMarkdown,
  pdfTitleFromUrl
} from './pdf.js';

GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdfjs/pdf.worker.mjs');

function friendlyPdfError(error) {
  if (error?.name === 'PasswordException') {
    return new Error('This PDF is password-protected and cannot be captured yet.');
  }
  if (error?.name === 'InvalidPDFException') {
    return new Error('The PDF is malformed or could not be read.');
  }
  return error;
}

export async function capturePdfAsMarkdown({ data: suppliedData, fetchUrl, sourceUrl = fetchUrl, title: titleHint = '' }) {
  try {
    let data = suppliedData;
    if (!data) {
      const response = await fetch(fetchUrl, {
        credentials: 'include',
        headers: { Accept: 'application/pdf' }
      });
      if (!response.ok) throw new Error(`PDF request failed with HTTP ${response.status}`);

      data = new Uint8Array(await response.arrayBuffer());
    }
    if (data.length < 5 || new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') {
      throw new Error('The active tab did not return a PDF file.');
    }

    const document = await getDocument({ data, verbosity: 0 }).promise;

    try {
      const metadata = await document.getMetadata().catch(() => null);
      const pages = [];

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(pdfPageItemsToMarkdown(content.items));
        page.cleanup();
      }

      const title = metadata?.info?.Title || titleHint.replace(/\.pdf\s*$/i, '') || pdfTitleFromUrl(sourceUrl);
      return pdfPagesToMarkdown({ pages, sourceUrl, title });
    } finally {
      await document.destroy();
    }
  } catch (error) {
    throw friendlyPdfError(error);
  }
}
