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
- An ordinary article, which should show **Copy Main Content**, **Copy Full Page Content**, **Download Full Page Content**, and **Download with images**. Confirm main-content copy omits obvious navigation and page chrome.
- A documentation page with headings, links, lists, and fenced code.
- A page with a table, confirming that a readable GFM table is returned.
- A search results page or news homepage, confirming that its current limitations are understood rather than treating it as an article fixture.
- A restricted URL such as `chrome://extensions`, which should show an unsupported-source error.
- A selection containing headings, emphasis, a relative link, and an image. Test both **Copy Selection as Markdown** from the context menu and `Option+Shift+M` on macOS (`Alt+Shift+M` elsewhere), then confirm the copied structure, absolute URLs, and brief success badge.
- An empty or unavailable selection failure, confirming the brief failure badge and a useful error in the extension service-worker console.
- A LinkedIn conversation selection with multiple messages. Confirm that copied Markdown retains paragraph breaks. Then select the conversation again, click the toolbar icon, confirm **Copy Selection as Markdown** copies the same text, and confirm **Copy Selection Debug Info** includes the selected HTML, browser text, and final output. Confirm the context-menu copy action is shown directly without a submenu.
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

Prefer `activeTab` to broad persistent host access. Add a permission only for a demonstrated supported workflow, document why it is needed, and retest the install or upgrade warning before release.

Future source adapters will normalize their output to four required values: Markdown content, a title, a canonical source URL, and a safe suggested filename. `src/adapters.js` owns detection, applicable actions, and the common capture contract. `src/export.js` owns copy/download dispatch. Chrome-facing acquisition is supplied to adapters as an injected dependency so detection and conversion remain testable in Node without Chrome APIs.

### Image ZIP smoke check

Reload the unpacked extension, open an HTTP(S) page with a same-origin image, a duplicate, and a broken image, then choose **Download with images**. Keep the popup open. Confirm the saved ZIP contains Markdown plus one copy of each successfully fetched image, local links display offline after extracting both together, and failed images retain their URLs with a visible failure count. Check a cross-origin image without CORS is reported as unavailable. With integrity enabled, independently verify the hash of the rewritten Markdown payload.

Verified in Chrome on 2026-09-27: the unpacked extension reloaded as 0.7.4, the image action saved a valid ZIP, duplicate image references shared one downloaded SVG, and a missing image retained its URL with the popup failure count. Independently checked ZIP CRCs, exact image bytes, and the rewritten Markdown SHA-256; the extracted image rendered from a local file after the source server stopped. Obsidian rendering and live cross-origin image behavior were not checked in this smoke test.
