# Project instructions

- Build Markdown Capture as a small, local-first Manifest V3 extension that
  exports supported sources to ordinary Markdown.
- Follow the implementation sequence and scope boundaries in `ROADMAP.md`;
  do not introduce generic webpage extraction before its planned phase.
- Preserve the structured Reddit exporter while adding source types.
- Keep all source conversion logic independent from Chrome APIs and covered by
  Node tests and fixtures.
- Keep the popup a compact, source-aware menu of export actions rather than a
  settings interface.
- Bundle conversion dependencies locally. Do not load remote executable code
  or send captured content to a hosted conversion service.
- Prefer user-invoked `activeTab` access. Add broader permissions only for a
  demonstrated supported workflow and document the reason.
- Increase the version for user-visible changes and record them under that
  exact version in `CHANGELOG.md`; do not use an Unreleased section. Minor
  documentation, planning, template-copy, test-only, and internal-maintenance
  changes do not require a version bump unless they accompany a release.
- Use the MIT-licensed [Copy as Markdown](https://github.com/yorkxin/copy-as-markdown)
  source as a practical reference when debugging selection capture, context
  menus, frame targeting, or clipboard behavior.

## File map

- `README.md` — purpose, installation, usage, and limitations.
- `CHANGELOG.md` — user-visible changes organized by extension version.
- `DEVELOPMENT.md` — local Chrome loop, tests, smoke checks, and versioning.
- `ROADMAP.md` — phased plan for evolving into a multi-source Markdown exporter.
- `manifest.json` — extension permissions and service-worker entry point.
- `src/adapters.js` — source registry, detection, actions, and adapter capture contracts.
- `src/export.js` — shared copy and download orchestration.
- `src/background.js` — same-origin Reddit acquisition and selection context-menu orchestration.
- `src/popup.html` — compact export-action menu markup.
- `src/popup.css` — popup menu styling.
- `src/popup.js` — active-tab checks, action messaging, and clipboard behavior.
- `src/pdf.js` — pure PDF URL detection and basic text-to-Markdown conversion.
- `src/pdf-capture.js` — PDF fetching and browser-side PDF.js orchestration.
- `src/gmail-pdf.js` — Gmail PDF viewer detection and attachment URL resolution.
- `src/reddit.js` — pure Reddit URL and Markdown conversion logic.
- `src/selection.js` — immediate, pure selected-DOM extraction before conversion dependencies load.
- `src/shortcuts.js` — platform-specific shortcut labels for Chrome UI surfaces.
- `src/webpage.js` — pure Readability and HTML-to-Markdown conversion logic.
- `vendor/pdfjs/` — vendored PDF.js browser runtime, license, and update notes.
- `vendor/webpage/` — bundled webpage converter, licenses, and update notes.
- `test/pdf.test.js` — PDF detection, conversion, and fixture extraction tests.
- `test/adapters.test.js` — adapter contract, detection, action, and capture tests.
- `test/export.test.js` — normalized shared copy/download orchestration tests.
- `test/gmail-pdf.test.js` — Gmail projector URL detection tests.
- `test/fixtures/` — generated, redistributable PDF fixture and generator.
- `test/reddit.test.js` — Reddit unit tests.
- `test/selection.test.js` — immediate selection extraction and dynamic-page regression tests.
- `test/shortcuts.test.js` — platform-specific shortcut-label tests.
- `test/webpage.test.js` — webpage conversion and browser-bundle fixture tests.
