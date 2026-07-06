// Downloads the Noto fonts used by this sample into public/fonts (ignored by
// Git; they are too large to commit). Files that already exist are skipped.
// All fonts are licensed under the SIL Open Font License 1.1.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const NOTO = "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts";
const NOTO_CJK = "https://raw.githubusercontent.com/notofonts/noto-cjk/main";

const FONTS = [
  { file: "NotoSans-Regular.ttf", url: `${NOTO}/NotoSans/hinted/ttf/NotoSans-Regular.ttf` },
  { file: "NotoSansArabic-Regular.ttf", url: `${NOTO}/NotoSansArabic/hinted/ttf/NotoSansArabic-Regular.ttf` },
  { file: "NotoSansHebrew-Regular.ttf", url: `${NOTO}/NotoSansHebrew/hinted/ttf/NotoSansHebrew-Regular.ttf` },
  { file: "NotoSansThai-Regular.ttf", url: `${NOTO}/NotoSansThai/hinted/ttf/NotoSansThai-Regular.ttf` },
  { file: "NotoSansDevanagari-Regular.ttf", url: `${NOTO}/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Regular.ttf` },
  { file: "NotoSansJP-Regular.otf", url: `${NOTO_CJK}/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf` },
];

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = resolve(here, "../public/fonts");
mkdirSync(fontsDir, { recursive: true });

let failed = false;
for (const { file, url } of FONTS) {
  const target = resolve(fontsDir, file);
  if (existsSync(target)) {
    console.log(`${file} already present, skipping.`);
    continue;
  }
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    writeFileSync(target, new Uint8Array(await response.arrayBuffer()));
    console.log(`Downloaded ${file}`);
  } catch (caught) {
    failed = true;
    console.error(`Failed to download ${file}: ${caught.message}`);
    console.error(`  Please download it manually from:\n  ${url}\n  and save it as public/fonts/${file}`);
  }
}
if (failed) process.exit(1);
