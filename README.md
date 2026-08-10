# Reddit Markdown Exporter

A minimal Chrome extension that downloads a Reddit post and its comments as a Markdown file.

There is no popup or generic webpage extraction. Click the extension icon while viewing a Reddit post and choose where to save the generated `.md` file.

## Features

- Uses Reddit's structured `.json` representation instead of scraping the page.
- Fetches JSON from the active Reddit tab so Reddit receives a normal same-origin browser request.
- Includes the post title, author, subreddit, canonical URL, and body.
- Recursively preserves the returned comment hierarchy, authors, and scores.
- Handles link posts and deleted or removed content sensibly.
- Ignores Reddit `more` placeholders; it does not make extra requests for missing comments.
- Runs as a dependency-free Manifest V3 extension.

## Install locally in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project directory—the directory containing `manifest.json`.
5. Pin **Reddit Markdown Exporter** from Chrome's Extensions menu.
6. Open a Reddit post and click the extension icon.

Chrome will show a Save dialog. A temporary badge indicates progress (`…`), success (`✓`), or an error (`!`). Hover over the extension icon for the error summary, and inspect the service worker from `chrome://extensions` for full error details.

After changing source files, click the extension's reload button on `chrome://extensions` before testing again.

## Test

Requires Node.js 18 or newer. There are no packages to install.

```bash
npm test
```

## Project structure

- `manifest.json` — Manifest V3 extension configuration.
- `src/background.js` — click handling, Reddit fetch, file download, and badge feedback.
- `src/reddit.js` — URL handling and JSON-to-Markdown conversion.
- `test/reddit.test.js` — unit tests for the standalone conversion logic.

## Limitations

- Only Reddit post URLs are supported.
- Collapsed or omitted comments represented by `kind: "more"` are not expanded.
- Media, galleries, flair, awards, and avatars are not specially formatted.
- Very large threads are limited by the comments included in Reddit's initial JSON response.
