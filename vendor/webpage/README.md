# Webpage conversion bundle

`webpage.js` is the browser-ready Phase 3A conversion bundle. It contains the
exact versions of Mozilla Readability, Turndown, and turndown-plugin-gfm pinned
in the root `package.json` and is loaded only into the active tab after a user
chooses a generic webpage export action.

To update it:

1. Change the pinned npm dependency versions.
2. Run `npm install`.
3. Run `npm run vendor:webpage`.
4. Refresh the three license copies in this directory from the corresponding
   npm packages.
5. Run `npm test` and the generic webpage Chrome smoke checks.

The checked-in bundle keeps the unpacked extension build-free and does not
load remote executable code.
