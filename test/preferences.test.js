import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { english, translate } from "../dist/translations.js";
import { initializePreferences, setText } from "../dist/preferences.js";

test("Dil ve tema değişirken dinamik durumlar ve kullanıcı girdisi korunur", () => {
  // Tarayıcıya bağımlı olmayan bir DOM sınırı: aynı gerçek tercih modülünü çalıştırır.
  const savedGlobals = Object.fromEntries(
    ["document", "localStorage", "NodeFilter"].map((name) => [
      name,
      globalThis[name],
    ]),
  );
  const storage = new Map([["ritim-language", "en"]]);
  const createElement = (textContent = "") => ({
    textContent,
    isConnected: true,
    value: "",
    attributes: {},
    listeners: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    },
  });
  const label = createElement("Çalışma alanı");
  const elements = {
    "#languageSelect": createElement(),
    "#themeToggle": createElement(),
    "#recordStatus": createElement(),
    "#tabInput": createElement(),
    'meta[name="description"]': createElement(),
  };
  elements["#tabInput"].value = "e|---5-7---|";
  let notifications = 0;
  globalThis.localStorage = {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.document = {
    body: {},
    documentElement: { dataset: { theme: "light" } },
    createTreeWalker() {
      let first = true;
      return {
        currentNode: label,
        nextNode() {
          const result = first;
          first = false;
          return result;
        },
      };
    },
    querySelector: (selector) => elements[selector],
    querySelectorAll: () => [],
    dispatchEvent() {
      notifications++;
    },
  };
  try {
    initializePreferences();
    assert.equal(label.textContent, "Practice studio");
    assert.equal(document.documentElement.lang, "en");
    setText("#recordStatus", "Hazır ol: {remaining}", { remaining: 3 });
    assert.equal(elements["#recordStatus"].textContent, "Get ready: 3");
    elements["#languageSelect"].value = "tr";
    elements["#languageSelect"].listeners.change();
    assert.equal(elements["#recordStatus"].textContent, "Hazır ol: 3");
    assert.equal(label.textContent, "Çalışma alanı");
    assert.equal(storage.get("ritim-language"), "tr");
    elements["#themeToggle"].listeners.click();
    assert.equal(document.documentElement.dataset.theme, "dark");
    assert.equal(storage.get("ritim-theme"), "dark");
    assert.equal(elements["#themeToggle"].attributes["aria-pressed"], "true");
    assert.equal(elements["#tabInput"].value, "e|---5-7---|");
    assert.equal(notifications, 2);
  } finally {
    for (const [name, value] of Object.entries(savedGlobals)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
});

test("Dil değişimi dinamik değerleri ve Türkçe geri dönüşü korur", () => {
  const source = "Hedef {target} BPM · fark {difference} BPM";
  const values = { target: 90, difference: "+2" };
  assert.equal(
    translate(source, "en", values),
    "Target 90 BPM · difference +2 BPM",
  );
  assert.equal(translate(source, "tr", values), "Hedef 90 BPM · fark +2 BPM");
});

test("HTML satır aralıkları çeviri eşleşmesini bozmaz", () => {
  assert.equal(
    translate("  Kayıttan önce 4\n  vuruş say ", "en"),
    "Count in 4 beats before recording",
  );
});

test("İngilizce çeviriler tüm dinamik yer tutucuları korur", () => {
  for (const [source, translation] of Object.entries(english)) {
    const parameters = (text) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(parameters(translation), parameters(source), source);
  }
});

test("Analiz hatalarının tamamının İngilizce karşılığı vardır", () => {
  const source = readFileSync(
    new URL("../dist/rhythm.js", import.meta.url),
    "utf8",
  );
  for (const match of source.matchAll(/new AnalysisError\(\s*"([^"]+)"/g)) {
    assert.ok(Object.hasOwn(english, match[1]), match[1]);
  }
});

const themeScript = readFileSync(
  new URL("../dist/theme-init.js", import.meta.url),
  "utf8",
);
function loadTheme(savedTheme, systemDark, blockedStorage = false) {
  const dataset = {};
  vm.runInNewContext(themeScript, {
    document: { documentElement: { dataset } },
    localStorage: {
      getItem() {
        if (blockedStorage) throw new Error("Unavailable");
        return savedTheme;
      },
    },
    matchMedia: () => ({ matches: systemDark }),
  });
  return dataset.theme;
}

test("Kaydedilen tema sistem tercihinden önceliklidir", () => {
  assert.equal(loadTheme("light", true), "light");
  assert.equal(loadTheme("dark", false), "dark");
});

test("İlk açılışta ve erişim engelinde sistem teması kullanılır", () => {
  assert.equal(loadTheme(null, true), "dark");
  assert.equal(loadTheme("invalid", false), "light");
  assert.equal(loadTheme(null, true, true), "dark");
});
