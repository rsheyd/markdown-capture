# Changelog

## 0.6.1

- Added `Option+Shift+M` on macOS and `Ctrl+Shift+M` elsewhere to copy the
  current webpage selection as Markdown, including selections inside frames
  where Chrome permits active-tab access.
- Displayed the platform-specific keyboard shortcut in the selection context
  menu label.

## 0.6.0

- Added **Copy Full Page Content** and **Download Full Page Content** for
  discussions, listings, and other multi-region pages that Readability may
  reduce to a single content block.
- Kept **Copy Main Content** as the cleaner Readability-based article path and
  removed the less-used **Download Main Content** action.
- Excluded common navigation, forms, controls, dialogs, and hidden elements
  from full-page capture while preserving rendered content within the page's
  semantic main region.
- Conservatively removed editable and visually hidden interface content,
  duplicate leading titles, empty wrappers, and adjacent duplicate links while
  preserving meaningful secondary content such as notes and asides.

## 0.5.2

- Copied selection-capture error messages to the clipboard when possible, so a
  failed capture does not silently leave unrelated clipboard contents behind;
  diagnostics include the page or frame URL where capture was invoked.
- Fell back to Chrome's plain-text selection snapshot when a dynamic page no
  longer exposes its selected DOM range by the time conversion runs.
- Captured selected HTML before loading the conversion bundle, preserving links
  and block structure on dynamic pages such as LinkedIn. This approach was
  informed by the MIT-licensed Copy as Markdown extension.
- Requested immediate selection-script injection and logged content-free
  capture diagnostics to distinguish HTML conversion from plain-text fallback.

## 0.5.1

- Added **Copy Selection as Markdown** to Chrome's selection context menu.
- Reused the locally bundled Phase 3A converter for headings, links, images,
  lists, quotes, tables, and code within selected content.
- Made relative selection links and image sources absolute and handled all DOM
  ranges exposed by Chrome for the selection.
- Added brief success and failure badge feedback without opening the popup.

## 0.5.0

- Added best-effort Markdown capture for ordinary HTTP(S) webpages, with Copy
  and Download actions after the specialized Reddit and PDF adapters.
- Added local primary-content extraction with Mozilla Readability and
  HTML-to-Markdown conversion with Turndown and its GFM plugin.
- Preserved common headings, lists, links, images, tables, quotes, inline code,
  and fenced code blocks where practical.
- Bundled the webpage conversion runtime and dependency licenses locally.
- Added article, documentation, table, list, and browser-bundle fixtures.
- Labeled generic actions as main-content extraction and documented that
  listing-style pages such as search results and news homepages are not yet
  reliably supported.

## 0.4.0

- Added a common source-adapter registry for Reddit and PDF capture.
- Normalized every export to Markdown content, title, canonical source URL,
  and suggested filename.
- Centralized copy and download handling while keeping Chrome-specific source
  acquisition at the adapter boundary.
- Made the popup render the detected source and only its applicable actions.

## 0.3.0

- Renamed the extension from Reddit Markdown Exporter to Markdown Capture.
- Defined the local-first multi-source direction, common export metadata, and
  minimal permission policy.
- Added a phased roadmap beginning with basic text-PDF capture while retaining
  the existing Reddit functionality.
- Added local, basic text extraction for straightforward HTTP(S) PDF tabs with
  a **Copy PDF as Markdown** action.
- Added clear errors for non-PDF responses, malformed or password-protected
  files, and PDFs without extractable text.
- Bundled PDF.js 4.8.69 locally and added pure conversion tests plus a
  redistributable PDF fixture.
- Added a Gmail acquisition special case that resolves the matching
  authenticated PDF attachment and fetches it in Gmail's same-origin tab
  context rather than from the cross-origin popup.
- Improved basic PDF reading order by sorting positioned text top-to-bottom
  and using left-to-right order for text on the same visual line.

## 0.2.0

- Replaced the one-click download with a compact four-action popup.
- Added clipboard export alongside Markdown file downloads.
- Added a choice between all returned comments and the selected comment thread.
- Fixed full-discussion exports opened from a comment permalink so they request the post-level JSON endpoint.

## 0.1.1

- Fixed Reddit JSON requests failing with HTTP 403 by fetching from the active Reddit tab as a same-origin request with the browser's normal Reddit session.
- Removed the extension's broad Reddit host permissions; the one-click export now uses `activeTab` and `scripting` access instead.

## 0.1.0

- Initial release.
- Added one-click Reddit post and comment export to a Markdown file.
