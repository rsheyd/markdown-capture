# Markdown Capture

A lightweight, local-first Chrome extension that captures supported web
content as clean Markdown. It works with any Markdown editor, requires no
account, and performs conversion in the browser without sending captured
content to a hosted service.

[![Latest release](https://img.shields.io/github/v/release/rsheyd/markdown-capture?display_name=tag&sort=semver)](https://github.com/rsheyd/markdown-capture/releases/latest) · [Install Markdown Capture from the Chrome Web Store](https://chromewebstore.google.com/detail/markdown-capture/gabiloifhoihennbcfkafmpgepijdkgg).

## Supported captures

| Source | Action | Result |
| --- | --- | --- |
| Reddit post | **Copy** or **Download Full Discussion** | Post metadata, body, and returned comment hierarchy |
| Reddit comment permalink | **Copy** or **Download Comment Thread** | The selected comment and its returned replies |
| Text-based PDF or Gmail PDF attachment | **Copy PDF as Markdown** | Basic page-by-page text with title and source URL |
| Article or documentation page | **Copy Main Content** | Best-effort Readability extraction converted to Markdown |
| Discussion, listing, or application-style page | **Copy** or **Download Full Page Content** | Rendered content from the page's main region with common controls removed |
| Selected webpage content | Press `Option+Shift+M` on macOS, `Alt+Shift+M` elsewhere, or choose **Copy Selection as Markdown** from the context menu | The selected structure with absolute links and image URLs |

Specialized Reddit and PDF handling takes priority over generic webpage
capture. PDF and webpage conversion are best effort; see
[Limitations](#limitations) before relying on layout-sensitive output.

## Install

Install the published extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/markdown-capture/gabiloifhoihennbcfkafmpgepijdkgg), then pin **Markdown Capture** from Chrome's Extensions menu.

### Install locally for development

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
clipboard. To capture only part of a webpage, select it and press
`Option+Shift+M` on macOS or `Alt+Shift+M` elsewhere. The context menu's
**Copy Selection as Markdown** action remains available. A brief badge
checkmark confirms the copy; an exclamation mark indicates a failure. Chrome
shortcuts can be changed at `chrome://extensions/shortcuts`.

The popup displays progress and concise errors. For more detail, inspect the
extension service worker from `chrome://extensions`.

## How it works

- Reddit capture uses the site's structured `.json` representation and fetches
  it from the active Reddit tab as a same-origin browser request.
- PDF capture reads the underlying bytes locally with bundled PDF.js instead of
  scraping Chrome's rendered PDF viewer.
- Main-content capture uses a locally bundled copy of Mozilla Readability,
  Turndown, and its GFM plugin.
- Full-page capture converts the semantic main region (or the document body as
  a fallback) after removing common navigation, forms, controls, dialogs, and
  hidden elements.
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

The immediate selection-HTML capture approach was informed by the MIT-licensed
[Copy as Markdown](https://github.com/yorkxin/copy-as-markdown) extension. Its
source was especially useful for avoiding selection loss on dynamic pages
while retaining temporary `activeTab` access.

## Test

Requires Node.js 18 or newer.

```bash
npm install
npm test
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for the Chrome development loop, vendored
runtime maintenance, permissions, and versioning. See
[ROADMAP.md](ROADMAP.md) for completed phases and planned source support, and
[CHANGELOG.md](CHANGELOG.md) for release history. The extension's data handling is described in [PRIVACY.md](PRIVACY.md).

## Limitations

- Generic webpage capture is best effort. Readability may omit content on
  application-style pages or choose the wrong region on unusual layouts.
- Full-page capture can preserve repeated cards and discussion comments, but
  site-specific interface text may remain and visual groupings may be flattened.
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
