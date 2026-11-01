import test from "node:test";
import assert from "node:assert/strict";
import {
  detectPitch,
  describePitch,
  guitarStrings,
  midiToFrequency,
} from "../dist/pitch.js";

function signal(
  frequency,
  sampleRate,
  { harmonics = false, amplitude = 0.3 } = {},
) {
  return Float32Array.from({ length: 8192 }, (_, index) => {
    const phase = (2 * Math.PI * frequency * index) / sampleRate;
    return (
      amplitude *
      (harmonics
        ? Math.sin(phase) * 0.4 +
          Math.sin(phase * 2) * 0.7 +
          Math.sin(phase * 3) * 0.25
        : Math.sin(phase))
    );
  });
}

for (const sampleRate of [44100, 48000]) {
  for (const string of guitarStrings) {
    test(`${sampleRate} Hz örneklemede ${string.note} açık telini tanır`, () => {
      const frequency = midiToFrequency(string.midi);
      const result = detectPitch(signal(frequency, sampleRate), sampleRate);
      assert.ok(result, "Nota algılanmalı");
      assert.ok(Math.abs(1200 * Math.log2(result.frequency / frequency)) < 3);
      assert.equal(describePitch(result.frequency).target.note, string.note);
      assert.ok(result.confidence > 0.9);
    });
  }
}

test("Pes ve tiz yönünü cent cinsinden hesaplar", () => {
  for (const cents of [-35, 0, 28]) {
    const frequency = 110 * 2 ** (cents / 1200);
    const pitch = describePitch(
      detectPitch(signal(frequency, 48000), 48000).frequency,
      45,
    );
    assert.ok(Math.abs(pitch.cents - cents) < 3);
    assert.equal(pitch.target.note, "A2");
  }
});

test("Güçlü ikinci harmonikte temel E2 periyodunu korur", () => {
  const frequency = midiToFrequency(40);
  const result = detectPitch(
    signal(frequency, 48000, { harmonics: true }),
    48000,
  );
  assert.ok(result);
  assert.ok(Math.abs(1200 * Math.log2(result.frequency / frequency)) < 5);
});

test("Manuel tel hedefini en yakın başka tele değiştirmez", () => {
  const result = describePitch(110, 40);
  assert.equal(result.note, "A2");
  assert.equal(result.target.note, "E2");
  assert.ok(Math.abs(result.cents - 500) < 0.01);
});

test("Sessizlik, sabit ofset ve düşük seviyeli ses için nota üretmez", () => {
  assert.equal(detectPitch(new Float32Array(8192), 48000), null);
  assert.equal(detectPitch(new Float32Array(8192).fill(0.3), 48000), null);
  assert.equal(
    detectPitch(signal(110, 48000, { amplitude: 0.001 }), 48000),
    null,
  );
});

test("Periyodik olmayan gürültüde nota üretmez", () => {
  let seed = 12345;
  const noise = Float32Array.from({ length: 8192 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 2 ** 32 - 0.5) * 0.5;
  });
  assert.equal(detectPitch(noise, 48000), null);
});

test("Geçersiz frekanslar ve kısa örnekler reddedilir", () => {
  assert.equal(describePitch(0), null);
  assert.equal(describePitch(NaN), null);
  assert.equal(detectPitch(new Float32Array(100), 48000), null);
});
