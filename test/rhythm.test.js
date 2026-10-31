import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRhythm, AnalysisError } from "../dist/rhythm.js";

const sampleRate = 16000;

// Sönümlenen nota başlangıçları, bilinen bir zaman çizelgesine yerleştirilir.
function createPerformance(bpm, notesPerBeat = 1, irregular = false) {
  const samples = new Float32Array(sampleRate * 12);
  let time = 0.5;
  let note = 0;
  while (time < 11.5) {
    const start = Math.round(time * sampleRate);
    for (let offset = 0; offset < sampleRate * 0.07; offset++) {
      samples[start + offset] =
        Math.sin((offset * 2 * Math.PI * 220) / sampleRate) *
        Math.exp(-offset / (sampleRate * 0.018)) *
        0.7;
    }
    time +=
      (60 / bpm / notesPerBeat) * (irregular ? [0.7, 1.3, 1][note % 3] : 1);
    note++;
  }
  return samples;
}

for (const bpm of [60, 90, 120, 180]) {
  test(`${bpm} BPM eşit aralıklı notaları tanır`, () => {
    const result = analyzeRhythm(createPerformance(bpm), sampleRate, 90);
    assert.ok(Math.abs(result.estimatedBpm - bpm) < 3);
    assert.ok(result.consistencyScore > 95);
    assert.ok(result.intervalDeviationMs < 12);
  });
}

test("Sekizlik notaların temposunu vuruş sayısına göre hesaplar", () => {
  const result = analyzeRhythm(createPerformance(90, 2), sampleRate, 90, 2);
  assert.ok(Math.abs(result.estimatedBpm - 90) < 3);
});

test("Tutarlılık puanı hedef BPM değiştiğinde değişmez", () => {
  const samples = createPerformance(120);
  const slowTarget = analyzeRhythm(samples, sampleRate, 60);
  const fastTarget = analyzeRhythm(samples, sampleRate, 180);
  assert.equal(slowTarget.consistencyScore, fastTarget.consistencyScore);
});

test("Düzensiz notalar daha düşük tutarlılık puanı alır", () => {
  const regular = analyzeRhythm(createPerformance(90), sampleRate, 90);
  const irregular = analyzeRhythm(
    createPerformance(90, 1, true),
    sampleRate,
    90,
  );
  assert.ok(irregular.consistencyScore < regular.consistencyScore - 15);
});

test("Sessiz ses için puan üretmez", () => {
  assert.throws(
    () => analyzeRhythm(new Float32Array(sampleRate * 5), sampleRate, 90),
    /sessiz/,
  );
});

test("Sürekli bir ses yeterli nota başlangıcı sayılmaz", () => {
  const samples = Float32Array.from(
    { length: sampleRate * 5 },
    (_, index) => Math.sin((index * 2 * Math.PI * 220) / sampleRate) * 0.2,
  );
  assert.throws(() => analyzeRhythm(samples, sampleRate, 90), /Yeterli/);
});

test("Kısa kayıtlar ve geçersiz tempo reddedilir", () => {
  assert.throws(
    () => analyzeRhythm(new Float32Array(sampleRate), sampleRate, 90),
    AnalysisError,
  );
  assert.throws(
    () => analyzeRhythm(createPerformance(90), sampleRate, NaN),
    AnalysisError,
  );
});
