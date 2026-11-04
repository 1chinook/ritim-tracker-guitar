import test from "node:test";
import assert from "node:assert/strict";
import { planVoice } from "../dist/score-audio.js";
import { ScorePlayer } from "../dist/score-player.js";
import { createEmptyScore } from "../dist/score-document.js";
import { sampleMidi } from "../dist/guitar-samples.js";

const note = (techniques = []) => ({
  string: 1,
  fret: 5,
  midi: 69,
  frequency: 440,
  techniques,
});

test("Bend hedefi yarım ses miktarından hesaplanır; slide sürekli geçiştir", () => {
  const bend = planVoice(note([{ type: "bend", semitones: 2 }]), 1);
  assert.ok(Math.abs(bend.pitch[1].frequency - 440 * 2 ** (2 / 12)) < 0.001);
  assert.equal(bend.pitch[1].ramp, true);
  const slide = planVoice(note([{ type: "slide", targetFret: 7 }]), 1);
  assert.equal(slide.pitch[1].ramp, true);
  assert.ok(slide.pitch[1].time > 0 && slide.pitch[1].time < 1);
});

test("Hammer-on ve pull-off doğru yönde koparmasız perde değiştirir", () => {
  const hammer = planVoice(note([{ type: "hammerOn", targetFret: 7 }]), 1);
  const pull = planVoice(note([{ type: "pullOff", targetFret: 3 }]), 1);
  assert.equal(hammer.pitch[1].ramp, false);
  assert.ok(hammer.pitch[1].frequency > 440);
  assert.ok(pull.pitch[1].frequency < 440);
  assert.ok(hammer.pitch[1].time < hammer.length);
});

test("Vibrato parametreleri taşınır; palm mute ve ölü nota kısa sürer", () => {
  const normal = planVoice(note(), 1);
  const vibrato = planVoice(
    note([{ type: "vibrato", depthCents: 60, rateHz: 6 }]),
    1,
  );
  assert.deepEqual(vibrato.vibrato, {
    type: "vibrato",
    depthCents: 60,
    rateHz: 6,
  });
  assert.ok(planVoice(note([{ type: "palmMute" }]), 1).length < normal.length);
  assert.equal(planVoice(note([{ type: "deadNote" }]), 1).dead, true);
});

