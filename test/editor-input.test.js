import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTabEditor } from "../dist/tab-editor.js";

test("Tab hücresi, teknikler, JSON açma ve geri alma aynı taslağı günceller", async () => {
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
    style = { minWidth: "" };
    get options() {
      return this.children.filter((child) => child.tag === "option");
    }
    scrollIntoView() {}
    select() {}
    get parentElement() {
      return this.parent;
    }
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
    replaceChildren(...children) {
      this.children.forEach((child) => {
        child.isConnected = false;
      });
      this.children = [];
      this.append(...children);
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
      const attributes = [
        ...selector.matchAll(/\[data-([\w-]+)(?:="([^"]*)")?\]/g),
      ];
      const key = (name) =>
        name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const matches =
        attributes.length &&
        attributes.every(
          (match) =>
            this.dataset[key(match[1])] !== undefined &&
            (match[2] === undefined ||
              String(this.dataset[key(match[1])]) === match[2]),
        );
      return matches ? this : this.parent?.closest(selector);
    }
    querySelectorAll(selector) {
      const matches = (node) =>
        selector === "[data-editor-control]"
          ? node.control
          : selector === "tr"
            ? node.tag === "tr"
            : [...selector.matchAll(/data-(event|string)="([^"]+)"/g)].every(
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
        stopPropagation() {},
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
    "editorDurationLabel",
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
    "editorNew",
    "editorNext",
    "editorEditFret",
    "editorInsertBefore",
    "editorCopy",
    "editorPaste",
    "editorClipboardStatus",
    "editorRest",
    "editorDownload",
    "editorPlaybackStatus",
    "editorMeter",
    "editorLetRing",
    "editorTapping",
    "editorHarmonic",
    "editorTremolo",
    "editorPickDirection",
    "editorBendCurve",
    "editorBendShape",
    "editorBendGraph",
    "editorLinkNotes",
    "editorLinkType",
    "editorPitchTechnique",
    "editorBend",
    "editorTargetFret",
    "editorVibrato",
    "editorVibratoDepth",
    "editorVibratoRate",
    "editorPalmMute",
    "editorDeadNote",
    "editorRemoveVoice",
    "editorJson",
    "editorImport",
    "editorRiff",
    "editorInsertRiff",
    "editorTone",
  ];
  const page = readFileSync(
    new URL("../dist/editor.html", import.meta.url),
    "utf8",
  );
  for (const id of ids)
    assert.ok(page.includes(`id="${id}"`), `Editör sayfasında ${id} eksik`);
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  Object.assign(elements.editorBpm, { value: "90", tag: "input" });
  Object.assign(elements.editorString, { value: "6", tag: "select" });
  Object.assign(elements.editorFret, { value: "0", tag: "input" });
  Object.assign(elements.editorDuration, { value: "960", tag: "select" });
  elements.editorMeter.value = "4/4";
  elements.editorPitchTechnique.value = "none";
  elements.editorBend.value = "1";
  elements.editorTargetFret.value = "2";
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
  const notes = () => JSON.parse(saved.get("ritim-score-v1")).events;
  try {
    initializeTabEditor({ onStart() {}, onStop() {} });
    elements.editorNew.click();
    const addCell = elements.editorTable.querySelector(
      '[data-event="new"][data-string="1"]',
    );
    elements.editorTable.fire("click", { target: addCell });
    assert.equal(
      saved.has("ritim-score-v1"),
      false,
      "Hücre seçmek taslağı değiştirmemeli",
    );
    const key = (value, shiftKey = false) =>
      elements.tabEditor.fire("keydown", {
        target: document.activeElement,
        key: value,
        shiftKey,
      });
    key("1");
    assert.equal(notes().length, 6);
    assert.deepEqual(notes()[5].notes, [
      { string: 1, fret: 1, techniques: [] },
    ]);
    key("2");
    assert.equal(notes()[5].notes[0].fret, 12);
    elements.editorUndo.click();
    assert.equal(notes()[5].notes[0].fret, 1);
    elements.editorRedo.click();
    assert.equal(notes()[5].notes[0].fret, 12);
    const currentId = notes()[5].id;
    const chordCell = elements.editorTable.querySelector(
      `[data-event="${currentId}"][data-string="2"]`,
    );
    elements.editorTable.fire("click", { target: chordCell });
    assert.equal(
      notes()[5].notes.length,
      1,
      "Boş hücreye tıklamak nota eklememeli",
    );
    key("5");
    assert.equal(
      notes()[5].notes.length,
      2,
      "İkinci tele ekleme önceki sesi silmemeli",
    );
    elements.editorPitchTechnique.value = "bend";
    elements.editorBend.value = "2";
    elements.editorPitchTechnique.fire("change");
    assert.deepEqual(notes()[5].notes[1].techniques, [
      { type: "bend", semitones: 2 },
    ]);
    elements.editorVibrato.checked = true;
    elements.editorVibrato.fire("change");
    assert.equal(notes()[5].notes[1].techniques.length, 2);
    elements.editorRemoveVoice.click();
    assert.equal(notes()[5].notes.length, 1);
    elements.editorUndo.click();
    assert.equal(notes()[5].notes.length, 2);
    elements.editorRest.click();
    assert.deepEqual(notes().at(-1).notes, []);
    assert.equal(notes().at(-1).durationTicks, 960);
    const beforeRiff = saved.get("ritim-score-v1");
    elements.editorString.value = "6";
    elements.editorRiff.value = "0 3 5 - 12";
    elements.editorInsertRiff.click();
    assert.deepEqual(
      notes()
        .slice(-5)
        .map((event) => event.notes[0]?.fret ?? null),
      [0, 3, 5, null, 12],
    );
    elements.editorUndo.click();
    assert.equal(
      saved.get("ritim-score-v1"),
      beforeRiff,
      "Dizi tek işlemde geri alınmalı",
    );
    elements.editorRiff.value = "0 99";
    elements.editorInsertRiff.click();
    assert.equal(
      saved.get("ritim-score-v1"),
      beforeRiff,
      "Hatalı diziden hiçbir nota eklenmemeli",
    );
    const beforeImport = saved.get("ritim-score-v1");
    const imported = JSON.parse(beforeImport);
    imported.bpm = 120;
    elements.editorImport.files = [
      { size: 1000, text: async () => JSON.stringify(imported) },
    ];
    await elements.editorImport.fire("change");
    assert.equal(JSON.parse(saved.get("ritim-score-v1")).bpm, 120);
    elements.editorUndo.click();
    assert.equal(saved.get("ritim-score-v1"), beforeImport);
    elements.editorImport.files = [
      { size: 20, text: async () => '{"format":"ritim-score","version":999}' },
    ];
    await elements.editorImport.fire("change");
    assert.equal(
      saved.get("ritim-score-v1"),
      beforeImport,
      "Geçersiz dosya çalışan taslağı bozmamalı",
    );
    elements.editorNew.click();
    const fret = (value) => {
      elements.editorEditFret.click();
      const input = document.activeElement;
      input.value = String(value);
      input.fire("keydown", { key: "Enter" });
    };
    fret(24);
    elements.editorNew.click();
    fret(3);
    assert.deepEqual(
      notes()
        .slice(-2)
        .map((step) => step.notes[0].fret),
      [24, 3],
    );
    const last = notes().at(-1);
    const cell = elements.editorTable.querySelector(
      `[data-event="${last.id}"][data-string="6"]`,
    );
    elements.editorTable.fire("click", { target: cell });
    fret(7);
    assert.equal(notes().at(-1).notes[0].fret, 7);
    key("Delete");
    assert.deepEqual(notes().at(-1), { ...last, notes: [] });
    key("Delete", true);
    assert.equal(
      notes().some((step) => step.id === last.id),
      false,
    );
    const beforeBar = saved.get("ritim-score-v1");
    const ticks = () =>
      notes().reduce((total, step) => total + step.durationTicks, 0);
    const beforeTicks = ticks();
    const removeBar = elements.editorTable
      .querySelectorAll("button")
      .find((button) => button.dataset.removeMeasure === "0");
    assert.ok(removeBar);
    elements.editorTable.fire("click", { target: removeBar });
    assert.equal(ticks(), beforeTicks - 3840);
    elements.editorUndo.click();
    assert.equal(saved.get("ritim-score-v1"), beforeBar);

    const initial = saved.get("ritim-score-v1");
    const originals = structuredClone(notes());
    const choose = (id, string, extra = {}) => {
      const target = elements.editorTable.querySelector(
        `[data-event="${id}"][data-string="${string}"]`,
      );
      elements.editorTable.fire("click", { target, ...extra });
      return target;
    };
    choose(originals[0].id, 6);
    elements.editorTable.fire("dblclick", { target: document.activeElement });
    let input = document.activeElement;
    assert.equal(input.tag, "input");
    input.value = "12";
    input.fire("keydown", { key: "Enter" });
    assert.equal(notes()[0].notes[0].fret, 12);
    elements.editorUndo.click();
    assert.equal(saved.get("ritim-score-v1"), initial);

    choose(originals[0].id, 6);
    elements.tabEditor.fire("keydown", {
      target: document.activeElement,
      key: "c",
      ctrlKey: true,
    });
    choose(originals[1].id, 6);
    elements.tabEditor.fire("keydown", {
      target: document.activeElement,
      key: "v",
      ctrlKey: true,
    });
    assert.equal(notes().length, originals.length + 1);
    assert.equal(notes()[2].notes[0].fret, originals[0].notes[0].fret);
    elements.editorUndo.click();
    assert.equal(saved.get("ritim-score-v1"), initial);

    choose(originals[0].id, 6);
    elements.editorEditFret.click();
    input = document.activeElement;
    input.value = "99";
    input.fire("keydown", { key: "Enter" });
    assert.equal(saved.get("ritim-score-v1"), initial);
    input.fire("keydown", { key: "Escape" });
    assert.equal(saved.get("ritim-score-v1"), initial);

    choose(originals[1].id, 6);
    elements.editorInsertBefore.click();
    input = document.activeElement;
    input.value = "9";
    input.fire("keydown", { key: "Enter" });
    assert.equal(notes().length, originals.length + 1);
    assert.equal(notes()[1].notes[0].fret, 9);
    assert.equal(notes()[2].id, originals[1].id);
    elements.editorUndo.click();
    assert.equal(saved.get("ritim-score-v1"), initial);

    choose(originals[0].id, 6);
    choose(originals[1].id, 5, { shiftKey: true });
    elements.editorCopy.click();
    choose(originals[2].id, 6);
    elements.editorPaste.click();
    assert.equal(notes().length, originals.length + 2);
    assert.deepEqual(notes()[3].notes, originals[0].notes);
    elements.editorUndo.click();
    assert.equal(saved.get("ritim-score-v1"), initial);

    const start = choose(originals[0].id, 6);
    const end = elements.editorTable.querySelector(
      `[data-event="${originals[2].id}"][data-string="5"]`,
    );
    elements.editorTable.fire("pointerdown", {
      target: start,
      button: 0,
      pointerType: "mouse",
    });
    elements.editorTable.fire("pointerover", { target: end, buttons: 1 });
    elements.editorTable.fire("click", { target: end });
    elements.editorRemoveVoice.click();
    assert.ok(
      notes()
        .slice(0, 3)
        .every((event) => event.notes.length === 0),
    );
    elements.editorUndo.click();
    assert.equal(saved.get("ritim-score-v1"), initial);

    const duplicate = elements.editorTable
      .querySelectorAll("button")
      .find((button) => button.dataset.duplicateMeasure === "0");
    assert.ok(duplicate);
    const beforeDuplicateTicks = ticks();
    elements.editorTable.fire("click", { target: duplicate });
    assert.equal(ticks(), beforeDuplicateTicks + 3840);
    elements.editorUndo.click();
    assert.equal(saved.get("ritim-score-v1"), initial);
    choose(originals[0].id, 6);
    elements.editorLetRing.checked = true;
    elements.editorLetRing.fire("change");
    assert.ok(
      notes()[0].notes[0].techniques.some(
        (effect) => effect.type === "letRing",
      ),
    );
    elements.editorUndo.click();
    choose(originals[0].id, 6);
    choose(originals[1].id, 6, { shiftKey: true });
    elements.editorLinkType.value = "slide";
    elements.editorLinkNotes.click();
    assert.ok(
      notes()[0].notes[0].techniques.some(
        (effect) => effect.type === "slide" && effect.targetFret === 3,
      ),
    );
    elements.editorUndo.click();
    assert.equal(saved.get("ritim-score-v1"), initial);
    choose(originals[0].id, 6);
    elements.editorPitchTechnique.value = "bend";
    elements.editorPitchTechnique.fire("change");
    elements.editorBendShape.value = "release";
    elements.editorBendShape.fire("change");
    assert.equal(
      elements.editorBendGraph.attributes.points,
      "0,30 50,23 100,30",
    );
    elements.editorUndo.click();
    elements.editorUndo.click();
    assert.equal(saved.get("ritim-score-v1"), initial);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
});
