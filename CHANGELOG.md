# Changelog

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
