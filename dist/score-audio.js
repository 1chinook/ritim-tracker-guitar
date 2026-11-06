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
  const harmonic = has("harmonic");
  let semitones = 0;
  if (harmonic?.kind === "natural")
    semitones = { 5: 24, 7: 19, 12: 12, 19: 19, 24: 24 }[note.fret] - note.fret;
  if (harmonic?.kind === "artificial") semitones = 12;
  const frequency = note.frequency * 2 ** (semitones / 12);
  const pitch = [{ time: 0, frequency, ramp: false }];
  const bend = has("bend");
  if (bend?.curve) {
    pitch.length = 0;
    for (const point of bend.curve)
      pitch.push({
        time: point.position * length,
        frequency: frequency * 2 ** (point.semitones / 12),
        ramp: point.position !== 0,
      });
  } else if (bend)
    pitch.push({
      time: length * 0.7,
      frequency: frequency * 2 ** (bend.semitones / 12),
      ramp: true,
    });
  const transition = effects.find((effect) =>
    ["slide", "hammerOn", "pullOff"].includes(effect.type),
  );
  if (transition) {
    const frequency = midiToFrequency(
      note.midi + semitones + transition.targetFret - note.fret,
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
    tapping: Boolean(has("tapping")),
    harmonic: Boolean(harmonic),
  };
}

function scheduleSingleVoice(
  context,
  note,
  duration,
  start,
  chordSize,
  sample,
  plan = planVoice(note, duration),
) {
  if (!plan.dead && !sample) throw new Error("Missing guitar sample");
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(plan.cutoff, start);
  for (const point of plan.filters ?? [])
    filter.frequency.setValueAtTime(point.cutoff, start + point.time);
  const volume = (plan.tapping ? 0.48 : 0.65) / Math.sqrt(chordSize);
  const attack = Math.min(plan.tapping ? 0.001 : 0.004, plan.length / 4);
  const release = Math.min(0.035, plan.length / 3);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.setValueAtTime(volume, start + plan.length - release);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + plan.length);
  filter.connect(gain).connect(context.destination);
  const source = context.createBufferSource();
  const modulation = [];
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
    const vibratos =
      plan.vibratos ??
      (plan.vibrato
        ? [{ offset: 0, length: plan.length, effect: plan.vibrato }]
        : []);
    for (const item of vibratos) {
      const vibrato = context.createOscillator();
      const depth = context.createGain();
      vibrato.frequency.value = item.effect.rateHz;
      depth.gain.setValueAtTime(0, start + item.offset);
      depth.gain.linearRampToValueAtTime(
        item.effect.depthCents,
        start + item.offset + item.length * 0.25,
      );
      vibrato.connect(depth).connect(source.detune);
      vibrato.start(start + item.offset);
      vibrato.stop(start + item.offset + item.length);
      modulation.push(vibrato, depth);
    }
  }
  source.connect(filter);
  source.start(start);
  source.stop(start + plan.length + 0.01);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    for (const node of modulation) node.disconnect();
  };
}

function frequencyAt(points, time) {
  let previous = points[0];
  for (const point of points.slice(1)) {
    if (point.time > time) {
      if (!point.ramp) return previous.frequency;
      const ratio = (time - previous.time) / (point.time - previous.time);
      return (
        previous.frequency * (point.frequency / previous.frequency) ** ratio
      );
    }
    previous = point;
  }
  return previous.frequency;
}

export function scheduleVoice(
  context,
  note,
  duration,
  start,
  chordSize,
  sample,
) {
  const segments = note.segments ?? [{ note, duration, offset: 0 }];
  const plan = planVoice(note, duration);
  plan.pitch = segments.flatMap((segment) =>
    planVoice(segment.note, segment.duration).pitch.map((point) => ({
      ...point,
      time: point.time + segment.offset,
    })),
  );
  plan.vibratos = segments.flatMap((segment) => {
    const part = planVoice(segment.note, segment.duration);
    return part.vibrato
      ? [{ offset: segment.offset, length: part.length, effect: part.vibrato }]
      : [];
  });
  plan.filters = segments.map((segment) => ({
    time: segment.offset,
    cutoff: planVoice(segment.note, segment.duration).cutoff,
  }));
  const last = segments.at(-1);
  plan.length = last.offset + planVoice(last.note, last.duration).length;
  const tremolo = note.techniques.find(
    (effect) => effect.type === "tremoloPicking",
  );
  if (!tremolo) {
    scheduleSingleVoice(
      context,
      note,
      duration,
      start,
      chordSize,
      sample,
      plan,
    );
    return;
  }
  const interval = ((60 / (note.bpm ?? 90)) * 4) / tremolo.subdivision;
  const attackDuration = note.attackDuration ?? duration;
  const rings = note.techniques.some((effect) => effect.type === "letRing");
  for (let offset = 0; offset < attackDuration; offset += interval) {
    const length =
      rings && offset + interval >= attackDuration
        ? duration - offset
        : Math.min(interval * 0.92, attackDuration - offset);
    const pitch = [
      { time: 0, frequency: frequencyAt(plan.pitch, offset), ramp: false },
      ...plan.pitch
        .filter((point) => point.time > offset && point.time < offset + length)
        .map((point) => ({ ...point, time: point.time - offset })),
      {
        time: length,
        frequency: frequencyAt(plan.pitch, offset + length),
        ramp: true,
      },
    ];
    scheduleSingleVoice(
      context,
      note,
      length,
      start + offset,
      chordSize,
      sample,
      {
        ...plan,
        length,
        pitch,
        filters: [{ time: 0, cutoff: plan.cutoff }],
        vibratos: plan.vibratos
          .filter(
            (item) =>
              item.offset < offset + length &&
              item.offset + item.length > offset,
          )
          .map((item) => ({
            ...item,
            offset: Math.max(0, item.offset - offset),
            length:
              Math.min(item.offset + item.length, offset + length) -
              Math.max(item.offset, offset),
          })),
      },
    );
  }
}
