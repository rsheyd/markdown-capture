# Development

Commands and repository file paths below are relative to the repository root.

The checked-in project has no required build step. Load the repository directory directly as an unpacked Chrome extension. Regenerating a vendored runtime after changing its pinned dependency is a separate maintenance step.

## Development loop

1. Edit files in `src/` or `manifest.json`.
2. Run `npm test`.
3. Open `chrome://extensions` and reload **Markdown Capture**.
4. Open a Reddit post, click the extension icon, and exercise the popup actions.
5. Inspect the extension's service worker from its card on `chrome://extensions` to view logs or debug a failed request.

Test at least:

- Non-selection exports with the integrity checkbox off and on: confirm the source URL appears in the metadata comment instead of a separate visible link, verify the UTC timestamp and SHA-256 against the downloaded UTF-8 content, reopen the popup to confirm the preference persists, and confirm selection exports remain unchanged.

- A text post with nested comments.
- A link post.
- A post with deleted or removed comments.
- An `old.reddit.com` post URL.
- A direct comment permalink, using both full-discussion and comment-thread actions.
- Both download and clipboard output.
- An ordinary article, which should lead with **Copy main content** when nothing is selected and place **Copy page content**, **Download page content**, and **Download with images** under **More options**. Confirm main-content copy omits obvious navigation and page chrome.
- A Craigslist `/view/d/` post with several gallery photos: confirm the popup labels the action **Download with images (N detected)** with the visible gallery count, then download and compare the Markdown photo count and ZIP images with the gallery order. Check that image URLs use the 1200×900 rendition rather than thumbnail sizes, and note any fetch failures shown in the popup. Repeat detection on a legacy post URL when one is available.
- A documentation page with headings, links, lists, and fenced code.
- A page with a table, confirming that a readable GFM table is returned.
- A search results page or news homepage, confirming that its current limitations are understood rather than treating it as an article fixture.
- A restricted URL such as `chrome://extensions`, which should show an unsupported-source error.
- A selection containing headings, emphasis, a relative link, and an image. Test both **Copy Selection as Markdown** from the context menu and `Option+Shift+M` on macOS (`Alt+Shift+M` elsewhere), then confirm the copied structure, absolute URLs, and brief success badge.
- An empty or unavailable selection failure, confirming the brief failure badge and a useful error in the extension service-worker console.
- A LinkedIn conversation selection with multiple messages. Confirm that copied Markdown retains paragraph breaks. Then enable **Include debug info** in the popup and repeat **Copy selection**; inspect the trailing comment for selected HTML, browser text, and final output. Confirm the context-menu copy action is shown directly without a submenu and uses the saved preference.
- A public text-based `.pdf` URL, which should show only the PDF copy action.
- The copied PDF Markdown title, source URL, paragraph text, and page breaks.
- A scanned or image-only `.pdf`, which should report the OCR limitation.
- A PDF attachment opened in Gmail's projector viewer. Confirm that the matching attachment is copied and that the Markdown source link is the visible Gmail viewer URL, not its internal authenticated download URL. Gmail attachment bytes must be fetched inside the Gmail tab as a same-origin request; a direct fetch from the extension popup is cross-origin and fails.

## Vendored PDF.js

PDF capture uses the exact `pdfjs-dist` version in `package.json`. Chrome loads the browser-ready copies in `vendor/pdfjs/`, so updating the npm dependency alone does not update the extension runtime. After changing the version, copy the runtime files and license using the commands in `vendor/pdfjs/README.md`, then run the full tests and Chrome PDF smoke checks.

## Vendored webpage converter

Generic webpage capture uses the exact Readability, Turndown, and GFM plugin versions in `package.json`. Chrome loads the generated `vendor/webpage/webpage.js` bundle rather than `node_modules`. After changing one of those versions, run `npm install`, `npm run vendor:webpage`, refresh the license files as documented in `vendor/webpage/README.md`, then run the full tests and generic webpage Chrome smoke checks.

## Versioning

The extension has a single version source: the `version` field in `manifest.json`. The private `package.json` intentionally has no version because this project is not published to npm.

Keep `manifest.json` unchanged while developing and consolidate user-visible changes under its `Unreleased` changelog heading. When Roman asks to release, complete the manual Chrome smoke checks above. The release script accepts `## Unreleased` and advances the manifest patch version when it matches the previous release heading; an explicitly prepared newer manifest version is retained. It also accepts `## VERSION — Unreleased` for a manually chosen version. The script records the version and date and publishes the matching GitHub release. If publishing is interrupted after the changelog commit, rerun the script; the dated heading is accepted.

## Release packaging

