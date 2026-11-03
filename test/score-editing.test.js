import test from "node:test";
import assert from "node:assert/strict";
import { ScoreSession } from "../dist/score-session.js";
import { createEmptyScore, serializeScore } from "../dist/score-document.js";
import {
  loadScoreDraft,
  saveScoreDraft,
  legacyStorageKey,
  scoreStorageKey,
} from "../dist/score-storage.js";
import {
  splitMeasures,
  exportScoreText,
  noteLabel,
} from "../dist/score-notation.js";

const voice = (string, fret, techniques = []) => ({ string, fret, techniques });

test("Aynı adıma eklenen teller korunur ve geri al/yinele teknikleri kaybetmez", () => {
  const session = new ScoreSession();
  const id = session.add(voice(6, 0));
  session.setVoice(id, voice(5, 2, [{ type: "vibrato" }]));
  assert.equal(session.document.events[0].notes.length, 2);
  session.undo();
  assert.equal(session.document.events[0].notes.length, 1);
  session.redo();
  assert.equal(
    session.document.events[0].notes[1].techniques[0].type,
    "vibrato",
  );
  session.setVoice(id, voice(5, 3));
  assert.equal(session.document.events[0].notes.length, 2);
  assert.equal(session.document.events[0].notes[1].fret, 3);
});

test("Tek bir sesi silmek akorun diğer sesini korur; son ses silinince sus kalır", () => {
  const session = new ScoreSession();
  const id = session.add(voice(6, 0));
  session.setVoice(id, voice(5, 2));
  session.removeVoice(id, 5);
  assert.equal(session.document.events[0].notes[0].string, 6);
  session.removeVoice(id, 6);
  assert.equal(session.document.events.length, 1);
  assert.deepEqual(session.document.events[0].notes, []);
});

test("Geçersiz teknik işlemi ve dolu belgeye ekleme atomik olarak reddedilir", () => {
  const session = new ScoreSession();
  const id = session.add(voice(1, 7));
  const before = serializeScore(session.document);
  const historyLength = session.past.length;
  assert.throws(() =>
    session.setVoice(id, voice(1, 7, [{ type: "hammerOn", targetFret: 5 }])),
  );
  assert.equal(serializeScore(session.document), before);
  assert.equal(session.past.length, historyLength);
  for (let index = 1; index < 128; index++) session.add(null);
  assert.throws(() => session.add(null), /128/);
  assert.equal(session.document.events.length, 128);
});

test("Çoğaltma derin kopya ve benzersiz kimlik üretir", () => {
  const session = new ScoreSession();
  const id = session.add(voice(1, 5, [{ type: "vibrato" }]));
  const copied = session.duplicate(id);
  assert.notEqual(id, copied);
  session.setVoice(copied, voice(1, 9));
  assert.equal(session.document.events[0].notes[0].fret, 5);
  session.undo();
  assert.equal(
    session.document.events[1].notes[0].techniques[0].type,
    "vibrato",
  );
});

test("Yeni biçime kaydetmek eski taslağı değiştirmez ve akoru tam geri yükler", () => {
  const legacy = JSON.stringify({
    version: 1,
    bpm: 90,
    notes: [{ string: 6, fret: 0, beats: 1 }],
  });
  const values = new Map([[legacyStorageKey, legacy]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const draft = loadScoreDraft(storage);
  assert.equal(draft.migrated, true);
  const session = new ScoreSession(draft.score);
  session.setVoice(
    session.document.events[0].id,
    voice(5, 2, [{ type: "bend", semitones: 1 }]),
  );
  saveScoreDraft(storage, session.document);
  assert.equal(values.get(legacyStorageKey), legacy);
  assert.deepEqual(loadScoreDraft(storage).score, session.document);
});

test("Bozuk veya gelecekteki kayıt eski taslağa sessizce düşmez", () => {
  const future = JSON.stringify({ format: "ritim-score", version: 999 });
  const storage = {
    getItem: (key) =>
      key === scoreStorageKey
        ? future
        : JSON.stringify({ version: 1, bpm: 90, notes: [] }),
  };
  assert.throws(() => loadScoreDraft(storage));
});

test("Ölçü sınırındaki tek nota bağ benzeri parçalara ayrılır, kimliği korunur", () => {
  const session = new ScoreSession();
  session.add(voice(1, 5), 5760);
  const measures = splitMeasures(session.document);
  assert.equal(measures.length, 2);
  assert.equal(measures[0].segments[0].durationTicks, 3840);
  assert.equal(measures[1].segments[0].durationTicks, 1920);
  assert.equal(measures[1].segments[0].continuation, true);
  assert.equal(measures[0].segments[0].id, measures[1].segments[0].id);
});

test("Metin çıktısı akorları, süreyi ve teknik işaretlerini korur", () => {
  const session = new ScoreSession();
  const id = session.add(voice(1, 5, [{ type: "slide", targetFret: 9 }]));
  session.setVoice(
    id,
    voice(2, 7, [{ type: "bend", semitones: 2 }, { type: "vibrato" }]),
  );
  const text = exportScoreText(session.document);
  assert.ok(text.includes("5/9"));
  assert.ok(text.includes("7↑2~"));
  assert.ok(text.includes("960"));
  assert.equal(
    noteLabel(voice(1, 7, [{ type: "pullOff", targetFret: 5 }])),
    "7p5",
  );
  assert.equal(
    noteLabel(voice(1, 5, [{ type: "hammerOn", targetFret: 7 }])),
    "5h7",
  );
});
