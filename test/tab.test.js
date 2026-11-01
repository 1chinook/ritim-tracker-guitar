import test from "node:test";
import assert from "node:assert/strict";
import {
  createTimeline,
  validateNotes,
  exportTextTab,
} from "../dist/tab-model.js";
import { TabPlayer } from "../dist/tab-player.js";

const exercise = [
  { string: 5, fret: 0, beats: 1 },
  { string: null, fret: null, beats: 0.5 },
  { string: 5, fret: 12, beats: 2 },
];

test("Nota ve sus süreleri BPM'ye göre zaman çizelgesine dönüşür", () => {
  const events = createTimeline(exercise, 120);
  assert.deepEqual(
    events.map(({ start, duration }) => [start, duration]),
    [
      [0, 0.5],
      [0.5, 0.25],
      [0.75, 1],
    ],
  );
  assert.equal(events[0].frequency, 110);
  assert.equal(events[1].frequency, null);
  assert.equal(events[2].frequency, 220);
  assert.deepEqual(exercise[0], { string: 5, fret: 0, beats: 1 });
});

test("BPM ikiye katlandığında egzersiz süresi yarıya iner", () => {
  const slow = createTimeline(exercise, 60).at(-1);
  const fast = createTimeline(exercise, 120).at(-1);
  assert.equal(slow.start + slow.duration, 2 * (fast.start + fast.duration));
});

test("Sınır dışı tel, perde, süre ve BPM kabul edilmez", () => {
  for (const note of [
    { string: 7, fret: 0, beats: 1 },
    { string: 1, fret: 25, beats: 1 },
    { string: 1, fret: 1.5, beats: 1 },
    { string: null, fret: 0, beats: 1 },
    { string: 1, fret: 0, beats: 0 },
  ]) {
    assert.throws(() => validateNotes([note]));
  }
  assert.throws(() => validateNotes(Array(129).fill(exercise[0])));
  assert.throws(() => createTimeline(exercise, NaN));
  assert.throws(() => createTimeline(exercise, 0));
  assert.deepEqual(createTimeline([], 90), []);
});

test("Metin tabında tel sırası, çift basamaklı perde ve süreler korunur", () => {
  const text = exportTextTab(exercise);
  const rows = text.split("\n");
  assert.equal(rows[0], "e|--------|");
  assert.equal(rows[4], "A|-0----12|");
  assert.ok(text.includes("Beats: 1 / 0.5 / 2"));
});

function mockAudio(context) {
  const previous = {
    AudioContext: globalThis.AudioContext,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const oscillators = [];
  let frame;
  let releaseResume;
  let paused = false;
  const audio = {
    state: "running",
    currentTime: 10,
    async resume() {
      if (paused)
        await new Promise((resolve) => {
          releaseResume = resolve;
        });
    },
    async close() {
      this.state = "closed";
    },
    createOscillator() {
      const oscillator = {
        frequency: {},
        connect() {
          return { connect() {} };
        },
        disconnect() {},
        start(time) {
          this.startTime = time;
        },
        stop(time) {
          this.stopTime = time;
        },
      };
      oscillators.push(oscillator);
      return oscillator;
    },
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        disconnect() {},
      };
    },
  };
  globalThis.AudioContext = class {
    constructor() {
      return audio;
    }
  };
  globalThis.requestAnimationFrame = (callback) => {
    frame = callback;
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};
  let stops = 0;
  const steps = [];
  const player = new TabPlayer({
    onStep: (step) => steps.push(step),
    onStop: () => stops++,
  });
  context.after(() => {
    player.stop();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  });
  return {
    player,
    audio,
    oscillators,
    steps,
    stops: () => stops,
    tick: () => frame(),
    hold: () => {
      paused = true;
    },
    release: () => releaseResume(),
  };
}

test("Ses notaları doğru saatlere planlanır; sus için ses üretilmez", async (context) => {
  const mocked = mockAudio(context);
  await mocked.player.play(exercise, 120);
  assert.equal(mocked.oscillators.length, 2);
  assert.equal(mocked.oscillators[0].startTime, 10.08);
  assert.equal(mocked.oscillators[1].startTime, 10.83);
  assert.equal(mocked.oscillators[1].frequency.value, 220);
  mocked.audio.currentTime = 10.65;
  mocked.tick();
  assert.deepEqual(mocked.steps, [1]);
  mocked.audio.currentTime = 12;
  mocked.tick();
  assert.equal(mocked.player.playing, false);
  assert.equal(mocked.audio.state, "closed");
  assert.equal(mocked.stops(), 1);
});

test("Ses açılışı beklenirken durdurulan oynatma sonradan başlamaz", async (context) => {
  const mocked = mockAudio(context);
  mocked.hold();
  const pending = mocked.player.play(exercise, 90);
  mocked.player.stop();
  mocked.release();
  await pending;
  assert.equal(mocked.oscillators.length, 0);
  assert.equal(mocked.audio.state, "closed");
  assert.equal(mocked.player.playing, false);
  assert.equal(mocked.stops(), 1);
});
