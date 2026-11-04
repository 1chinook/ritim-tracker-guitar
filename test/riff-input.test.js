import test from "node:test";
import assert from "node:assert/strict";
import { parseRiff } from "../dist/riff-input.js";
import { ScoreSession } from "../dist/score-session.js";

test("Hızlı giriş aralıkları, iki basamaklı perdeleri ve susları okur", () => {
  assert.deepEqual(
    parseRiff("  0  12\n24 - r  ", 6).map((voice) => voice?.fret ?? null),
    [0, 12, 24, null, null],
  );
  for (const value of ["", "5.5", "-1", "25", "1h3", "0 nope"])
    assert.throws(() => parseRiff(value, 6));
  assert.throws(() => parseRiff("0", 0));
});

test("Dizi seçimin sonrasına tek geçmiş adımı olarak eklenir, sınırda belge korunur", () => {
  const session = new ScoreSession();
  const first = session.add({ string: 6, fret: 7, techniques: [] });
  session.add({ string: 5, fret: 9, techniques: [] });
  const before = structuredClone(session.document);
  session.insertSequence(parseRiff("0 - 12", 1), 480, first);
  assert.deepEqual(
    session.document.events.map((event) => event.notes[0]?.fret ?? null),
    [7, 0, null, 12, 9],
  );
  assert.equal(
    new Set(session.document.events.map((event) => event.id)).size,
    5,
  );
  session.undo();
  assert.deepEqual(session.document, before);
  assert.throws(() => session.insertSequence(Array(128).fill(null), 960));
  assert.deepEqual(session.document, before);
});
