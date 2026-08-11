# Project instructions

- Keep this a small Reddit-only Manifest V3 extension.
- Do not introduce generic webpage extraction.
- Keep Reddit conversion logic independent from Chrome APIs and covered by Node tests.
- Keep the popup a compact menu of export actions rather than a settings interface.

## File map

- `README.md` — purpose, installation, usage, and limitations.
- `CHANGELOG.md` — user-visible changes organized by extension version.
- `DEVELOPMENT.md` — local Chrome loop, tests, smoke checks, and versioning.
- `manifest.json` — extension permissions and service-worker entry point.
- `src/background.js` — Reddit fetching, conversion orchestration, and download behavior.
- `src/popup.html` — compact export-action menu markup.
- `src/popup.css` — popup menu styling.
- `src/popup.js` — active-tab checks, action messaging, and clipboard behavior.
- `src/reddit.js` — pure Reddit URL and Markdown conversion logic.
- `test/reddit.test.js` — unit tests.
