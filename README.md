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
It provides functionality comparable to Document Solutions for PDF (DsPdf) and Document Solutions for Imaging (DsImaging),
while being designed specifically for JavaScript, TypeScript, and Wasm.

## Samples

- [getting-started](./samples/getting-started): A React + TypeScript + Vite app showing how to connect to DsPdfJS and draw the same text and graphics to a PDF page, an SVG document, and a bitmap saved as PNG.
- [pdf-form-fill-flatten](./samples/pdf-form-fill-flatten): Fill an AcroForm PDF from JSON and save editable or flattened output.

## Running a sample

Each sample is a self-contained npm project. To run one:

```bash
cd samples/getting-started
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

To get just one sample without cloning the whole repository, you can use [tiged](https://github.com/tiged/tiged):

```bash
npx tiged GrapeCity/DsPdfJS/samples/getting-started getting-started
```

## License

The sample code in this repository is licensed under the [MIT License](./LICENSE).

**Note:** the `@mescius/ds-pdf` package itself is a commercial product and is licensed separately under the MESCIUS EULA.
Without a license key, DsPdfJS runs in trial mode and some PDF loading/generation features may be restricted.
See the [DsPdfJS product page](https://developer.mescius.com/document-solutions/javascript-pdf-api/) for licensing details.