The current public release is available from the [Chrome Web Store](https://chromewebstore.google.com/detail/markdown-capture/gabiloifhoihennbcfkafmpgepijdkgg). The listing ID is `gabiloifhoihennbcfkafmpgepijdkgg`.

After completing the manual Chrome smoke checks, preview the release without changing files or contacting GitHub:

```bash
scripts/create-github-release.sh --dry-run
```

Commit all release changes, then run `scripts/create-github-release.sh`. It requires a clean `main` checkout and the expected `origin`, runs `npm test`, packages and verifies the exact Chrome Web Store ZIP, prepares and commits the manifest version and dated changelog, pushes `main`, and creates or verifies the matching GitHub release with the ZIP attached. A rerun uploads the ZIP if an existing GitHub release lacks it. The script does not submit to the Chrome Web Store.

The ZIP is `dist/markdown-capture-VERSION.zip`. It has `manifest.json` at its root and excludes tests, development documentation, store-listing graphics, and package-manager files. Inspect it with `unzip -l` before uploading.

Use [STORE-LISTING.md](STORE-LISTING.md) for the dashboard fields, graphic assets, privacy declarations, and manual submission sequence. Each uploaded update must have a version greater than the currently uploaded version.

## Product and permission baseline

Markdown Capture is a local-first, user-invoked exporter. Conversion code and third-party libraries must be bundled with the extension; do not load remote executable code or send captured content to a hosted conversion service.

The current permission baseline is:

- `activeTab` for temporary access after the user invokes the extension.
- `scripting` for narrowly scoped work in the active tab.
- `clipboardWrite` for explicit Copy actions.
- `contextMenus` for the explicit **Copy Selection as Markdown** action.
- `downloads` for explicit Download actions.
- `storage` for the two remembered export checkboxes.
- Optional `https://images.craigslist.org/*` host access, requested on a Craigslist **Download with images** click because gallery photos are on a different origin from the post and page-context fetching is blocked by CORS.

Prefer `activeTab` to broad persistent host access. Add a permission only for a demonstrated supported workflow, document why it is needed, and retest the install or upgrade warning before release.

Future source adapters will normalize their output to four required values: Markdown content, a title, a canonical source URL, and a safe suggested filename. `src/adapters.js` owns detection, applicable actions, and the common capture contract. `src/export.js` owns copy/download dispatch. Chrome-facing acquisition is supplied to adapters as an injected dependency so detection and conversion remain testable in Node without Chrome APIs.

### Image ZIP smoke check

Reload the unpacked extension, open an HTTP(S) page with a same-origin image, a duplicate, and a broken image, then choose **Download with images**. Keep the popup open. Confirm the saved ZIP contains Markdown plus one copy of each successfully fetched image, local links display offline after extracting both together, and failed images retain their URLs with a visible failure count. Check a cross-origin image without CORS is reported as unavailable. With integrity enabled, independently verify the hash of the rewritten Markdown payload.

Verified in Chrome on 2026-09-27: the unpacked extension reloaded as 0.7.4, the image action saved a valid ZIP, duplicate image references shared one downloaded SVG, and a missing image retained its URL with the popup failure count. Independently checked ZIP CRCs, exact image bytes, and the rewritten Markdown SHA-256; the extracted image rendered from a local file after the source server stopped. Obsidian rendering and live cross-origin image behavior were not checked in this smoke test.

Craigslist gallery capture has synthetic fixture coverage; live Craigslist ZIP verification is pending. On a Craigslist post, choose **Download with images**, grant the optional image-host permission, and confirm the ZIP contains each detected gallery image at the larger display rendition. Declining permission should cancel the ZIP. With **Include debug info** enabled, inspect the Markdown inside the ZIP for detected image URLs, saved paths, and each failure reason.

For Gmail, expand all messages, then choose **Download with images** on a conversation with an inline photo and an attached JPEG or PNG. Confirm the ZIP contains those images and readable message Markdown, while non-image attachments remain outside the ZIP. A Gmail attachment without a visible image link may not be detected. Inspect the debug report for any per-image fetch failure. Live Gmail image ZIP verification is pending.

## Readable Markdown and preserve-source validation

The shared HTML converter defaults to readable output. Preserve-source selection copy relaxes control and image cleanup; both policies omit hidden elements and replace nonportable image references with labels. ZIP capture collects actual image assets instead. A small image is not necessarily decorative, and meaningful content must not be discarded to satisfy a size target.

Use synthetic content covering embedded attachment thumbnails, explicitly decorative images, redundant status icons with visible labels, meaningful diagrams, relative links, blob images, headings, lists, tables, and fenced code. Assert preserved content as well as absence of payloads. Regenerate the browser bundle with `npm run vendor:webpage` after every converter change, then run `npm test`.

Before release, reload the unpacked extension and select a confirmation-style page. Compare popup default and **Copy selection (preserve source)**: both should contain readable attachment labels without embedded payloads; preserve-source should keep more source labels and controls. Confirm the single right-click action and keyboard shortcut still match the default. Check meaningful images and an image ZIP export, and repeat the LinkedIn paragraph-break smoke check. Automated tests do not establish live Chrome selection or clipboard behavior.

Verified in live Chrome on 2026-09-27 after Roman reloaded the unpacked extension: a synthetic selection with a 500,000-character embedded thumbnail produced 329 characters via popup default, keyboard shortcut, and the single direct right-click action. All retained the attachment label, visible status, link, meaningful chart reference, list, and code, with no data/blob image URLs. Popup preserve-source produced 362 characters and additionally retained the action control and redundant status image label. The longer popup label wrapped without clipping. Checked by pasting the actual clipboard output into a local verification field. This check did not exercise the private original page, LinkedIn, or ZIP downloads; the 81-test suite covers the asset path separately.

## Context-aware popup handoff check

The webpage popup checks only whether text is selected; it does not classify the page as an article. With selected text, **Copy selection** is primary. Without selected text, **Copy main content** is primary. **More options** contains alternate actions and the two export checkboxes; preserve-source appears when a selection is detected. When main-content extraction fails, a visible **Copy page content** button offers the fallback directly. The PDF, Reddit, and Gmail source menus retain their source-specific actions.

Roman's Chrome validation before release: reload the unpacked extension, then check a selected article (selection is primary and preserve-source is under More options), the same article with no selection (main content is primary), and a results-style page where main extraction fails (the page-content fallback appears and copies content). Check the More options disclosure, its integrity preference, both downloads, Reddit and PDF menus, and the unchanged single right-click action and shortcut. The automated suite validates behavior but this popup redesign has not been live-validated in Chrome by Codex.
