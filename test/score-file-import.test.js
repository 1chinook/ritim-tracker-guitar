import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  importer,
  exporter,
  Settings,
  model,
} from "../dist/vendor/alphatab/alphaTab.core.min.mjs";
import {
  listImportParts,
  convertImportedScore,
} from "../dist/score-file-import.js";
import { parseTuning, matchingTuning } from "../dist/guitar-tunings.js";
import { ScoreSession } from "../dist/score-session.js";
import { createEmptyScore } from "../dist/score-document.js";
const bytes = readFileSync(
  new URL("./fixtures/import-guitar.musicxml", import.meta.url),
);
const load = () =>
  importer.ScoreLoader.loadScoreFromBytes(bytes, new Settings());
const convert = (source) => convertImportedScore(source, "0/0/0", 1, 2);
test("Gerçek MusicXML Drop D akordunu, tel sırasını, akoru, susu ve süreleri korur", () => {
  const source = load();
  assert.equal(listImportParts(source).length, 1);
  const { score } = convert(source);
  assert.equal(score.bpm, 90);
  assert.deepEqual(score.tuning, [64, 59, 55, 50, 45, 38]);
  assert.deepEqual(
    score.events[0].notes.map(({ string, fret }) => ({ string, fret })),
    [
      { string: 6, fret: 0 },
      { string: 4, fret: 0 },
    ],
  );
  assert.equal(score.events[1].notes[0].string, 1);
  assert.equal(score.events[2].notes.length, 0);
  assert.deepEqual(
    score.events.map((e) => e.durationTicks),
    [960, 960, 1920, 960, 960, 960, 960],
  );
});
test("Guitar Pro 7 dosyası gerçek dışa aktarım ve okuyucu ile aynı belgeye döner", () => {
  const source = load();
  const gp = new exporter.Gp7Exporter().export(source, new Settings());
  const parsed = importer.ScoreLoader.loadScoreFromBytes(gp, new Settings());
  assert.deepEqual(convert(parsed).score, convert(source).score);
});
test("Değişen ölçü ve tempo sessizce düzleştirilmez; uygun alt aralık alınır", () => {
  const source = load();
  source.masterBars[1].timeSignatureNumerator = 3;
  assert.throws(() => convert(source), /ölçü değişiyor/);
  assert.equal(
    convertImportedScore(source, "0/0/0", 1, 1).score.events.length,
    3,
  );
  const tempo = load();
  tempo.masterBars[1].tempoAutomations.push({ value: 120 });
  assert.throws(() => convert(tempo), /tempo değişiyor/);
  assert.throws(() => convertImportedScore(tempo, "0/0/0", 0, 1), /aralığı/);
});
test("Kapo ve ses transpozisyonu doğru yönde uygulanır", () => {
  const source = load();
  source.tracks[0].staves[0].capo = 2;
  source.tracks[0].staves[0].transpositionPitch = 12;
  assert.deepEqual(convert(source).score.tuning, [54, 49, 45, 40, 35, 28]);
});
test("Uzun dosyada 128 adım sınırı açık hata verir", () => {
  const source = load();
  const master = source.masterBars[1];
  source.masterBars = Array.from({ length: 40 }, () => master);
  source.tracks[0].staves[0].bars = Array.from(
    { length: 40 },
    () => source.tracks[0].staves[0].bars[1],
  );
  assert.throws(() => convertImportedScore(source, "0/0/0", 1, 40), /128 adım/);
});
test("İçe aktarılan tüm belge ve akort tek adımda geri alınır", () => {
  const original = createEmptyScore(120);
  const session = new ScoreSession(original);
  const imported = convert(load()).score;
  session.change((draft) => Object.assign(draft, imported));
  assert.deepEqual(session.document, imported);
  session.undo();
  assert.deepEqual(session.document, original);
  session.redo();
  assert.deepEqual(session.document, imported);
});
test("Özel akort oktavları, diyez ve bemolü okur; geçersiz girdi reddedilir", () => {
  assert.deepEqual(parseTuning("E4 B3 G3 D3 A2 D2"), [64, 59, 55, 50, 45, 38]);
  assert.equal(matchingTuning(parseTuning("Eb4 Bb3 Gb3 Db3 Ab2 Eb2")), "eb");
  assert.deepEqual(
    parseTuning("E4 B3 G3 D3 F♯2 C♭2"),
    [64, 59, 55, 50, 42, 35],
  );
  for (const invalid of [
    "E B G D A E",
    "E4 B3 G3 D3 A2",
    "E4 B3 G3 D3 A2 H2",
    "E4 B3 G3 D3 A2 C9",
  ])
    assert.throws(() => parseTuning(invalid));
});

test("Guitar Pro teknikleri perde ve bend eğrisiyle birlikte aktarılır", () => {
  const source = load();
  const beats = source.tracks[0].staves[0].bars[1].voices[0].beats;
  const note = beats[0].notes[0];
  note.isPalmMute = true;
  note.isLetRing = true;
  note.vibrato = 1;
  note.addBendPoint(new model.BendPoint(0, 0));
  note.addBendPoint(new model.BendPoint(60, 4));
  beats[0].tap = true;
  beats[0].pickStroke = 2;
  beats[0].tremoloPicking = new model.TremoloPickingEffect();
  beats[0].tremoloPicking.marks = 2;
  const gp = new exporter.Gp7Exporter().export(source, new Settings());
  const parsed = importer.ScoreLoader.loadScoreFromBytes(gp, new Settings());
  const effects = convert(parsed).score.events[3].notes[0].techniques;
  for (const type of [
    "palmMute",
    "letRing",
    "vibrato",
    "bend",
    "tapping",
    "pickDirection",
    "tremoloPicking",
  ])
    assert.ok(
      effects.some((effect) => effect.type === type),
      type,
    );
  assert.deepEqual(effects.find((e) => e.type === "bend").curve, [
    { position: 0, semitones: 0 },
    { position: 1, semitones: 2 },
  ]);
  assert.equal(
    effects.find((e) => e.type === "tremoloPicking").subdivision,
    16,
  );
});
test("Perdesiz MusicXML notalarına çakışmasız teller atanır, çalınamaz akor reddedilir", () => {
  const source = load();
  const beat = source.tracks[0].staves[0].bars[0].voices[0].beats[0];
  for (const note of beat.notes) {
    const pitch = note.realValueWithoutHarmonic;
    note.string = NaN;
    note.fret = NaN;
    note.octave = Math.floor(pitch / 12);
    note.tone = pitch % 12;
  }
  const result = convert(source);
  assert.equal(
    new Set(result.score.events[0].notes.map((n) => n.string)).size,
    2,
  );
  assert.ok(result.warnings.some((w) => w.includes("Perde bilgisi")));
  beat.notes[0].octave = 0;
  assert.throws(() => convert(source), /yerleştirilemiyor/);
});
test("Farklı sesler seçilebilir ve davul partileri listelenmez", () => {
  const source = load();
  const bar = source.tracks[0].staves[0].bars[0];
  bar.voices.push(bar.voices[0]);
  assert.equal(listImportParts(source).length, 2);
  assert.ok(
    convertImportedScore(source, "0/0/1", 1, 1).warnings.some((w) =>
      w.includes("seçilen parti"),
    ),
  );
  source.tracks[0].staves[0].isPercussion = true;
  assert.deepEqual(listImportParts(source), []);
});
