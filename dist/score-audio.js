import { midiToFrequency } from "./pitch.js";

export function planVoice(note, duration) {
  const effects = note.techniques;
  const has = (type) => effects.find((effect) => effect.type === type);
  const dead = Boolean(has("deadNote"));
  const muted = Boolean(has("palmMute"));
  const length = dead
    ? Math.min(0.07, duration * 0.8)
    : muted
      ? Math.min(0.16, duration * 0.8)
      : duration * 0.96;
  const pitch = [{ time: 0, frequency: note.frequency, ramp: false }];
  const bend = has("bend");
  if (bend)
    pitch.push({
      time: length * 0.7,
      frequency: note.frequency * 2 ** (bend.semitones / 12),
      ramp: true,
    });
  const transition = effects.find((effect) =>
    ["slide", "hammerOn", "pullOff"].includes(effect.type),
  );
  if (transition) {
    const frequency = midiToFrequency(
      note.midi + transition.targetFret - note.fret,
    );
    if (transition.type === "slide")
      pitch.push({ time: length * 0.8, frequency, ramp: true });
    else pitch.push({ time: length * 0.5, frequency, ramp: false });
  }
  return {
    pitch,
    length,
    dead,
    cutoff: muted ? 650 : 3600,
    vibrato: has("vibrato") ?? null,
  };
}

export function scheduleVoice(context, note, duration, start, chordSize) {
  const plan = planVoice(note, duration);
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(plan.cutoff, start);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(250, plan.cutoff * 0.35),
    start + plan.length,
  );
  const volume = 0.22 / Math.sqrt(chordSize);
  const attack = Math.min(0.006, plan.length / 4);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + plan.length);
  filter.connect(gain).connect(context.destination);
  let source;
  let vibrato;
  let depth;
  if (plan.dead) {
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * 0.08),
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++)
      samples[index] = Math.random() * 2 - 1;
    source = context.createBufferSource();
    source.buffer = buffer;
  } else {
    source = context.createOscillator();
    // Zamanla süzülen harmonikler koparılan tel için hafif bir sentetik önizleme verir.
    const real = new Float32Array(16);
    const imaginary = Float32Array.from({ length: 16 }, (_, index) =>
      index ? 1 / index ** 1.6 : 0,
    );
    source.setPeriodicWave(context.createPeriodicWave(real, imaginary));
    for (const point of plan.pitch) {
      if (point.ramp)
        source.frequency.exponentialRampToValueAtTime(
          point.frequency,
          start + point.time,
        );
      else source.frequency.setValueAtTime(point.frequency, start + point.time);
    }
    if (plan.vibrato) {
      vibrato = context.createOscillator();
      depth = context.createGain();
      vibrato.frequency.value = plan.vibrato.rateHz;
      depth.gain.setValueAtTime(0, start);
      depth.gain.linearRampToValueAtTime(
        plan.vibrato.depthCents,
        start + plan.length * 0.25,
      );
      vibrato.connect(depth).connect(source.detune);
      vibrato.start(start);
      vibrato.stop(start + plan.length + 0.01);
    }
  }
  source.connect(filter);
  source.start(start);
  source.stop(start + plan.length + 0.01);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    vibrato?.disconnect();
    depth?.disconnect();
  };
}
