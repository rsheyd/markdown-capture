# Development

The project has no build step. Load the repository directory directly as an unpacked Chrome extension.

## Development loop

1. Edit files in `src/` or `manifest.json`.
2. Run `npm test`.
3. Open `chrome://extensions` and reload **Markdown Capture**.
4. Open a Reddit post, click the extension icon, and exercise the popup actions.
5. Inspect the extension's service worker from its card on `chrome://extensions` to view logs or debug a failed request.

Test at least:

- A text post with nested comments.
- A link post.
- A post with deleted or removed comments.
- An `old.reddit.com` post URL.
- A direct comment permalink, using both full-discussion and comment-thread actions.
- Both download and clipboard output.
- A non-Reddit tab, which should disable the actions and show an error.
- A public text-based `.pdf` URL, which should show only the PDF copy action.
- The copied PDF Markdown title, source URL, paragraph text, and page breaks.
- A scanned or image-only `.pdf`, which should report the OCR limitation.
- A PDF attachment opened in Gmail's projector viewer. Confirm that the
  matching attachment is copied and that the Markdown source link is the
  visible Gmail viewer URL, not its internal authenticated download URL.
  Gmail attachment bytes must be fetched inside the Gmail tab as a same-origin
  request; a direct fetch from the extension popup is cross-origin and fails.

## Vendored PDF.js

PDF capture uses the exact `pdfjs-dist` version in `package.json`. Chrome loads
the browser-ready copies in `vendor/pdfjs/`, so updating the npm dependency
alone does not update the extension runtime. After changing the version, copy
the runtime files and license using the commands in `vendor/pdfjs/README.md`,
then run the full tests and Chrome PDF smoke checks.

## Versioning

The extension has a single version source: the `version` field in `manifest.json`. The private `package.json` intentionally has no version because this project is not published to npm.

Update `manifest.json`, run the tests, and complete the manual smoke checks above before creating a release.

## Product and permission baseline

Markdown Capture is a local-first, user-invoked exporter. Conversion code and
third-party libraries must be bundled with the extension; do not load remote
executable code or send captured content to a hosted conversion service.

The current permission baseline is:

- `activeTab` for temporary access after the user invokes the extension.
- `scripting` for narrowly scoped work in the active tab.
- `clipboardWrite` for explicit Copy actions.
- `downloads` for explicit Download actions.

Prefer `activeTab` to broad persistent host access. Add a permission only for
a demonstrated supported workflow, document why it is needed, and retest the
install or upgrade warning before release.

Future source adapters will normalize their output to four required values:
Markdown content, a title, a canonical source URL, and a safe suggested
filename. `src/adapters.js` owns detection, applicable actions, and the common
capture contract. `src/export.js` owns copy/download dispatch. Chrome-facing
acquisition is supplied to adapters as an injected dependency so detection and
conversion remain testable in Node without Chrome APIs.
