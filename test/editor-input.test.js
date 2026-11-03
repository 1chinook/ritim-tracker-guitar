import test from "node:test";
import assert from "node:assert/strict";
import { initializeTabEditor } from "../dist/tab-editor.js";

test("Tab hücresi, iki basamaklı perde girişi ve geri alma aynı taslağı günceller", () => {
  const previous = {
    document: globalThis.document,
    localStorage: globalThis.localStorage,
  };
  const saved = new Map();
  class Element {
    children = [];
    dataset = {};
    listeners = {};
    attributes = {};
    isConnected = true;
    value = "";
    disabled = false;
    className = "";
    classList = { toggle() {}, contains: () => false };
    constructor(tag = "div") {
      this.tag = tag;
    }
    append(...children) {
      children.forEach((child) => {
        child.parent = this;
        this.children.push(child);
      });
    }
    replaceChildren() {
      this.children.forEach((child) => {
        child.isConnected = false;
      });
      this.children = [];
    }
    setAttribute(key, value) {
      this.attributes[key] = value;
    }
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    }
    checkValidity() {
      return (
        this.value !== "" &&
        Number(this.value) >= 0 &&
        Number.isInteger(Number(this.value))
      );
    }
    contains(node) {
      return (
        node === this || this.children.some((child) => child.contains(node))
      );
    }
    focus() {
      document.activeElement = this;
    }
    matches(selector) {
      return selector.split(", ").includes(this.tag);
    }
    closest(selector) {
      return (selector === ".tab-cell" &&
        this.className.includes("tab-cell")) ||
        (selector === "[data-fret]" && this.dataset.fret !== undefined)
        ? this
        : this.parent?.closest(selector);
    }
    querySelectorAll(selector) {
      const matches = (node) =>
        selector === "[data-editor-control]"
          ? node.control
          : selector === "tr"
            ? node.tag === "tr"
            : [...selector.matchAll(/data-(step|string)="(\d+)"/g)].every(
                (match) => String(node.dataset[match[1]]) === match[2],
              );
      return this.children.flatMap((child) => [
        ...(matches(child) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0];
    }
    fire(name, extra = {}) {
      return this.listeners[name]?.({
        target: this,
        preventDefault() {},
        ...extra,
      });
    }
    click() {
      if (!this.disabled) this.fire("click");
    }
  }
  const ids = [
    "tabEditor",
    "editorTable",
    "editorBpm",
    "editorString",
    "editorFret",
    "editorDuration",
    "editorMessage",
    "editorSaveStatus",
    "editorSummary",
    "editorPlay",
    "editorStop",
    "editorDelete",
    "editorUndo",
    "editorRedo",
    "editorDuplicate",
    "editorSelection",
    "editorAdd",
    "editorNew",
    "editorRest",
    "editorFrets",
    "editorDownload",
    "editorPlaybackStatus",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  Object.assign(elements.editorBpm, { value: "90", tag: "input" });
  Object.assign(elements.editorString, { value: "6", tag: "select" });
  Object.assign(elements.editorFret, { value: "0", tag: "input" });
  Object.assign(elements.editorDuration, { value: "1", tag: "select" });
  globalThis.document = {
    activeElement: null,
    querySelector: (selector) => elements[selector.slice(1)],
    createElement: (tag) => new Element(tag),
    addEventListener() {},
  };
  globalThis.localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  };
  const notes = () => JSON.parse(saved.get("ritim-tab-draft-v1")).notes;
  try {
    initializeTabEditor({ onStart() {}, onStop() {} });
    elements.editorNew.click();
    const addCell = elements.editorTable.querySelector(
      '[data-step="5"][data-string="1"]',
    );
    elements.editorTable.fire("click", { target: addCell });
    assert.equal(notes().length, 6);
    assert.deepEqual(notes()[5], { string: 1, fret: 0, beats: 1 });
    const key = (value) =>
      elements.tabEditor.fire("keydown", {
        target: document.activeElement,
        key: value,
      });
    key("1");
    key("2");
    assert.equal(notes()[5].fret, 12);
    elements.editorUndo.click();
    assert.equal(notes()[5].fret, 1);
    elements.editorRedo.click();
    assert.equal(notes()[5].fret, 12);
    elements.editorRest.click();
    assert.deepEqual(notes().at(-1), { string: null, fret: null, beats: 1 });
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
});
