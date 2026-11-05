import test from "node:test";
import assert from "node:assert/strict";
import { ScoreSession } from "../dist/score-session.js";
import { selectionBounds, selectedRegion } from "../dist/score-selection.js";

const note = (string, fret) => ({ string, fret, techniques: [] });

test("Araya ekleme seçimin önüne gelir ve tek işlemde geri alınır", () => {
  const session = new ScoreSession();
  const a = session.add(note(6, 0));
  const b = session.add(note(6, 5));
  const before = structuredClone(session.document);
  const inserted = session.insertBefore(b, note(5, 12), 480);
  assert.deepEqual(
    session.document.events.map((event) => event.id),
    [a, inserted, b],
  );
  assert.equal(session.document.events[1].durationTicks, 480);
  session.undo();
  assert.deepEqual(session.document, before);
  session.redo();
  assert.equal(session.document.events[1].notes[0].fret, 12);
});

test("Dikdörtgen seçim süreleri ve boşlukları korur, toplu silme diğer telleri korur", () => {
  const session = new ScoreSession();
  const a = session.add(note(6, 0), 480);
  session.setVoice(a, note(1, 7));
  const b = session.add(note(5, 2), 960);
  const c = session.add(note(1, 12), 240);
  const bounds = selectionBounds(
    session.document,
    { id: c, string: 6 },
    { id: a, string: 5 },
  );
  const copied = selectedRegion(session.document, bounds);
  assert.deepEqual(
    copied.events.map((event) => event.durationTicks),
    [480, 960, 240],
  );
  assert.deepEqual(copied.events[2].notes, []);
  const before = structuredClone(session.document);
  session.removeVoices(copied.ids, copied.strings);
  assert.deepEqual(
    session.document.events.map((event) => event.notes),
    [[note(1, 7)], [], [note(1, 12)]],
  );
  session.undo();
  assert.deepEqual(session.document, before);
  assert.deepEqual(copied.ids, [a, b, c]);
});

test("Yapıştırma akorları ve teknikleri derin kopyalar, eski notaların üzerine yazmaz", () => {
  const session = new ScoreSession();
  const a = session.add(note(6, 0));
  session.setVoice(a, {
    string: 5,
    fret: 2,
    techniques: [{ type: "vibrato" }],
  });
  const b = session.add(null, 480);
  const source = selectedRegion(session.document, {
    first: 0,
    last: 1,
    top: 1,
    bottom: 6,
  });
  const before = structuredClone(session.document);
  const ids = session.insertEvents(source.events, a);
  assert.deepEqual(
    session.document.events.map((event) => event.id),
    [a, ...ids, b],
  );
  assert.deepEqual(session.document.events[1].notes, before.events[0].notes);
  source.events[0].notes[0].fret = 24;
  assert.equal(session.document.events[1].notes[0].fret, 0);
  session.undo();
  assert.deepEqual(session.document, before);
});

test("Ölçü çoğaltma taşan notayı doğru yerde böler ve seçili ölçünün süresini kopyalar", () => {
  const session = new ScoreSession();
  const long = session.add(note(6, 3), 9600);
  const tail = session.add(note(1, 12), 960);
  const before = structuredClone(session.document);
  const ids = session.duplicateMeasure(0);
  assert.equal(ids.length, 1);
  assert.deepEqual(
    session.document.events.map((event) => event.durationTicks),
    [3840, 3840, 5760, 960],
  );
  assert.equal(session.document.events[0].id, long);
  assert.equal(session.document.events.at(-1).id, tail);
  assert.equal(
    new Set(session.document.events.map((event) => event.id)).size,
    4,
  );
  session.undo();
  assert.deepEqual(session.document, before);
});

test("Kısmi son ölçü içeriği kadar çoğaltılır, boş ölçü geçmiş oluşturmaz", () => {
  const session = new ScoreSession();
  assert.deepEqual(session.duplicateMeasure(0), []);
  assert.equal(session.past.length, 0);
  session.add(note(2, 7), 480);
  session.duplicateMeasure(0);
  assert.deepEqual(
    session.document.events.map((event) => event.durationTicks),
    [480, 480],
  );
});

test("Doluluk veya geçersiz nota tüm eklemeyi reddeder ve geçmişi korur", () => {
  const session = new ScoreSession();
  for (let i = 0; i < 128; i++) session.add(null, 960);
  const before = structuredClone(session.document);
  const historyLength = session.past.length;
  assert.throws(() => session.duplicateMeasure(0), /128/);
  assert.throws(
    () => session.insertBefore(before.events[0].id, note(1, 3)),
    /128/,
  );
  assert.deepEqual(session.document, before);
  assert.equal(session.past.length, historyLength);
  const empty = new ScoreSession();
  assert.throws(() =>
    empty.insertEvents([{ durationTicks: 960, notes: [note(1, 25)] }]),
  );
  assert.deepEqual(empty.document.events, []);
  assert.equal(empty.past.length, 0);
});
