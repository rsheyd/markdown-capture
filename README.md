# Markdown Capture

A lightweight, local-first Chrome extension that captures supported web
content as clean Markdown. It works with any Markdown editor, requires no
account, and performs conversion in the browser without sending captured
content to a hosted service.

Current release: **0.5.1**. Markdown Capture is currently installed as an
unpacked developer-mode extension; it is not published in the Chrome Web
Store.

## Supported captures

| Source | Action | Result |
| --- | --- | --- |
| Reddit post | **Copy** or **Download Full Discussion** | Post metadata, body, and returned comment hierarchy |
| Reddit comment permalink | **Copy** or **Download Comment Thread** | The selected comment and its returned replies |
| Text-based PDF or Gmail PDF attachment | **Copy PDF as Markdown** | Basic page-by-page text with title and source URL |
| Article or documentation page | **Copy** or **Download Main Content** | Best-effort Readability extraction converted to Markdown |
| Selected webpage content | **Copy Selection as Markdown** from the context menu | The selected structure with absolute links and image URLs |

Specialized Reddit and PDF handling takes priority over generic webpage
capture. PDF and webpage conversion are best effort; see
[Limitations](#limitations) before relying on layout-sensitive output.

## Install locally in Chrome

Clone or download this repository first. No build step is required for normal
use; the conversion dependencies used by Chrome are already bundled locally.

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project directory—the directory containing `manifest.json`.
5. Pin **Markdown Capture** from Chrome's Extensions menu.
6. Open a supported source and click the extension icon.
7. Choose one of the source-specific download or copy actions.

Download actions show Chrome's Save dialog. Copy actions place Markdown on the
clipboard. To capture only part of a webpage, select it, right-click, and choose
**Copy Selection as Markdown**. A brief badge checkmark confirms the copy; an
exclamation mark indicates a failure.

The popup displays progress and concise errors. For more detail, inspect the
extension service worker from `chrome://extensions`.

## How it works

- Reddit capture uses the site's structured `.json` representation and fetches
  it from the active Reddit tab as a same-origin browser request.
- PDF capture reads the underlying bytes locally with bundled PDF.js instead of
  scraping Chrome's rendered PDF viewer.
- Main-content capture uses a locally bundled copy of Mozilla Readability,
  Turndown, and its GFM plugin.
- Selection capture reuses the webpage converter and makes relative links and
  image sources absolute.
- The source-aware popup shows only actions that apply to the active tab.
- Copy and download actions share one export path and produce ordinary Markdown
  without targeting a particular notes application.

Markdown Capture uses temporary, user-invoked access to the active tab rather
than persistent access to every website. Its permissions and development model
are documented in [DEVELOPMENT.md](DEVELOPMENT.md).

## Why Markdown Capture exists

Markdown Capture is a spiritual successor to
[MarkDownload](https://github.com/deathau/markdownload), not a fork or an
affiliated continuation. It aims for a middle ground between selection-focused
copy tools and notes-app-specific web clippers: ordinary Markdown output, local
processing, a compact copy/download interface, and specialized adapters where
generic page conversion loses important structure.

The project began as a structured Reddit exporter and is evolving through the
phases in [ROADMAP.md](ROADMAP.md). Source-aware conversion remains deliberately
smaller and more opinionated than a general web-scraping or note-management
system.

## Test

Requires Node.js 18 or newer.

```bash
npm install
npm test
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for the Chrome development loop, vendored
runtime maintenance, permissions, and versioning. See
[ROADMAP.md](ROADMAP.md) for completed phases and planned source support, and
[CHANGELOG.md](CHANGELOG.md) for release history.

## Limitations

- Generic webpage capture is best effort. Readability may omit content on
  application-style pages or choose the wrong region on unusual layouts.
- Search results, news homepages, feeds, dashboards, and other collections of
  repeated cards are not reliably supported yet because they do not have one
  dominant article body.
- Dynamic content that has not rendered when capture begins is not included.
- Complex interactive components, forms, canvas content, and visual layout do
  not have lossless Markdown equivalents.
- Selection capture is limited to HTTP(S) documents where Chrome permits
  active-tab script injection. Restricted browser pages are not supported.
- PDF capture currently recognizes only HTTP(S) URLs whose path ends in
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
- Very large threads are limited by the comments included in Reddit's initial
  JSON response.
