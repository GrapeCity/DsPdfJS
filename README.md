# Document Solutions for PDF JS Samples

Samples for [**Document Solutions for PDF JS (DsPdfJS)** (`@mescius/ds-pdf`)](https://www.npmjs.com/package/@mescius/ds-pdf) -
a JavaScript/TypeScript library for working with PDF documents, SVG documents, and raster bitmaps that can be saved as PNG or JPEG in the browser or in Node.js. 
See the [DsPdfJS product page](https://developer.mescius.com/document-solutions/javascript-pdf-api/) for full details, documentation, and licensing,
or try the [live demos](https://developer.mescius.com/document-solutions/javascript-pdf-api/demos/getting-started) in your browser.

DsPdfJS lets you:

- Create, load, merge, and split PDF documents; work with text, annotations, links, AcroForms, redactions, encryption, and metadata.
- Draw text and 2D graphics to a PDF page, an SVG document, or a bitmap using a single `DrawingContext`-based API that resembles the HTML `<canvas>` 2D context.
- Use an advanced text layout engine: paragraphs and columns, mixed fonts and formats, vertical (East Asian) and right-to-left text, font fallbacks, and the latest Unicode standards for bidi, segmentation, and line breaking.
- Convert between formats — e.g., save PDF pages as SVG or PNG, or draw an SVG onto a PDF page as vector graphics.

The library is powered by a WebAssembly (Wasm) module (`DsPdf.wasm`) implemented in C++ and exposed through a rich JavaScript/TypeScript API.
It provides functionality comparable to
[Document Solutions for PDF .NET (DsPdf)](https://developer.mescius.com/document-solutions/dot-net-pdf-api) and 
[Document Solutions for Imaging .NET (DsImaging)](https://developer.mescius.com/document-solutions/dot-net-imaging-api),
while being designed specifically for JavaScript, TypeScript, and Wasm.

## Samples

### Browser samples

- [getting-started](./samples/getting-started): A React + TypeScript + Vite app showing how to connect to DsPdfJS and draw the same text and graphics to a PDF page, an SVG document, and a bitmap saved as PNG.
- [pdf-form-fill-flatten](./samples/pdf-form-fill-flatten): Fill an AcroForm PDF from JSON and save editable or flattened output.
- [multilingual-typesetting](./samples/multilingual-typesetting): Bidirectional Arabic and Hebrew, vertical Japanese, automatic font fallback across six scripts, and Unicode line breaking (spaceless Thai) - typeset to PDF in the browser.
- [pii-search-and-redact](./samples/pii-search-and-redact): Find common PII and exact text in a PDF, preview the matches, permanently redact selected values, and verify that they can no longer be extracted.
- [pdf-text-replace](./samples/pdf-text-replace): Find and replace text in a PDF with `PdfDocument.replaceText()`, apply multiple replacements to the same document, and preview the before/after result in the browser.

### Node.js samples

- [json-to-pdf-invoice](./samples/json-to-pdf-invoice): A Node.js + TypeScript CLI that turns invoice JSON into a multi-page PDF with an SVG logo, automatic pagination, totals, metadata, and page-number footers.

## Running a sample

Each sample is a self-contained npm project with its own README and commands.

### Browser samples

```bash
cd samples/<sample-name>
npm install
npm run dev
```

Open the local URL printed by the development server.

### Node.js samples

```bash
cd samples/<sample-name>
npm install
npm run generate
```

Generated files are written to the sample's `output` directory. See the sample's README for additional commands and configuration.

### Downloading a single sample

To get just one sample without cloning the whole repository, you can use [tiged](https://github.com/tiged/tiged):

```bash
npx tiged GrapeCity/DsPdfJS/samples/<sample-name> <sample-name>
```

## License

The sample code in this repository is licensed under the [MIT License](./LICENSE).

**Note:** the `@mescius/ds-pdf` package itself is a commercial product and is licensed separately under the MESCIUS EULA.
Without a license key, DsPdfJS runs in trial mode and some PDF loading/generation features may be restricted.
See the [DsPdfJS product page](https://developer.mescius.com/document-solutions/javascript-pdf-api/) for licensing details.
