# Markdown Capture Roadmap

## Direction

Evolve the original Reddit Markdown Exporter into Markdown Capture, a
lightweight, local-first successor to MarkDownload: export the meaningful
content of the active Chrome tab as clean Markdown, using purpose-built source
adapters where they materially improve the result and a generic webpage
fallback elsewhere.

The extension should remain smaller and more opinionated than a full web
clipping or note-management system. It should create ordinary Markdown for any
downstream editor rather than target Obsidian or another specific application.

## Product boundaries

- Process content locally; do not require an account or hosted conversion API.
- Keep Copy and Download as the primary actions.
- Prefer a compact, source-aware popup over a settings-heavy interface.
- Use specialized adapters for structured sources such as Reddit and PDF.
- Label generic webpage and PDF conversion as best-effort where source layout
  cannot be represented faithfully in Markdown.
- Keep source conversion independent from Chrome APIs and cover it with Node
  tests and fixtures.
- Defer selection-oriented context-menu capture until after the adapter
  architecture, then reuse the generic HTML-to-Markdown conversion layer
  rather than building a separate conversion path.
- Do not add note storage, synchronization, tagging, or Obsidian-specific
  vault integration.

## Intended architecture

Each source adapter should expose a small common contract:

- Detect whether it supports the active tab.
- Acquire source data through a thin Chrome-facing orchestration layer.
- Convert source data to a normalized export result containing Markdown,
  title, source URL, and suggested filename.
- Return actionable limitations or errors for the popup to display.

The adapter registry should prefer specialized adapters, then fall back to the
generic webpage adapter. Clipboard and download behavior should remain shared.

## Phases

### Phase 0 — Define the successor (complete)

- [x] Use the distinctive product name **Markdown Capture**.
- [x] Require every future adapter result to contain Markdown content, a
  title, a canonical source URL, and a safe suggested filename.
- [x] Keep processing local and user-invoked. Bundle dependencies, send no
  captured content to a hosted conversion service, prefer `activeTab`, and add
  permissions only for demonstrated supported workflows.
- [x] Update `AGENTS.md`, the manifest identity, README, changelog, development
  documentation, and package metadata together.

Exit criteria:

- The new name, scope, common export shape, and permission policy are decided.
- Project instructions describe the multi-source product rather than the
  current Reddit-only extension.

### Phase 1 — Add basic PDF-to-Markdown (complete)

Deliver a deliberately small first version immediately after the rename. It
should provide useful text extraction without waiting for the final adapter
architecture or sophisticated layout reconstruction.

- [x] Detect straightforward HTTP(S) PDF tabs, initially using the URL and
  available response metadata.
- [x] Fetch the underlying PDF bytes rather than scraping Chrome's built-in PDF
  viewer.
- [x] Bundle a maintained local PDF parser, PDF.js; do not load executable
  code from a CDN.
- [x] Extract text page by page and join it into simple Markdown with a title,
  source URL, and conservative paragraph breaks.
- [x] Add a compact **Copy PDF as Markdown** action to the existing popup.
- [x] Reuse the current clipboard path; PDF download, preview, and advanced layout
  handling may wait.
- [x] Report encrypted, inaccessible, malformed, scanned, and image-only PDFs with
  a clear error rather than returning an empty result.
- [x] Add a small pure Node test surface and at least one checked-in,
  redistributable text-PDF fixture.
- [x] Document the initial limitations prominently: text-based PDFs only, basic
  reading order, and no reliable table or multicolumn reconstruction.
- [x] Resolve authenticated PDF attachments opened in Gmail's standard
  projector viewer as a small acquisition special case.
- [x] Add a basic visual top-to-bottom text sort, accepting row-interleaved
  columns until the mature layout phase.

Exit criteria:

- A straightforward text-based PDF open in Chrome can be copied as basic
  Markdown.
- Processing occurs locally and does not depend on the PDF viewer DOM.
- Reddit export continues to work as before.
- The implementation is isolated enough to be moved behind the adapter
  contract in Phase 2 without changing its externally visible behavior.

### Phase 2 — Introduce the adapter architecture (complete)

- [x] Define the adapter contract and source registry.
- [x] Move Reddit detection, acquisition, and conversion behind a Reddit adapter
  without changing its user-visible output.
- [x] Separate shared copy/download orchestration from source-specific behavior.
- [x] Make the popup display the detected source and only applicable actions.
- [x] Preserve or expand the existing pure Node tests.

Exit criteria:

- Existing Reddit exports behave as before.
- A new adapter can be added without changing shared output code.
- Unsupported tabs fail clearly rather than silently.

### Phase 3A — Add a generic webpage fallback (`0.5.0`; complete)

- [x] Use a maintained Readability implementation to identify primary page
  content.
- [x] Convert the extracted HTML with a maintained HTML-to-Markdown library such
  as Turndown.
- [x] Preserve common headings, lists, links, images, tables, quotes, and fenced
  code blocks where practical.
- [x] Clearly identify generic extraction as best-effort in the UI and README.
- [x] Add representative fixtures for articles, documentation, tables, and code.

Exit criteria:

- Ordinary articles and documentation pages can be copied or downloaded.
- Navigation, cookie banners, and other obvious page chrome are normally
  omitted.
- Reddit still uses its structured adapter rather than the generic fallback.

### Phase 3B — Add selection context-menu capture (`0.5.1`; complete)

- [x] Add a **Copy Selection as Markdown** action to Chrome's selection context
  menu.
- [x] Convert the user-selected DOM through Phase 3A's shared HTML-to-Markdown
  layer rather than introducing a second conversion path.
- [x] Make relative links and image sources absolute before conversion.
- [x] Handle selections containing multiple DOM ranges where Chrome exposes them.
- [x] Show concise success or failure feedback without opening the popup.
- [x] Keep the initial context-menu scope to selections; page links, images, and
  tab lists remain out of scope.
