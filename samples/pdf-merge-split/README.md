# Merge and split PDFs in the browser with DsPdfJS

This sample merges PDF files, reorders and deletes pages with live previews,
extracts page ranges, and splits a PDF into parts - entirely client-side with
[Document Solutions for PDF JS (DsPdfJS)](https://www.npmjs.com/package/@mescius/ds-pdf).
No server is involved: the files never leave the browser.

## What it shows

- Combining whole documents or selected page ranges in any order with `PdfDocument.mergeWithDocument()`.
- Per-file page selections such as `1, 3, 5-7` parsed into the 1-based `range` option.
- Reordering and deleting pages of the merged result with `doc.pages.move()` and `doc.pages.removeAt()`.
- Extracting page ranges into a new PDF.
- Splitting a document into parts of a fixed number of pages.
- Rendering page thumbnails with `page.saveAsPng()` so every operation is visible immediately.
- Saving results with `doc.savePdf()` and downloading them from the browser.

## Run the sample

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Click **Load sample files** to add three small
bundled PDFs (report, appendix, slides - each with a distinct color and large page
numbers, so it is easy to track what went where), or drop your own PDF files onto
the drop zone. Then:

1. Optionally type a page selection (for example `1, 3-4`) next to a file to merge only those pages, and use ▲/▼ to change the file order.
2. Click **Merge** - page thumbnails of the result appear on the right.
3. Use ◀/▶/✕ on any thumbnail to move or delete that page.
4. Extract a page range or split the result into fixed-size parts; each produced file gets its own **Download** button.

The `predev` script copies the `DsPdf.wasm` file shipped by `@mescius/ds-pdf` into `public`
(the copied file is ignored by Git). The same step runs automatically before a production build:

```bash
npm run build
```

To regenerate the bundled sample PDFs after editing
[`tools/create-sample-pdfs.mjs`](./tools/create-sample-pdfs.mjs):

```bash
npm run make-documents
```

## How the sample works

All PDF processing lives in [`src/Demos.ts`](./src/Demos.ts):

1. `merge(sources)` creates an empty `PdfDocument` and calls `mergeWithDocument(sourceDoc, { range })`
   for every input document (or for each of its selected ranges), in list order.
2. The merged document is kept alive in its own `ObjectManager` between operations,
   demonstrating explicit lifetime control of the wrapped WebAssembly objects.
3. `movePage()` / `removePage()` call `doc.pages.move()` or `doc.pages.removeAt()` on that
   in-memory document and return the updated PDF with fresh thumbnails.
4. `extractPages()` copies the selected 1-based ranges into a new document.
5. `split()` walks the document in chunks of N pages, producing one new PDF per chunk.

Short-lived objects (loaded source documents, pages, extracted parts) are created in methods
decorated with `@withObjectManager` and are released automatically when the method returns.

Keeping the result in memory instead of reloading it from bytes for every operation is faster,
and it also matters in trial mode: without a license key, `PdfDocument.load()` is limited to a
small number of pages, so a reload-based implementation would silently truncate larger results.

## License key

Without a license key, DsPdfJS runs in trial mode and adds an evaluation notice to generated or rendered output.
To use a key, call `await DsPdfConfig.setLicenseKey("YOUR_KEY")` before `connectDsPdf()` in [`src/Demos.ts`](./src/Demos.ts).
