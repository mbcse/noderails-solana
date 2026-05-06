/**
 * Metro does not reliably run @tailwindcss/postcss on `@import "tailwindcss"`.
 * This expands `mobile-tailwind.css` → `mobile-tailwind.bundle.css` so iframe
 * wallet UI (`/sign`, `/auth`) matches design on Expo web builds (including Vercel).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, "..");
const inputPath = path.join(mobileRoot, "src/web/mobile-tailwind.css");
const outPath = path.join(mobileRoot, "src/web/mobile-tailwind.bundle.css");

const css = fs.readFileSync(inputPath, "utf8");
const result = await postcss([tailwind()]).process(css, {
  from: inputPath,
  to: outPath,
});
fs.writeFileSync(outPath, result.css);
