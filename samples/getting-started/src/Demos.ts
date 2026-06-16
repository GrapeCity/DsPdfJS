import {
    connectDsPdf,
    disconnectDsPdf,
    DsPdf,
    DsPdfConfig,
    withObjectManager,
    PdfDocument,
    DrawingContext,
    StandardPdfFont,
    Font,
    LinearGradientBrush,
    AngleUnits,
    DashStyle,
    PenLineCap,
    Format,
    Layout,
    SvgDocument,
    Image,
    SvgContext,
    BmpContext
} from '@mescius/ds-pdf';

export class Demos
{
    //#region helper methods

    /** 
     * Gets the version of the DsPdf WebAssembly module,
     * or "Unknown" if not connected.
     * **/
    static get apiVersion(): string {
        return DsPdf.instance?.version || "Unknown";
    }

    /** 
     * Indicates whether the DsPdf WebAssembly module is currently connected.
     * **/
    static get isConnected(): boolean {
        if (DsPdf.instance) {
            return DsPdf.instance.isConnected;
        }
        return false;
    }

    /** 
     * Connects to the DsPdf WebAssembly module if not already connected.
     * @returns A promise that resolves to true if the connection is successful,
     * or to false in case of any errors.
     **/
    static async connect(): Promise<boolean> {
        if (!this.isConnected) {
            DsPdfConfig.wasmUrl =
              "node_modules/@mescius/ds-pdf/assets/DsPdf.wasm";
            return await connectDsPdf();
        }
        return true;
    }

    /** Disconnects from the DsPdf WebAssembly module. **/
    static disconnect() {
        if (this.isConnected) {
            disconnectDsPdf();
        }
    }

    /**
     * Loads a binary file with specified file name from the public folder.
     * (Do not use cache by default to avoid loading stale content.)
     * @param fileName The name of the file to load.
     * @param cached Whether to load the cached content of the file.
     * @returns A promise resolving to the loaded file as a Uint8Array.
     **/
    static async loadFile(fileName: string, cached: boolean = false): Promise<Uint8Array> {
        const response = await fetch(fileName, { cache: cached ? 'force-cache' : 'no-cache' });
        if (!response.ok) {
            throw new Error(`Unable to load file: ${response.statusText}`);
        }
        return new Uint8Array(await response.arrayBuffer());
    }

    /**
     * Saves a file with specified name, binary content, and MIME type
     * by triggering a download in the browser.
     * @param fileName The name of the file to save.
     * @param bytes The content of the file as a Uint8Array.
     * @param mimeType The MIME type of the file.
     **/
    static saveFile(fileName: string, bytes: Uint8Array, mimeType: string) {
        const blob = new Blob([bytes as BlobPart], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`saved '${mimeType}' file as ${fileName}`);
    }

    //#endregion

    @withObjectManager
    static async simplePdf() {
        // create a new PDF document
        const doc = new PdfDocument();

        // add a new page with default size to the document and
        // get the page drawing context
        const ctx = doc.newPageContext();

        // draw some text on the page at coordinates (72, 72)
        // using the default font, size, and foreColor.
        ctx.drawText({ text: "Hello World!" }, 72, 72);

        // convert the document to a byte array and save as simple.pdf
        this.saveFile("simple.pdf", doc.savePdf(), "application/pdf");
    }

