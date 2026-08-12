import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gmailPdfMessagePartId,
  isGmailPdfViewerUrl
} from '../src/gmail-pdf.js';

const viewerUrl = 'https://mail.google.com/mail/u/0/#inbox/FMfcgzExample?projector=1&messagePartId=0.1';

test('recognizes a Gmail attachment projector URL', () => {
  assert.equal(isGmailPdfViewerUrl(viewerUrl), true);
  assert.equal(gmailPdfMessagePartId(viewerUrl), '0.1');
});

test('rejects ordinary Gmail and non-Gmail URLs', () => {
  assert.equal(isGmailPdfViewerUrl('https://mail.google.com/mail/u/0/#inbox'), false);
  assert.equal(isGmailPdfViewerUrl('https://example.com/#inbox/x?projector=1&messagePartId=0.1'), false);
  assert.equal(isGmailPdfViewerUrl('https://mail.google.com/mail/u/0/#inbox/x?projector=0&messagePartId=0.1'), false);
});

test('supports other numeric Gmail account slots', () => {
  assert.equal(
    gmailPdfMessagePartId('https://mail.google.com/mail/u/3/#all/example?projector=1&messagePartId=2'),
    '2'
  );
});
