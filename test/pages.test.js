import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (filename) =>
  readFileSync(new URL(`../dist/${filename}`, import.meta.url), "utf8");

test("Ana sayfa ve editör ayrı giriş noktaları ve ortak tercih menüleri kullanır", () => {
  const home = read("index.html");
  const editor = read("editor.html");
  assert.ok(!home.includes('id="tabEditor"'));
  assert.ok(editor.includes('id="tabEditor"'));
  assert.ok(home.includes('href="editor.html"'));
  assert.ok(editor.includes('href="index.html#calisma"'));
  assert.ok(!editor.includes('id="recordBtn"'));
  for (const page of [home, editor]) {
    assert.match(page, /<select id="themeToggle"/);
    assert.match(page, /<select id="languageSelect"/);
    assert.ok(!page.includes("demoBtn"));
  }
});

test("Her sayfanın yerel stil ve giriş dosyaları bulunur", () => {
  for (const filename of ["index.html", "editor.html"]) {
    for (const match of read(filename).matchAll(
      /(?:src|href)="([^"#]+\.(?:css|js|html))"/g,
    )) {
      assert.ok(
        existsSync(new URL(`../dist/${match[1]}`, import.meta.url)),
        match[1],
      );
    }
  }
});

test("Ana uygulama diğer sayfanın DOM elemanlarına bağımlı değildir", () => {
  const home = read("index.html");
  const script = read("app.js");
  for (const match of script.matchAll(/querySelector\("#([\w-]+)"\)/g)) {
    assert.ok(home.includes(`id="${match[1]}"`), match[1]);
  }
  assert.ok(!script.includes("demoBtn"));
  assert.ok(!script.includes("initializeTabEditor"));
});
