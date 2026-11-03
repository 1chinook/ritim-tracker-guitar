import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyScore,
  validateScore,
  migrateLegacyDraft,
  serializeScore,
  parseScore,
  ticksPerBeat,
} from "../dist/score-document.js";
import { compileScore } from "../dist/score-timeline.js";

function chordScore() {
  const score = createEmptyScore(120);
  score.events = [
    {
      id: "chord",
      durationTicks: 960,
      notes: [
        { string: 6, fret: 0, techniques: [] },
        { string: 5, fret: 2, techniques: [{ type: "palmMute" }] },
        { string: 4, fret: 2, techniques: [{ type: "vibrato" }] },
      ],
    },
    { id: "rest", durationTicks: 480, notes: [] },
    {
      id: "bend",
      durationTicks: 960,
      notes: [
        { string: 2, fret: 7, techniques: [{ type: "bend", semitones: 2 }] },
      ],
    },
  ];
  return score;
}

test("Akorun tüm notaları aynı anda başlar, sus toplam süreyi korur", () => {
  const timeline = compileScore(chordScore());
  assert.equal(timeline.events[0].notes.length, 3);
  assert.equal(timeline.events[0].start, 0);
  assert.equal(timeline.events[1].start, 0.5);
  assert.deepEqual(timeline.events[1].notes, []);
  assert.equal(timeline.events[2].start, 0.75);
  assert.equal(timeline.duration, 1.25);
  assert.deepEqual(
    timeline.events[0].notes.map((note) => note.midi),
    [40, 47, 52],
  );
});

test("Teknik bilgisi JSON kaydetme/okuma ve zaman çizelgesinde korunur", () => {
  const document = validateScore(chordScore());
  const restored = parseScore(serializeScore(document));
  assert.deepEqual(restored, document);
  assert.deepEqual(compileScore(restored).events[2].notes[0].techniques, [
    { type: "bend", semitones: 2 },
  ]);
  assert.deepEqual(restored.events[0].notes[2].techniques, [
    { type: "vibrato", depthCents: 30, rateHz: 5 },
  ]);
});

test("Eski tek sesli taslak değiştirilmeden yeni modele dönüştürülür", () => {
  const legacy = {
    version: 1,
    bpm: 90,
    notes: [
      { string: 6, fret: 3, beats: 0.5 },
      { string: null, fret: null, beats: 1 },
    ],
  };
  const original = structuredClone(legacy);
  const document = migrateLegacyDraft(legacy);
  assert.deepEqual(legacy, original);
  assert.deepEqual(parseScore(JSON.stringify(legacy)), document);
  assert.equal(document.events[0].durationTicks, 480);
  assert.deepEqual(document.events[1].notes, []);
  assert.equal(document.events[0].notes[0].fret, 3);
});

test("Üçleme ve noktalı süreler tam sayı tick ile ifade edilebilir", () => {
  const score = createEmptyScore(60);
  score.events = [320, 320, 320, 1440].map((durationTicks, index) => ({
    id: `note-${index}`,
    durationTicks,
    notes: [],
  }));
  const timeline = compileScore(score);
  assert.equal(timeline.totalTicks, ticksPerBeat * 2.5);
  assert.equal(timeline.duration, 2.5);
});

test("6/8 ve 4/4 ölçü sınırları farklı hesaplanır", () => {
  const score = createEmptyScore();
  score.meter = { beats: 6, unit: 8 };
  score.events = [
    { id: "first", durationTicks: 2880, notes: [] },
    { id: "next", durationTicks: 960, notes: [] },
  ];
  assert.equal(compileScore(score).events[1].measureIndex, 1);
  score.meter = { beats: 4, unit: 4 };
  assert.equal(compileScore(score).events[1].measureIndex, 0);
});

test("Aynı telde çift nota ve tekrar eden adım kimliği reddedilir", () => {
  const score = chordScore();
  score.events[0].notes[1].string = 6;
  assert.throws(() => validateScore(score), /two notes/);
  const duplicate = chordScore();
  duplicate.events[1].id = "chord";
  assert.throws(() => validateScore(duplicate), /unique event/);
});

test("Geçersiz teknik parametreleri ve uyumsuz teknikler reddedilir", () => {
  const effects = [
    [{ type: "vibrato", depthCents: -1 }],
    [{ type: "bend", semitones: Infinity }],
    [{ type: "hammerOn", targetFret: 1 }],
    [{ type: "pullOff", targetFret: 10 }],
    [{ type: "slide", targetFret: 7 }],
    [{ type: "deadNote" }, { type: "vibrato" }],
    [{ type: "vibrato" }, { type: "vibrato" }],
    [{ type: "unknown" }],
  ];
  for (const techniques of effects) {
    const score = chordScore();
    score.events[2].notes[0].techniques = techniques;
    assert.throws(() => validateScore(score));
  }
});

test("Gelecek sürümler ve bilinmeyen alanlar sessizce silinmez", () => {
  const score = chordScore();
  score.version = 999;
  assert.throws(() => parseScore(JSON.stringify(score)), /Unsupported/);
  const unknown = chordScore();
  unknown.events[0].notes[0].newTechnique = true;
  assert.throws(() => serializeScore(unknown), /refusing to discard/);
  assert.throws(() => migrateLegacyDraft({ version: 1, notes: [] }), /BPM/);
});

test("Doğrulanan belge ve derlenmiş çıktı kaynakla nesne paylaşmaz", () => {
  const original = chordScore();
  const timeline = compileScore(original);
  timeline.events[0].notes[1].techniques[0].type = "deadNote";
  assert.equal(original.events[0].notes[1].techniques[0].type, "palmMute");
});
