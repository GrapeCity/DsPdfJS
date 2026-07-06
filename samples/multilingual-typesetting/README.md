# Multilingual typesetting with DsPdfJS

This sample typesets bidirectional Arabic and Hebrew, vertical Japanese, Thai with
Unicode line breaking, and a six-script font-fallback line - to PDF, entirely in the
browser, with the text engine of
[Document Solutions for PDF JS (DsPdfJS)](https://www.npmjs.com/package/@mescius/ds-pdf).

## What it shows

- The Unicode bidirectional algorithm: English, Arabic, and Hebrew runs correctly ordered in a single justified paragraph.
- A right-to-left base direction (`Layout.rightToLeft`) for Arabic and Hebrew paragraphs with embedded Latin words and digits.
- Arabic letter shaping and joining, handled automatically.
- Automatic font fallback: one `Format` referencing only a Latin font renders Latin, Cyrillic, Arabic, Hebrew, Japanese, Thai, and Devanagari through `FontCollection` fallback fonts.
- Vertical Japanese text (`FlowDirection.VerticalRightToLeft`): lines stacked right to left, with Latin text drawn upright character by character (`uprightInVerticalText`).
- Tate-chu-yoko (縦中横): short runs of any characters - two-digit numbers or Latin words like "PDF" - set horizontally inside the vertical line, combining `textRunAsCluster`, `uprightInVerticalText`, and quarter-width glyphs (`GlyphWidths.QuarterWidths`).
- Language-aware line breaking: Thai has no spaces between words, yet wraps and justifies correctly in a narrow column.
- Page previews rendered with `page.saveAsPng()`; the PDF itself saved with `doc.savePdf()`.

## Run the sample

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The page typesets two pages and shows them as
images; **Download PDF** saves the same content as a PDF document.

The `predev` script copies `DsPdf.wasm` into `public` and downloads the six Noto fonts
used by the sample into `public/fonts` (both are ignored by Git). The fonts are fetched
from the [Noto fonts](https://notofonts.github.io/) and
[Noto CJK](https://github.com/googlefonts/noto-cjk) GitHub repositories and are licensed
under the SIL Open Font License 1.1. If a download fails (for example, behind a proxy),
the script prints the URL so you can fetch the file manually into `public/fonts`.

## How the sample works

All typesetting lives in [`src/Demos.ts`](./src/Demos.ts):

1. `loadFonts()` loads the six fonts once into a dedicated `ObjectManager` and builds a
   `FontCollection`: the Latin font is the default, the other five are registered as
   fallback fonts.
2. Every `Layout` is created with that `fontCollection`, so any run can fall back to the
   right font per script.
3. `renderShowcase()` builds the document and renders each page to PNG for display.
4. `createPdf()` builds a fresh document and calls `savePdf()` once per download, so
   previews are never rendered from an already-saved document.

The layout engine applies the latest Unicode standards for bidirectional ordering, text
segmentation, normalization, and line breaking; 14 standard PDF fonts are preloaded, and
TTF, TTC, OTF, and WOFF fonts can be loaded from binary data.

## License key

Without a license key, DsPdfJS runs in trial mode and adds an evaluation notice to generated or rendered output.
To use a key, call `await DsPdfConfig.setLicenseKey("YOUR_KEY")` before `connectDsPdf()` in [`src/Demos.ts`](./src/Demos.ts).
