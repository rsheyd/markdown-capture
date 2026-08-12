# Markdown Capture

A lightweight, local-first Chrome extension that captures supported web
content as clean Markdown. It downloads or copies Reddit posts and their
comments and can copy basic text-based PDFs.

Click the extension icon while viewing a Reddit post, then choose whether to download or copy the full discussion. On a comment permalink, you can export only that comment thread instead.

For a straightforward HTTP(S) URL ending in `.pdf`, or a PDF attachment open
in Gmail's viewer, click the extension and choose **Copy PDF as Markdown**.
Markdown Capture reads the underlying PDF locally rather than scraping the
rendered viewer.

Markdown Capture is intended to work with any Markdown editor. It does not
require an account, send captured content to a conversion service, or target a
specific notes application.

## Why Markdown Capture exists

Markdown Capture is a spiritual successor to
[MarkDownload](https://github.com/deathau/markdownload), not a fork or an
affiliated continuation. MarkDownload established an excellent local
page-to-Markdown workflow, but its last upstream release was in 2024 and its
active development has fragmented across small forks. Starting from this
project's compact Manifest V3 Reddit exporter makes it possible to retain that
simple workflow while adding tested, source-aware conversion incrementally.

The alternatives we considered solve adjacent problems:

- [Copy as Markdown](https://github.com/notlmn/copy-as-markdown) is an active,
  MIT-licensed extension focused on selected content and context-menu actions.
- [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) is
  open source and powerful, but its capture workflow is designed around
  Obsidian.
- Markforge advertises platform-specific capture and calls itself open source,
  but no public source repository or license was discoverable when this
  project was researched in August 2026.

Markdown Capture aims for the middle: ordinary Markdown output, local
processing, a compact copy/download interface, and specialized adapters where
generic page conversion loses important structure.

## Features

- Uses Reddit's structured `.json` representation instead of scraping the page.
- Fetches JSON from the active Reddit tab so Reddit receives a normal same-origin browser request.
- Includes the post title, author, subreddit, canonical URL, and body.
- Recursively preserves the returned comment hierarchy, authors, and scores.
- Downloads Markdown files or copies Markdown directly to the clipboard.
- Exports all returned comments or a selected comment thread.
- Handles link posts and deleted or removed content sensibly.
- Ignores Reddit `more` placeholders; it does not make extra requests for missing comments.
- Runs as a Manifest V3 extension with PDF.js bundled locally.
- Extracts basic text from straightforward PDF URLs locally with bundled
  PDF.js.
- Shows source-appropriate actions instead of treating PDFs as webpages.
- Resolves the authenticated attachment behind Gmail's PDF viewer without
  including its internal download URL in the exported Markdown.

## Install locally in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project directory—the directory containing `manifest.json`.
5. Pin **Markdown Capture** from Chrome's Extensions menu.
6. Open a Reddit post and click the extension icon.
7. Choose one of the download or copy actions.

Download actions show Chrome's Save dialog. Copy actions place the Markdown on the clipboard. The popup displays progress and any error summary; inspect the service worker from `chrome://extensions` for full error details.

After changing source files, click the extension's reload button on `chrome://extensions` before testing again.

## Test

Requires Node.js 18 or newer.

```bash
npm install
npm test
```

## Project structure

- `ROADMAP.md` — phased plan for adding PDF and webpage capture.
- `manifest.json` — Manifest V3 extension configuration.
- `src/background.js` — Reddit fetch, conversion orchestration, and file downloads.
- `src/popup.html`, `src/popup.css`, and `src/popup.js` — export menu and clipboard behavior.
- `src/reddit.js` — URL handling and JSON-to-Markdown conversion.
- `src/pdf.js` — pure PDF detection and basic text-to-Markdown conversion.
- `src/pdf-capture.js` — browser-side PDF fetching and PDF.js orchestration.
- `vendor/pdfjs/` — browser-ready PDF.js runtime and license.
- `test/` — Reddit and PDF unit tests plus a generated PDF fixture.

## Limitations

- PDF capture initially recognizes only HTTP(S) URLs whose path ends in
  `.pdf` and PDF attachments opened in Gmail's standard projector viewer.
- PDF capture supports text-based PDFs only. Scanned or image-only PDFs need
  OCR, which is not supported yet.
- PDF reading order uses a basic visual top-to-bottom sort with left-to-right
  tie-breaking. This improves misplaced headings, but multicolumn layouts may
  be interleaved and complex tables may be flattened.
- Password-protected PDFs are not supported.
- Comment-thread export is available only from a direct comment permalink.
- Collapsed or omitted comments represented by `kind: "more"` are not expanded.
- Media, galleries, flair, awards, and avatars are not specially formatted.
- Very large threads are limited by the comments included in Reddit's initial JSON response.
