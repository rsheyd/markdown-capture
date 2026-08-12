# PDF.js vendor files

`pdf.mjs` and `pdf.worker.mjs` are the minified browser builds copied without
modification from `pdfjs-dist` 4.8.69. PDF.js is Copyright Mozilla Foundation
and contributors and licensed under Apache-2.0; see `LICENSE` in this
directory.

To refresh these files after changing the exact dependency version:

```sh
cp node_modules/pdfjs-dist/build/pdf.min.mjs vendor/pdfjs/pdf.mjs
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs vendor/pdfjs/pdf.worker.mjs
cp node_modules/pdfjs-dist/LICENSE vendor/pdfjs/LICENSE
```
