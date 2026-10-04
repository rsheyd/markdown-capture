# Privacy Policy for Markdown Capture

Effective date: September 27, 2026

Markdown Capture processes webpage content only when a user explicitly invokes one of its copy or download actions. Depending on the selected action, this may include the active page's URL and rendered content, a selected portion of a page, Reddit post and comment data, loaded Gmail messages, images referenced by captured webpage content, or the contents of a PDF—including a PDF attachment opened in Gmail.

All conversion happens locally in the user's browser. Markdown Capture does not transmit captured content, browsing activity, personal communications, authentication information, or generated Markdown to the developer or to any hosted conversion or analytics service. It does not sell user data, use it for advertising, allow humans to read it, or share it with third parties.

The extension stores only the capture-time/hash and debug-info checkbox preferences in browser-local extension storage. Source URLs, optional UTC capture timestamps and content hashes, and optional diagnostic details are written into the requested export and processed locally. Debug details may include selected HTML/text and image URLs or fetch errors; review a debug-enabled export before sharing it.

The extension does not maintain a developer-operated database or account system and does not retain captured content after the requested copy or download operation. Clipboard contents and downloaded files remain under the user's control and are governed by the browser and operating system.

For Reddit and Gmail PDF captures, the extension may make a user-invoked, same-origin request from the active tab to retrieve the content being exported. Those requests go only to the service already open in the active tab and use the browser's existing session. The extension does not receive or store the session credentials.

The optional **Download with images** action requests images referenced by captured webpage or Gmail conversation content from their original servers, using the active page context. Gmail image attachments are requested from the active Gmail tab using the existing session. Other same-origin requests may use the existing site session; cross-origin requests omit credentials and require CORS. For Craigslist posts, Chrome requests optional access to `images.craigslist.org` when the user chooses **Download with images**; the extension fetches gallery images from its popup without credentials. Image bytes and the ZIP are assembled locally. No captured content is sent to a conversion service.

Markdown Capture's use of information complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Access is limited to the extension's single purpose: converting content chosen by the user into ordinary Markdown.

Questions or privacy concerns can be submitted through the project's public [issue tracker](https://github.com/rsheyd/markdown-capture/issues).
