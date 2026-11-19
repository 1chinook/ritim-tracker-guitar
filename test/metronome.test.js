import test from "node:test";
import assert from "node:assert/strict";
import { Metronome } from "../dist/audio.js";

test("Durdurma geri sayımı bekletmeden sonlandırır ve kalan vuruşları çalmaz", async () => {
  const metronome = new Metronome();
  let ticks = 0;
  const beats = [];
  metronome.prepare = async () => {};
  metronome.tick = () => ticks++;
  const counting = metronome.countIn(30, (value) => beats.push(value));
  await Promise.resolve();
  assert.deepEqual(beats, [4]);
  metronome.stop();
  assert.equal(await counting, false);
  assert.equal(ticks, 1);
});
test("Ses izni beklerken durdurulan metronom sonradan başlamaz", async () => {
  const metronome = new Metronome();
  let grant,
    ticks = 0;
  metronome.prepare = () =>
    new Promise((resolve) => {
      grant = resolve;
    });
  metronome.tick = () => ticks++;
  const starting = metronome.start(90);
  metronome.stop();
  grant();
  await starting;
  assert.equal(ticks, 0);
  assert.equal(metronome.isPlaying, false);
});
