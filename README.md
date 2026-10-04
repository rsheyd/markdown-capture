# Markdown Capture

A lightweight, local-first Chrome extension that captures supported web content as clean Markdown. It works with any Markdown editor, requires no account, and performs conversion in the browser without sending captured content to a hosted service.

[![Latest release](https://img.shields.io/github/v/release/rsheyd/markdown-capture?display_name=tag&sort=semver)](https://github.com/rsheyd/markdown-capture/releases/latest) · [Install Markdown Capture from the Chrome Web Store](https://chromewebstore.google.com/detail/markdown-capture/gabiloifhoihennbcfkafmpgepijdkgg).

## Help improve Markdown Capture

Do you regularly save webpages, discussions, or excerpts as Markdown? Try Markdown Capture during your normal workflow for a week, then share what worked or needed cleanup. A short report is enough: what were you trying to capture, where did you use the Markdown, and what happened?

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/markdown-capture/gabiloifhoihennbcfkafmpgepijdkgg) · [Share feedback on GitHub](https://github.com/rsheyd/markdown-capture/issues/new)

You can also reply wherever you found the extension. For capture problems, a public example URL and a description of the expected result help; remove private content from any examples or diagnostic reports you share.

## Supported captures

| Source | Action | Result |
| --- | --- | --- |
| Reddit post | **Copy Markdown** or **Download Markdown** under **All comments** | Post metadata, body, and returned comment hierarchy |
| Reddit comment permalink | **Copy Markdown** or **Download Markdown** under **This comment thread** | The selected comment and its returned replies |
| Text-based PDF or Gmail PDF attachment | **Copy PDF as Markdown** | Basic page-by-page text with title and source URL |
| Gmail conversation | **Copy**, **Download Conversation**, or **Download with images** | Loaded messages with sender, recipients, timestamp, and cleaned body; the image ZIP also includes detected inline photos and attached image files |
| Article or documentation page | **Copy main content** | Best-effort Readability extraction converted to Markdown |
| Discussion, listing, application-style page, or form | **Copy page content** or **Download page content** | Rendered content from the page's main region, including entered text and selected form state, with action controls removed |
| Webpage with images | **Download with images** | ZIP containing Markdown and downloaded images with relative links; failed images retain web URLs |
| Craigslist post | **Copy post**, **Download Markdown**, or **Download with images** | Post title, price, details, description, and detected gallery photos; the ZIP requests Craigslist's 1200×900 rendition for every gallery entry |
| Selected webpage content | Press `Option+Shift+M` on macOS, `Alt+Shift+M` elsewhere, or choose **Copy selection** from the toolbar popup or **Copy Selection as Markdown** from the context menu | Readable selected content with absolute links and portable image references |

Specialized Reddit, PDF, and Craigslist handling takes priority over generic webpage capture. PDF and webpage conversion are best effort; see [Limitations](#limitations) before relying on layout-sensitive output.

## Install

Install the published extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/markdown-capture/gabiloifhoihennbcfkafmpgepijdkgg), then pin **Markdown Capture** from Chrome's Extensions menu.

### Install locally for development

Clone or download this repository first. No build step is required for normal use; the conversion dependencies used by Chrome are already bundled locally.

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project directory—the directory containing `manifest.json`.
5. Pin **Markdown Capture** from Chrome's Extensions menu.
6. Open a supported source and click the extension icon.
7. Choose one of the source-specific download or copy actions.

Download actions show Chrome's Save dialog. Copy actions place Markdown on the clipboard. To capture only part of a webpage, select it and press `Option+Shift+M` on macOS or `Alt+Shift+M` elsewhere. The toolbar popup leads with **Copy selection** when text is selected; the context menu has a single **Copy Selection as Markdown** action. For capture problems, enable **Include debug info** in the popup and repeat the action. The resulting Markdown contains a diagnostic HTML comment, which may include captured content; review it before sharing. Chrome's native Ctrl+C clipboard formats are not included. A brief badge checkmark confirms the context-menu copy; an exclamation mark indicates a failure. Chrome shortcuts can be changed at `chrome://extensions/shortcuts`.

On webpages without a selection, the popup leads with **Copy main content** and places **Copy page content**, downloads, and other options under **More options**. If main-content extraction fails, it offers **Copy page content** directly. The popup displays progress and concise errors. For more detail, inspect the extension service worker from `chrome://extensions`.

## Export metadata

Every non-selection copy or download begins with an HTML comment containing the source URL, replacing the visible source link. The URL uses the exporter’s canonical URL when available, or its source page/PDF URL otherwise. Comments are visible in the raw Markdown but hidden in most rendered previews. Selection copies gain this metadata block when capture time and SHA-256 are enabled.

Enable **Include capture time and SHA-256** under **More options** on webpages (or below the actions on other supported sources) to add the UTC time when capture begins and a SHA-256 hash. Enable **Include debug info** to add a trailing diagnostic HTML comment to copied or downloaded Markdown; image ZIP reports list detected image URLs, saved paths, and fetch failures. Both checkboxes are off by default, remembered locally, and apply to popup, right-click, and keyboard selection copies as well as non-selection actions. When both are enabled, the hash covers the content and debug comment.

```markdown
<!-- Markdown Capture metadata
Source URL: https://example.com/article
Captured at: 2026-09-26T18:42:07.123Z
SHA-256: <64-character hexadecimal hash>
Hash scope: Exact UTF-8 bytes after the closing metadata marker and its two LF characters, including all whitespace and the final newline.
-->

# Article title
```

To verify a saved file, find the first `-->` followed by two LF characters and calculate SHA-256 over all remaining bytes, without trimming or changing line endings. The metadata block and its blank separator are excluded. Editing the content invalidates the hash; editing the metadata does not. A clipboard destination may change whitespace or line endings, so use the downloaded file when exact byte preservation matters. The hash checks content integrity against a recorded hash; it does not independently prove the source page, capture date, or completeness of the extraction.

## How it works

- Reddit capture uses the site's structured `.json` representation and fetches it from the active Reddit tab as a same-origin browser request.
- PDF capture reads the underlying bytes locally with bundled PDF.js instead of scraping Chrome's rendered PDF viewer.
- Main-content capture uses a locally bundled copy of Mozilla Readability, Turndown, and its GFM plugin.
- Page-content capture converts the semantic main region (or the document body as a fallback) after removing common navigation, action controls, dialogs, and hidden elements while preserving visible questions, entered text, selected options, and checkbox or radio state.
- Gmail conversation capture reads the loaded message containers directly, removes repeated quoted history and presentation-only email markup, and preserves real data tables. Its image ZIP also reads visible image attachment links from each loaded message.
- Selection capture reuses the webpage converter and makes relative links and image sources absolute.
- Shared HTML conversion omits menus, toolbars, tooltips, hidden elements, and action buttons, including hover reaction options. Message text and recorded reaction state remain content. Plain-text fallback cannot identify controls when HTML is unavailable.
- The source-aware popup shows only actions that apply to the active tab.
- Copy and download actions share one export path and produce ordinary Markdown without targeting a particular notes application.

Markdown Capture uses temporary, user-invoked access to the active tab rather than persistent access to every website. Its permissions and development model are documented in [DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Why Markdown Capture exists

Markdown Capture is a spiritual successor to [MarkDownload](https://github.com/deathau/markdownload), not a fork or an affiliated continuation. It aims for a middle ground between selection-focused copy tools and notes-app-specific web clippers: ordinary Markdown output, local processing, a compact copy/download interface, and specialized adapters where generic page conversion loses important structure.

The project began as a structured Reddit exporter and is evolving through the phases in [ROADMAP.md](docs/ROADMAP.md). Source-aware conversion remains deliberately smaller and more opinionated than a general web-scraping or note-management system.

The immediate selection-HTML capture approach was informed by the MIT-licensed [Copy as Markdown](https://github.com/yorkxin/copy-as-markdown) extension. Its source was especially useful for avoiding selection loss on dynamic pages while retaining temporary `activeTab` access.

## Test

Requires Node.js 18 or newer.

```bash
npm install
npm test
```

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for the Chrome development loop, vendored runtime maintenance, permissions, and versioning. See [ROADMAP.md](docs/ROADMAP.md) for completed phases and planned source support, and [CHANGELOG.md](CHANGELOG.md) for release history. The extension's data handling is described in [PRIVACY.md](PRIVACY.md).

## Limitations

- Generic webpage capture is best effort. Readability may omit content on application-style pages or choose the wrong region on unusual layouts.
- Page-content capture can preserve repeated cards and discussion comments, but site-specific interface text may remain and visual groupings may be flattened.
- Dynamic content that has not rendered when capture begins is not included.
- Gmail conversation capture includes loaded messages. Expand any message whose body Gmail has not loaded before capturing the conversation. Image ZIP capture is best effort for inline images and visible attached image files; other attachment types are not downloaded.
- Complex interactive components, forms, canvas content, and visual layout do not have lossless Markdown equivalents.
- Selection capture is limited to HTTP(S) documents where Chrome permits active-tab script injection. Restricted browser pages are not supported.
- PDF capture currently recognizes only HTTP(S) URLs whose path ends in `.pdf` and PDF attachments opened in Gmail's standard projector viewer.
- PDF capture supports text-based PDFs only. Scanned or image-only PDFs need OCR, which is not supported yet.
- PDF reading order uses a basic visual top-to-bottom sort with left-to-right tie-breaking. This improves misplaced headings, but multicolumn layouts may be interleaved and complex tables may be flattened.
- Password-protected PDFs are not supported.
- Comment-thread export is available only from a direct comment permalink.
- Collapsed or omitted comments represented by `kind: "more"` are not expanded.
- Media, galleries, flair, awards, and avatars are not specially formatted.
- Very large threads are limited by the comments included in Reddit's initial JSON response.

## Selection output quality

Default selection copy keeps useful Markdown structure while removing action controls, explicitly decorative images, and status images whose labels repeat nearby text. The popup also offers **Copy selection (preserve source)**, which keeps more source controls and image labels. Right-click and keyboard copy always use the default; there is only one right-click action.

Both modes keep HTTP(S) image references and replace embedded image data or temporary blob URLs with alt text or an image placeholder. Hidden elements remain omitted. Preserve-source does not reproduce page styling or promise lossless capture, and neither mode uses AI. Use **Download with images** for actual webpage image assets. These image rules also apply to ordinary HTML page and Gmail conversion; structured Reddit and PDF exporters remain separate.

## Craigslist posts

When the active tab is a Craigslist post, Markdown Capture uses a dedicated adapter instead of the generic webpage converter. **Copy post** and **Download Markdown** capture the title, price, listed details, description, and links to detected gallery photos. The popup shows the gallery count in **Download with images (13 detected)** for a post with 13 photos. That action saves Markdown and detected gallery photos in order in a ZIP, requesting Craigslist's 1200×900 display rendition instead of the small thumbnails. Chrome asks once for access to `images.craigslist.org` when you choose this action; declining it cancels the ZIP download. It works on current `/view/d/` and older post URLs, not Craigslist search results. Gallery detection and image fetching are best effort; check the popup's failure count and the ZIP when a photo is important.

## Download with images

On ordinary webpages, **Download with images** captures the same content as **Download page content** and saves a ZIP containing the Markdown file and a sibling `<note-name>-images/` folder. Extract both together into an Obsidian vault or another Markdown folder; successful image downloads use relative Markdown links and work offline. Duplicate image URLs share one local file. Keep the popup open while images download.

On Craigslist posts, the dedicated adapter reads the gallery entries, puts detected photos in the Markdown in gallery order, and requests their 1200×900 renditions for the ZIP. This is a Craigslist display rendition, not a promise of the original uploaded files. The extension requests optional access to `images.craigslist.org` for this action and fetches those images from its popup. On Gmail conversations, the ZIP includes inline images from loaded messages and visible attached image files when Gmail exposes an image attachment link. Gmail image requests run in the Gmail tab using the existing session; remote inline image hosts may still fail CORS. On other webpages, images must already be represented in the captured page content; cross-origin servers must allow CORS. Blocked, unavailable, unsupported, or oversized images retain their original URLs, and the popup reports the number not saved. Limits are 100 unique image URLs, 10 MB per image, 50 MB total saved images, and 15 seconds per fetch. The action does not apply to Reddit, PDFs, or selection capture. Optional integrity metadata hashes the final Markdown payload after image paths are rewritten; it does not hash the image files.