    /**
     * Draws the same text and graphics to PDF, SVG, and PNG.
     * @param ctx The target drawing context.
     **/
    @withObjectManager
    static async drawContent(ctx: DrawingContext) {
        const Inch = 72;
        let x = Inch;
        let y = Inch;

        // get a pre-defined standard PDF font and load a custom font from a file
        const helvFont = Font.getPdfFont(StandardPdfFont.HelveticaItalic);
        const notoFont = Font.load(await this.loadFile("NotoSerif-Regular.ttf"));

        // create a text format object
        const tf = new Format({
            font: notoFont,
            fontSize: 15
        });

        // draw text with limited max width and word wrapping, and rectangles
        // showing the measured text size and the max width
        const text = "Test string to demo the measureText() function used with drawText().";
        const maxWidth = Inch * 3;
        const textSize = ctx.measureText(text, tf, maxWidth);
        ctx.drawRect(x, y, maxWidth, textSize.height, { lineWidth: 3, lineColor: "PeachPuff" });
        ctx.drawRect(x, y, textSize.width, textSize.height, { lineWidth: 1, lineColor: "OrangeRed" });
        ctx.drawText(text, tf, x, y, maxWidth);

        // size of the text block is calculated with ctx.measureText()
        y += textSize.height + 10;

        // the Layout object can be used to layout multiple text fragments with different formatting
        const tl = new Layout({
            defaultFormat: new Format(tf, { font: helvFont }),
            maxWidth: ctx.width - Inch * 2,
            firstLineIndent: Inch * 0.5,
            paragraphSpacing: Inch * 0.1,
            lineSpacingScaleFactor: 0.8
        });
        tl.append("First test string added to the Layout object. ");
        tl.appendLine("Second test string added to Layout, continuing the same paragraph.");
        tl.append({ text: "Third test string added to Layout, a new paragraph. ", foreColor: "DarkRed" });

        const notoBI = Font.load(await this.loadFile("NotoSerif-BoldItalic.ttf"));

        tl.append({ text: "Fourth test string, with a different char formatting. ", font: notoBI, foreColor: "DarkSeaGreen" });
        tl.append("Fifth test string, using the Layout's default format.");
        ctx.drawLayout(tl, x, y);

        // size of the Layout object is calculated in ctx.drawLayout(), or you
        // can call tl.performLayout() to calculate it before drawing
        // so we use tl.contentHeight to position the next drawing after the text block.
        y += tl.contentHeight + 10;

        // draw an ellipse with a linear gradient fill and styled border
        ctx.pushTransform();
        ctx.translate(x + 40, y);
        ctx.rotate(30, AngleUnits.Degrees);
        const linearBrush = new LinearGradientBrush({
            startColor: "Turquoise",
            startPoint: { x: 0.2, y: 0.2 },
            gradientStops: [{ color: "Yellow", offset: 0.5 }],
            endColor: "SeaGreen",
            endPoint: { x: 0.8, y: 0.8 },
        });
        ctx.drawEllipse({ width: 150, height: 100 }, {
            fillBrush: linearBrush,
            lineColor: "RoyalBlue",
            lineStyle: DashStyle.DashDot,
            lineCap: PenLineCap.Round,
            lineWidth: 3
        });
        ctx.popTransform();

        // draw a rectangle around the page content
        ctx.drawRect({ left: 1, top: 1, right: (ctx.width - 1), bottom: (ctx.height - 1) },
            { lineColor: "ForestGreen", lineWidth: 2 });
    }

    @withObjectManager
    static async drawPdf() {
        const doc = new PdfDocument();

        // first page
        let ctx = doc.newPageContext({ width: 720, height: 450 });
        await this.drawContent(ctx);

        // second page
        ctx = doc.newPageContext({ width: 720, height: 800 });
        const maxWidth = ctx.width - 144;
        let x = 72;
        let y = 72;

        // load and draw an SVG file with text and graphics
        const svgDoc = SvgDocument.load(await this.loadFile("units.svg"));
        const sz = svgDoc.getIntrinsicSize()!;
        svgDoc.sansSerifFont = Font.load(await this.loadFile("NotoSans-Light.ttf"));
        ctx.drawSvg(svgDoc, x, y);
        y +=  sz.height + 20;

        // load and draw an image file, keeping its aspect ratio
        const img = Image.load(await this.loadFile("grand-canyon.jpg"));
        ctx.drawImage(img, x, y, maxWidth, maxWidth, { keepAspectRatio: true });

        this.saveFile("drawPdfTest.pdf", doc.savePdf(), "application/pdf");
    }

    @withObjectManager
    static async drawSvg() {
        const ctx = new SvgContext(720, 450);

        const scaleFactor = 1.5; // to enlarge the resulting SVG
        ctx.scale(scaleFactor);

        await this.drawContent(ctx);

        ctx.width *= scaleFactor;
        ctx.height *= scaleFactor;

        const svg = ctx.toSvgDocument();
        this.saveFile("drawSvgTest.svg", svg.save(), "image/svg+xml");
    }

    @withObjectManager
    static async drawPng() {
        // scale factor (1.5) can be used to create a bitmap with better quality
        const ctx = new BmpContext(720, 450, 1.5, "White");

        await this.drawContent(ctx);

        const bmp = ctx.bitmap;
        this.saveFile("drawPngTest.png", bmp.saveAsPng(), "image/png");
    }
}