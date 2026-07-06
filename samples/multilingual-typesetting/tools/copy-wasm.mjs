import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../node_modules/@mescius/ds-pdf/assets/DsPdf.wasm");
const outputDir = resolve(here, "../public");

mkdirSync(outputDir, { recursive: true });
copyFileSync(source, resolve(outputDir, "DsPdf.wasm"));
