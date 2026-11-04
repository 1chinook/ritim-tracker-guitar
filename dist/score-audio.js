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
    cutoff: dead ? 900 : muted ? 650 : 10000,
    vibrato: has("vibrato") ?? null,
  };
}

export function scheduleVoice(
  context,
  note,
  duration,
  start,
  chordSize,
  sample,
) {
  const plan = planVoice(note, duration);
  if (!plan.dead && !sample) throw new Error("Missing guitar sample");
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(plan.cutoff, start);
  const volume = 0.65 / Math.sqrt(chordSize);
  const attack = Math.min(0.004, plan.length / 4);
  const release = Math.min(0.035, plan.length / 3);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.setValueAtTime(volume, start + plan.length - release);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + plan.length);
  filter.connect(gain).connect(context.destination);
  const source = context.createBufferSource();
  let vibrato;
  let depth;
  if (plan.dead) {
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * 0.08),
      context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index++)
      data[index] = Math.random() * 2 - 1;
    source.buffer = buffer;
  } else {
    source.buffer = sample.buffer;
    const rootFrequency = midiToFrequency(sample.midi);
    // Kayıt yeniden örneklenirken bend ve geçişler aynı ses üzerinde uygulanır.
    for (const point of plan.pitch) {
      const rate = point.frequency / rootFrequency;
      if (point.ramp)
        source.playbackRate.exponentialRampToValueAtTime(
          rate,
          start + point.time,
        );
      else source.playbackRate.setValueAtTime(rate, start + point.time);
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