- [x] Add selection-specific fixtures and pure conversion tests.

Exit criteria:

- Selected page content can be copied as Markdown from Chrome's context menu.
- Selection capture preserves the same supported Markdown structures as the
  generic webpage adapter where the selected DOM contains them.
- The feature reuses `activeTab` access after the explicit context-menu gesture
  and does not require persistent access to every website.
- Generic webpage, Reddit, and PDF exports continue to behave as before.

### Phase 3C — Capture listing and application-style pages

- Add representative fixtures for search results, news homepages, feeds, and
  other pages composed of repeated result cards rather than one article body.
- Compare a generic visible-page conversion mode with specialized adapters for
  frequently used sources before committing to either architecture.
- If a generic mode is viable, remove obvious navigation, controls, hidden UI,
  cookie prompts, and repeated page chrome without discarding the result cards.
- If specialized adapters are necessary, add one only where its structured
  output materially outperforms the generic mode and its maintenance cost is
  justified by demonstrated use.
- Keep the main-content Readability path as the default for articles and
  documentation; do not silently substitute noisier full-page output.
- Label the chosen action so users can distinguish main-content extraction
  from listing or visible-page capture.

Exit criteria:

- A Google Search results page preserves the visible result titles, links, and
  snippets in a readable order without including most interface controls.
- The Google News homepage preserves story groupings, titles, source labels,
  and links well enough to scan in Markdown.
- Ordinary articles continue to use the cleaner Readability path.
- The chosen generic or specialized approach has fixtures, pure conversion
  tests, documented limitations, and a clear maintenance path.

### Phase 4 — Mature PDF-to-Markdown

- Detect HTTP(S) PDF tabs reliably, including URLs whose path does not end in
  `.pdf` when the available response metadata identifies a PDF.
- Fetch the underlying PDF bytes rather than scraping Chrome's built-in PDF
  viewer.
- Move the initial PDF implementation behind the common adapter contract.
- Improve paragraph reconstruction using position and spacing information.
- Apply conservative Markdown heuristics for headings, lists, page breaks,
  links, and repeated headers or footers.
- Detect full-width headings and keep them separate from the first content row
  beneath them, translating clear heading levels into Markdown headings.
- Cluster text fragments into visual lines instead of joining every item at a
  similar vertical position into one paragraph.
- Segment obvious multicolumn regions and preserve wrapped text within its
  column before advancing to the next column.
- Clean up positioned-text artifacts such as detached ordinal suffixes while
  avoiding speculative rewriting of source text.
- Add a regression fixture based on a designed flyer or brochure. It should
  cover content-stream order differing from visual order, full-width headings,
  three-column lists, wrapped entries, and a footer or registration block.
- Preserve the PDF title and source URL and create a safe `.md` filename.
- Add Download through the shared output layer while preserving Copy.
- Report encrypted, inaccessible, malformed, and image-only PDFs clearly.
- Treat scanned-document OCR as a later capability, not part of the first PDF
  release.
- Test text extraction and Markdown conversion with checked-in, redistributable
  fixtures covering simple text, multiple pages, columns, lists, and tables.
- Manually smoke-test public PDFs, authenticated same-origin PDFs, redirecting
  PDF URLs, and local `file://` PDFs. Request any additional permission only
  when a demonstrated case requires it, and document Chrome's “Allow access to
  file URLs” requirement if local PDFs are supported.

Initial PDF quality promise:

- Text-based PDFs are supported on a best-effort basis.
- Reading order in multicolumn documents and complex tables may be imperfect.
- Scanned or image-only PDFs are detected and reported as requiring OCR.

Exit criteria:

- A text-based PDF open in Chrome can be copied and downloaded as Markdown.
- PDF processing occurs locally and does not depend on the viewer DOM.
- Tests cover the pure PDF-to-Markdown transformation and error cases.
- Known layout limitations are visible before users mistake the output for a
  lossless conversion.
- Designed flyer output keeps major headings on separate lines, does not merge
  all columns into a single paragraph, and preserves each wrapped list entry
  more coherently than the Phase 1 top-to-bottom fallback.

### Phase 5 — Harden the core workflow

- Add a preview that remains compact and does not become a full editor.
- Make large-export progress and failure states clear.
- Measure memory and latency for large Reddit threads, long articles, and
  large PDFs.
- Audit permissions and remove any that are no longer necessary.
- Add a repeatable Chrome smoke-test checklist for every supported adapter.
- Document release packaging and Chrome Web Store upgrade behavior.

Exit criteria:

- Failures identify the source and likely remedy.
- Large inputs do not routinely freeze the popup or exceed extension limits.
- Permissions remain proportional to user-invoked export behavior.

### Phase 6 — Add adapters only from demonstrated need

Candidates may include Hacker News, GitHub, or AI conversation pages. Add an
adapter only when the generic fallback produces materially poor output and the
source is used often enough to justify ongoing maintenance.

Each new adapter must include fixtures, pure conversion tests, documented
limitations, and a maintenance owner. This phase is intentionally open-ended
and is not a commitment to support every website.

## Deferred decisions

- Whether to support OCR locally for scanned PDFs.
- Whether images should be downloaded and rewritten to local paths.
- Whether customizable frontmatter or templates justify their UI and
  maintenance cost.
- Whether cross-browser support is worth browser-specific packaging work.

## First implementation milestone

Complete Phase 0, then ship the deliberately basic PDF copy path in Phase 1
without changing Reddit output. Phase 2 turns both sources into the durable
adapter architecture before generic webpage extraction or advanced PDF layout
work begins. This prioritizes immediate usefulness while keeping the temporary
architectural debt explicit and bounded.
