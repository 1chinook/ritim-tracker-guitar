import test from "node:test";
import assert from "node:assert/strict";
import { TabHistory } from "../dist/tab-history.js";

const first = [{ string: 6, fret: 0, beats: 1 }];
const second = [...first, { string: 5, fret: 3, beats: 0.5 }];

test("Nota ekleme ve silme geri alınabilir ve yinelenebilir", () => {
  const history = new TabHistory();
  history.record(first, second);
  const restored = history.undo(second);
  assert.deepEqual(restored, first);
  assert.deepEqual(history.redo(restored), second);
});

test("Yeni değişiklik ileri geçmişini temizler; aynı notalar geçmişe eklenmez", () => {
  const history = new TabHistory();
  history.record(first, second);
  history.undo(second);
  history.record(first, [{ string: null, fret: null, beats: 1 }]);
  assert.equal(history.future.length, 0);
  const length = history.past.length;
  history.record(first, structuredClone(first));
  assert.equal(history.past.length, length);
});

test("Geçmiş saklanan taslakla aynı nesneleri paylaşmaz", () => {
  const history = new TabHistory();
  const original = structuredClone(first);
  history.record(original, second);
  original[0].fret = 12;
  assert.equal(history.undo(second)[0].fret, 0);
});

test("Geri alınacak işlem yokken notalar korunur; en fazla 50 işlem tutulur", () => {
  const history = new TabHistory();
  assert.deepEqual(history.undo(first), first);
  assert.deepEqual(history.redo(first), first);
  for (let index = 0; index < 60; index++) history.record(first, second);
  assert.equal(history.past.length, 50);
});
