import { copyFile, mkdir, readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const packageRoot = new URL("node_modules/@coderline/alphatab/", root);
const meta = JSON.parse(
  await readFile(new URL("package.json", packageRoot), "utf8"),
);
if (meta.version !== "1.9.0") throw new Error("Expected alphaTab 1.9.0");
await mkdir(new URL("dist/vendor/alphatab/", root), { recursive: true });
await copyFile(
  new URL("dist/alphaTab.core.min.mjs", packageRoot),
  new URL("dist/vendor/alphatab/alphaTab.core.min.mjs", root),
);
