# Changelog

## 0.1.1

- Fixed Reddit JSON requests failing with HTTP 403 by fetching from the active Reddit tab as a same-origin request with the browser's normal Reddit session.
- Removed the extension's broad Reddit host permissions; the one-click export now uses `activeTab` and `scripting` access instead.

## 0.1.0

- Initial release.
- Added one-click Reddit post and comment export to a Markdown file.
