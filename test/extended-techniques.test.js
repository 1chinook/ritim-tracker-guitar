import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyScore,
  parseScore,
  serializeScore,
  validateScore,
} from "../dist/score-document.js";
import { ScoreSession } from "../dist/score-session.js";
import { compileScore } from "../dist/score-timeline.js";
import { buildPerformance } from "../dist/score-performance.js";
import { planVoice, scheduleVoice } from "../dist/score-audio.js";
import { noteLabel } from "../dist/score-notation.js";
const voice = (fret, techniques = []) => ({ string: 6, fret, techniques });
const compiled = (fret, techniques) => ({
  ...voice(fret, techniques),
  midi: 40 + fret,
  frequency: 82.4069 * 2 ** (fret / 12),
});
const curve = [
  { position: 0, semitones: 0 },
  { position: 0.5, semitones: 2 },
  { position: 1, semitones: 0 },
];

test("Yeni teknikler JSON, geri al ve çoğaltma içinde eksiksiz korunur", () => {
  const session = new ScoreSession();
  const id = session.add(
    voice(12, [
      { type: "bend", semitones: 2, curve },
      { type: "letRing" },
      { type: "harmonic", kind: "artificial" },
      { type: "tapping" },
      { type: "tremoloPicking", subdivision: 16 },
      { type: "pickDirection", direction: "down" },
    ]),
  );
  const before = serializeScore(session.document);
  session.duplicate(id);
  session.undo();
  assert.equal(serializeScore(session.document), before);
  assert.deepEqual(parseScore(before), session.document);
  assert.match(noteLabel(session.document.events[0].notes[0]), /LR/);
});

test("Geçersiz eğriler ve teknik parametreleri atomik reddedilir", () => {
  const session = new ScoreSession();
  const id = session.add(voice(3));
  for (const effect of [
    {
      type: "bend",
      semitones: 2,
      curve: [
        { position: 0, semitones: 0 },
        { position: 0, semitones: 2 },
      ],
    },
    {
      type: "bend",
      semitones: 2,
      curve: [
        { position: 0, semitones: 0 },
        { position: 1, semitones: 3 },
      ],
    },
    { type: "harmonic", kind: "natural" },
    { type: "harmonic", kind: "other" },
    { type: "tremoloPicking", subdivision: 7 },
    { type: "pickDirection", direction: "left" },
  ])
    assert.throws(() => session.setVoice(id, voice(3, [effect])));
  assert.deepEqual(session.document.events[0].notes, [voice(3)]);
});

test("Bend eğrisi sonunda sese geri döner, pre-bend yüksekten başlar", () => {
  const note = compiled(5, [{ type: "bend", semitones: 2, curve }]);
  const plan = planVoice(note, 1);
  assert.equal(plan.pitch[0].frequency, plan.pitch.at(-1).frequency);
  assert.ok(plan.pitch[1].frequency > plan.pitch[0].frequency);
  const pre = planVoice(
    compiled(5, [
      {
        type: "bend",
        semitones: 2,
        curve: [
          { position: 0, semitones: 2 },
          { position: 1, semitones: 0 },
        ],
      },
    ]),
    1,
  );
  assert.ok(pre.pitch[0].frequency > pre.pitch[1].frequency);
});

test("Doğal harmonik düğümleri ve yapay harmonik doğru perdeye yükselir", () => {
  const natural = planVoice(
    compiled(5, [{ type: "harmonic", kind: "natural" }]),
    1,
  );
  const artificial = planVoice(
    compiled(5, [{ type: "harmonic", kind: "artificial" }]),
    1,
  );
  assert.ok(Math.abs(natural.pitch[0].frequency - 82.4069 * 4) < 0.01);
  assert.ok(
    Math.abs(artificial.pitch[0].frequency - compiled(5, []).frequency * 2) <
      0.01,
  );
});

test("Bağlı slide, hammer-on ve pull-off hedef notayı yeniden koparmaz", () => {
  for (const [type, first, last] of [
    ["slide", 3, 7],
    ["hammerOn", 3, 7],
    ["pullOff", 7, 3],
  ]) {
    const session = new ScoreSession(createEmptyScore(120));
    const a = session.add(voice(first));
    const b = session.add(voice(last));
    session.linkNotes(a, b, 6, type);
    const performance = buildPerformance(compileScore(session.document));
    assert.equal(performance.voices.length, 1);
    assert.equal(performance.voices[0].note.segments.length, 2);
    assert.equal(performance.voices[0].duration, 1);
    session.undo();
    assert.equal(session.document.events[0].notes[0].techniques.length, 0);
  }
});

test("Eksik veya ters yönlü nota bağlantısı belgeyi değiştirmez", () => {
  const session = new ScoreSession();
  const a = session.add(voice(7));
  const b = session.add(voice(3));
  const before = serializeScore(session.document);
  assert.throws(() => session.linkNotes(a, b, 6, "hammerOn"));
  assert.throws(() => session.linkNotes(b, a, 6, "slide"));
  assert.equal(serializeScore(session.document), before);
});

test("Let ring bir sonraki aynı teldeki notaya kadar sürer, son nota kuyruğu sınırlıdır", () => {
  const session = new ScoreSession(createEmptyScore(120));
  session.add(voice(0, [{ type: "letRing" }]));
  session.add({ string: 1, fret: 0, techniques: [] });
  session.add(voice(5, [{ type: "letRing" }]));
  const performance = buildPerformance(compileScore(session.document));
  assert.equal(performance.voices[0].duration, 1);
  assert.equal(performance.duration, 3.5);
});

test("Tremolo picking BPM ve alt bölüme göre örneği yeniden başlatır", () => {
  const starts = [];
  const parameter = () => ({
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
  });
  const node = () => ({
    connect(target) {
      return target;
    },
    disconnect() {},
  });
  const context = {
    destination: {},
    createGain: () => ({ ...node(), gain: parameter() }),
    createBiquadFilter: () => ({ ...node(), frequency: parameter() }),
    createBufferSource: () => ({
      ...node(),
      playbackRate: parameter(),
      start(time) {
        starts.push(time);
      },
      stop() {},
    }),
  };
  const note = {
    ...compiled(0, [{ type: "tremoloPicking", subdivision: 16 }]),
    bpm: 120,
  };
  scheduleVoice(context, note, 0.5, 10, 1, { midi: 40, buffer: {} });
  assert.deepEqual(starts, [10, 10.125, 10.25, 10.375]);
});
