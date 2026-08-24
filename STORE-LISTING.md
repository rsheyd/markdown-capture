# Chrome Web Store listing

This is the canonical copy-and-paste source for the published listing and future updates. Confirm the dashboard's current labels before each update because Google may revise the form.

**Published listing:** <https://chromewebstore.google.com/detail/markdown-capture/gabiloifhoihennbcfkafmpgepijdkgg>

**Extension ID:** `gabiloifhoihennbcfkafmpgepijdkgg`

## Product details

**Language:** English

**Category:** Tools

**Summary:** Capture supported web content as clean Markdown.

**Detailed description:**

Markdown Capture turns content you choose into clean, ordinary Markdown that works with any Markdown editor. It is open source and designed to keep capture simple, transparent, and local.

Use the compact, source-aware menu to copy or download:

- Main content from articles and documentation pages
- Full rendered content from discussions, listings, and application-style pages
- A selected part of a webpage—including links, images, lists, tables, and code—from the context menu or with `Option+Shift+M` on macOS and `Alt+Shift+M` on other platforms
- Structured Reddit posts, discussions, and comment threads
- Text from supported public PDFs and PDF attachments opened in Gmail

Markdown Capture is local-first. Conversion runs in your browser, with no account, analytics, advertising, or hosted conversion service. It requests temporary access only after you invoke it on the active tab.

Webpage and PDF conversion is best effort. Complex layouts, scanned PDFs, and content that has not rendered are not supported losslessly.

**Homepage URL:** <https://github.com/rsheyd/markdown-capture>

**Support URL:** <https://github.com/rsheyd/markdown-capture/issues>

**Privacy policy URL:** <https://github.com/rsheyd/markdown-capture/blob/main/PRIVACY.md>

**Mature content:** No

## Graphic assets

- Store icon: `icons/icon-128.png`
- Screenshot: `store-assets/screenshot-01.png` (1280×800)
- Small promo tile: `store-assets/small-promo-tile.png` (440×280)
- Marquee promo tile: omitted (optional)
- Promo video: omitted (optional in the current dashboard despite ambiguous wording in an older documentation page)

## Privacy practices

**Single purpose:** Convert webpage content explicitly chosen by the user into ordinary Markdown for copying or downloading.

**Data usage certification:** Certify compliance with the Chrome Web Store User Data Policy, including its Limited Use requirements.

**Data handled:**

- Website content: Yes. The extension reads the active page, a selection, Reddit content, or a user-opened PDF only after a user invokes an export.
- Web history: No. The active tab URL is inspected transiently to select the correct capture method, but browsing history is not collected or retained.
- Personal communications: Yes. A user may explicitly export a Gmail PDF attachment or webpage content containing communications. Processing is local and the content is not collected by the developer.
- User activity: No analytics, interaction tracking, or activity collection.
- Authentication information: No. Same-origin requests use Chrome's existing session, but credentials are neither read nor stored by the extension.

If the dashboard defines "collected" as data transmitted off-device, select that no user data is collected. Keep the website-content and personal-communications handling explanation in the privacy policy and reviewer notes. Do not claim that the extension never handles user data: Chrome policy treats local webpage clipping as handling.

## Permission justifications

- `activeTab`: Grants temporary access to the page only after the user invokes Markdown Capture, so the extension can identify and convert that content.
- `scripting`: Injects the locally bundled converter into the active page and captures a user-selected region, rendered page content, or a same-origin source response.
- `clipboardWrite`: Writes Markdown when the user chooses a Copy action.
- `contextMenus`: Adds the user-invoked Copy Selection as Markdown action.
- `downloads`: Saves a Markdown file when the user chooses a Download action.

**Remote code:** No. All executable code and conversion dependencies are included in the extension package. Network requests only retrieve content the user explicitly chose to export.

## Reviewer test instructions

No account or test credentials are required for the general workflow.

1. Open a public article over HTTPS and click Markdown Capture.
2. Choose Copy Main Content and paste into a text editor.
3. Select a heading, link, and paragraph on the page; right-click and choose Copy Selection as Markdown; paste the result.
4. Open a public Reddit post and use Copy Full Discussion.
5. Open a public URL ending in `.pdf` and use Copy PDF as Markdown.

The Gmail PDF path requires the reviewer to use their own Gmail account and a PDF attachment; it does not require credentials supplied by the developer.

## Manual update checklist

1. Update the version-specific references in this checklist for the release being submitted.
2. Run the manual Chrome smoke checks in `DEVELOPMENT.md` against that version.
3. Run `npm test` and `npm run package`.
4. Inspect `dist/markdown-capture-VERSION.zip` and upload it to the existing item.
5. Update the Product details and graphic assets when they have changed.
6. Reconfirm Privacy practices using the declarations and justifications above.
7. Add release-specific reviewer instructions if the dashboard requests them.
8. Resolve every dashboard warning and submit the update for review.
9. After approval, publish according to the selected publishing mode.