function mockAudio(context) {
  const previous = {
    AudioContext: globalThis.AudioContext,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const oscillators = [];
  const buffers = [];
  const parameter = () => ({
    value: 0,
    calls: [],
    setValueAtTime(value, time) {
      this.calls.push(["set", value, time]);
    },
    exponentialRampToValueAtTime(value, time) {
      this.calls.push(["ramp", value, time]);
    },
    linearRampToValueAtTime(value, time) {
      this.calls.push(["linear", value, time]);
    },
  });
  const node = () => ({
    connections: [],
    connect(target) {
      this.connections.push(target);
      return target;
    },
    disconnect() {},
  });
  let frame;
  let grant;
  let held = false;
  let stops = 0;
  const steps = [];
  const audio = {
    state: "running",
    currentTime: 10,
    sampleRate: 48000,
    destination: {},
    async resume() {
      if (held)
        await new Promise((resolve) => {
          grant = resolve;
        });
    },
    async close() {
      this.state = "closed";
    },
    createGain() {
      return { ...node(), gain: parameter() };
    },
    createBiquadFilter() {
      return { ...node(), frequency: parameter() };
    },
    createPeriodicWave(real, imaginary) {
      return { real, imaginary };
    },
    createOscillator() {
      const result = {
        ...node(),
        frequency: parameter(),
        detune: parameter(),
        setPeriodicWave(wave) {
          this.wave = wave;
        },
        start(time) {
          this.startTime = time;
        },
        stop(time) {
          this.stopTime = time;
        },
      };
      oscillators.push(result);
      return result;
    },
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    },
    createBufferSource() {
      const result = {
        ...node(),
        playbackRate: parameter(),
        detune: parameter(),
        start(time) {
          this.startTime = time;
        },
        stop(time) {
          this.stopTime = time;
        },
      };
      buffers.push(result);
      return result;
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
  const player = new ScorePlayer({
    onStep: (id) => steps.push(id),
    onStop: () => stops++,
    loadSamples: async (context, notes) =>
      new Map(
        notes.map((note) => [
          sampleMidi(note.midi),
          { midi: sampleMidi(note.midi), buffer: { guitar: true } },
        ]),
      ),
  });
  context.after(() => {
    player.stop();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  });
  return {
    audio,
    player,
    oscillators,
    buffers,
    steps,
    stops: () => stops,
    tick: () => frame(),
    hold: () => {
      held = true;
    },
    release: () => grant(),
  };
}

function scoreFixture() {
  const score = createEmptyScore(120);
  score.events = [
    {
      id: "chord",
      durationTicks: 960,
      notes: [
        { string: 1, fret: 5, techniques: [{ type: "bend", semitones: 2 }] },
        {
          string: 2,
          fret: 5,
          techniques: [{ type: "vibrato", depthCents: 30, rateHz: 5 }],
        },
      ],
    },
    { id: "rest", durationTicks: 960, notes: [] },
    {
      id: "dead",
      durationTicks: 960,
      notes: [{ string: 6, fret: 0, techniques: [{ type: "deadNote" }] }],
    },
  ];
  return score;
}

test("Akor aynı saatte başlar, vibrato perdeye bağlanır ve sus yeni ses oluşturmaz", async (context) => {
  const mocked = mockAudio(context);
  await mocked.player.play(scoreFixture());
  const voices = mocked.buffers.filter((source) => source.buffer.guitar);
  assert.equal(voices.length, 2);
  assert.equal(voices[0].startTime, 10.08);
  assert.equal(voices[1].startTime, voices[0].startTime);
  assert.ok(voices[0].playbackRate.calls.some(([kind]) => kind === "ramp"));
  const lfo = mocked.oscillators[0];
  assert.equal(lfo.frequency.value, 5);
  assert.equal(lfo.connections[0].connections[0], voices[1].detune);
  assert.equal(mocked.buffers.length, 3);
  assert.equal(mocked.buffers[2].startTime, 11.08);
  mocked.audio.currentTime = 10.7;
  mocked.tick();
  assert.deepEqual(mocked.steps, ["rest"]);
  mocked.audio.currentTime = 12;
  mocked.tick();
  assert.equal(mocked.audio.state, "closed");
  assert.equal(mocked.stops(), 1);
});

test("Hazırlık sırasında durdurulan akor sonradan çalmaya başlamaz", async (context) => {
  const mocked = mockAudio(context);
  mocked.hold();
  const pending = mocked.player.play(scoreFixture());
  mocked.player.stop();
  mocked.release();
  await pending;
  assert.equal(mocked.oscillators.length, 0);
  assert.equal(mocked.buffers.length, 0);
  assert.equal(mocked.audio.state, "closed");
  assert.equal(mocked.stops(), 1);
});

test("Örnek yüklenirken durdurmak isteği iptal eder ve geç gelen sesleri çalmaz", async (context) => {
  const mocked = mockAudio(context);
  const entered = Promise.withResolvers();
  const held = Promise.withResolvers();
  let signal;
  mocked.player.loadSamples = async (
    _context,
    _notes,
    _tone,
    pendingSignal,
  ) => {
    signal = pendingSignal;
    entered.resolve();
    await held.promise;
    return new Map();
  };
  const pending = mocked.player.play(scoreFixture(), "acoustic");
  await entered.promise;
  mocked.player.stop();
  assert.equal(signal.aborted, true);
  held.resolve();
  await pending;
  assert.equal(mocked.buffers.length, 0);
  assert.equal(mocked.audio.state, "closed");
});

test("Örnek yükleme hatası çalmayı durdurur ve ses kaynaklarını kapatır", async (context) => {
  const mocked = mockAudio(context);
  mocked.player.loadSamples = async () => {
    throw new Error("Sample unavailable");
  };
  await assert.rejects(
    mocked.player.play(scoreFixture()),
    /Sample unavailable/,
  );
  assert.equal(mocked.player.playing, false);
  assert.equal(mocked.audio.state, "closed");
  assert.equal(mocked.stops(), 1);
});
