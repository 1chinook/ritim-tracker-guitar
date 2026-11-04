import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGuitarSamples, sampleMidi } from "../dist/guitar-samples.js";

test("Her perde en yakın yerel örneğe yönlenir ve iki ses bankası eksiksizdir", () => {
  for (let midi = 0; midi <= 127; midi++) {
    const root = sampleMidi(midi);
    assert.ok(root >= 40 && root <= 88 && (root - 40) % 3 === 0);
    if (midi >= 40 && midi <= 88) assert.ok(Math.abs(root - midi) <= 1);
  }
  for (const tone of ["distortion", "acoustic"]) {
    for (let root = 40; root <= 88; root += 3) {
      const bytes = readFileSync(
        new URL(`../dist/sounds/${tone}/${root}.mp3`, import.meta.url),
      );
      assert.ok(bytes.length > 1000, `${tone}/${root}`);
      assert.ok(
        bytes.subarray(0, 3).toString() === "ID3" ||
          (bytes[0] === 255 && (bytes[1] & 224) === 224),
      );
    }
  }
});

test("Tekrarlanan notalar bir kez yüklenir, ölü nota örnek istemez ve hata tekrar denenebilir", async (t) => {
  const previousFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previousFetch;
  });
  const requests = [];
  let fail = true;
  globalThis.fetch = async (url) => {
    requests.push(url.href);
    return {
      ok: !fail,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    };
  };
  const decoded = [];
  const audio = {
    decodeAudioData: async (bytes) => {
      decoded.push(bytes);
      return { duration: 2 };
    },
  };
  const notes = [
    { midi: 70, techniques: [] },
    { midi: 71, techniques: [] },
    { midi: 40, techniques: [{ type: "deadNote" }] },
  ];
  await assert.rejects(loadGuitarSamples(audio, notes, "distortion"));
  fail = false;
  const samples = await loadGuitarSamples(audio, notes, "distortion");
  assert.equal(requests.length, 2);
  assert.equal(samples.size, 1);
  assert.equal(decoded.length, 1);
  await loadGuitarSamples(audio, notes, "distortion");
  assert.equal(
    requests.length,
    2,
    "Örnek baytları sonraki oynatmada yeniden indirilmemeli",
  );
  await assert.rejects(loadGuitarSamples(audio, notes, "unknown"));
});
