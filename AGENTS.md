# Project instructions

- Keep this a small Reddit-only Manifest V3 extension.
- Do not introduce generic webpage extraction or a popup without an explicit product decision.
- Keep Reddit conversion logic independent from Chrome APIs and covered by Node tests.
- Preserve the one-click flow: click the action, fetch JSON, and download Markdown.

## File map

- `README.md` — purpose, installation, usage, and limitations.
- `CHANGELOG.md` — user-visible changes organized by extension version.
- `DEVELOPMENT.md` — local Chrome loop, tests, smoke checks, and versioning.
- `manifest.json` — extension permissions and service-worker entry point.
- `src/background.js` — Chrome orchestration and download behavior.
- `src/reddit.js` — pure Reddit URL and Markdown conversion logic.
- `test/reddit.test.js` — unit tests.
