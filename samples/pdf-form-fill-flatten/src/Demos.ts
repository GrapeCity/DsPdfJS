import {
    connectDsPdf,
    disconnectDsPdf,
    DsPdf,
    DsPdfConfig,
    withObjectManager,
    PdfDocument,
    Field,
    CheckBoxField,
    ComboBoxField,
    ListBoxField,
    TextField
} from '@mescius/ds-pdf';

/** The shape of public/form-data.json. */
type FormData = Record<string, string | number | boolean | (string | number)[]>;

export class Demos
{
    //#region helper methods

    /**
     * Gets the version of the DsPdf WebAssembly module,
     * or "Unknown" if not connected.
     **/
    static get apiVersion(): string {
        return DsPdf.instance?.version || "Unknown";
    }

    /**
     * Indicates whether the DsPdf WebAssembly module is currently connected.
     **/
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
     * Loads and parses a JSON file from the public folder.
     * @param fileName The name of the file to load.
     * @returns A promise resolving to the parsed JSON.
     **/
    static async loadJson<T>(fileName: string): Promise<T> {
        const response = await fetch(fileName, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`Unable to load file: ${response.statusText}`);
        }
        return await response.json() as T;
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

    //#region form filling

    /**
     * Finds the index of the option whose display text or export value equals 'wanted'
     * in a choice field (combo box or list box), or -1 if there is no match.
     **/
    private static itemIndex(field: ComboBoxField | ListBoxField, wanted: string): number {
        const items = field.items ?? [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const text = typeof item === "string" ? item : item.text;
            const value = typeof item === "string" ? item : (item.value ?? item.text);
            if (text === wanted || value === wanted) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Assigns a JSON value to a single AcroForm field, dispatching on the field type:
     * - {@link CheckBoxField}: set the checked state from a boolean.
     * - {@link ListBoxField}: select every option (by text or value) found in the array.
     * - {@link ComboBoxField}: select the matching option; if the box is editable and
     *   nothing matches, store the raw text instead.
     * - {@link TextField} (and anything else): store the value as a string.
     **/
    private static fillField(field: Field, value: FormData[string]) {
        if (field instanceof CheckBoxField) {
            field.checked = Boolean(value);
        } else if (field instanceof ListBoxField) {
            const wanted = Array.isArray(value) ? value : [value];
            field.selectedIndexes = wanted
                .map(v => this.itemIndex(field, String(v)))
                .filter(i => i >= 0);
        } else if (field instanceof ComboBoxField) {
            const i = this.itemIndex(field, String(value));
            if (i >= 0) {
                field.selectedIndex = i;
            } else if (field.editable) {
                field.text = String(value);
            }
        } else if (field instanceof TextField) {
            field.value = String(value);
        } else {
            field.value = value as (number | string | boolean | number[] | null);
        }
    }

    /**
     * Looks up each key of 'data' in the document's AcroForm and fills the
     * matching field. Keys with no matching field are ignored.
     **/
    private static fillForm(doc: PdfDocument, data: FormData) {
        const fields = doc.acroForm.fields;
        for (const [name, value] of Object.entries(data)) {
            const field = fields.findByName(name);
            if (field) {
                this.fillField(field, value);
            } else {
                console.warn(`No form field named '${name}' in the document.`);
            }
        }
    }

    /**
     * "Flattens" a filled form: produces a new document in which the field
     * appearances are baked into the page content and there is no longer an
     * interactive AcroForm.
     *
     * DsPdfJS does this by drawing each source page - including its form field
     * widgets - onto a fresh page using {@link PdfPage#draw} with the
     * 'drawFormFields' option. The result looks identical to the filled form
     * but its fields can no longer be edited.
     **/
    private static flatten(filledDoc: PdfDocument): Uint8Array {
        const flatDoc = new PdfDocument();
        const pages = filledDoc.pages;
        for (let i = 0; i < pages.count; i++) {
            const src = pages.getAt(i);
            const ctx = flatDoc.newPageContext({ width: src.width, height: src.height });
            src.draw(ctx, 0, 0, src.width, src.height, {
                drawFormFields: true,
                drawAnnotations: true
            });
        }
        return flatDoc.savePdf();
    }

    //#endregion

    //#region demos

    /**
     * Loads the blank form template and the JSON data, fills the form fields,
     * and saves an *editable* PDF: the AcroForm is preserved, so the saved
     * fields can still be changed in any PDF viewer.
     **/
    @withObjectManager
    static async fillEditable() {
        const template = await this.loadFile("registration-form.pdf");
        const data = await this.loadJson<FormData>("form-data.json");

        const doc = PdfDocument.load(template);
        this.fillForm(doc, data);

        this.saveFile("registration-filled.pdf", doc.savePdf(), "application/pdf");
    }

    /**
     * Loads the blank form template and the JSON data, fills the form fields,
     * and saves a *flattened* PDF: the field values are drawn into the page
     * content and the interactive AcroForm is removed, so the values can no
     * longer be edited.
     **/
    @withObjectManager
    static async fillAndFlatten() {
        const template = await this.loadFile("registration-form.pdf");
        const data = await this.loadJson<FormData>("form-data.json");

        const doc = PdfDocument.load(template);
        this.fillForm(doc, data);

        this.saveFile("registration-flattened.pdf", this.flatten(doc), "application/pdf");
    }

    /** Saves the blank, unfilled form template for reference. **/
    @withObjectManager
    static async saveBlankForm() {
        const template = await this.loadFile("registration-form.pdf");
        this.saveFile("registration-form.pdf", template, "application/pdf");
    }

    //#endregion
}
