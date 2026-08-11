# Development

The project has no build step. Load the repository directory directly as an unpacked Chrome extension.

## Development loop

1. Edit files in `src/` or `manifest.json`.
2. Run `npm test`.
3. Open `chrome://extensions` and reload **Reddit Markdown Exporter**.
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

## Versioning

The extension has a single version source: the `version` field in `manifest.json`. The private `package.json` intentionally has no version because this project is not published to npm.

Update `manifest.json`, run the tests, and complete the manual smoke checks above before creating a release.
