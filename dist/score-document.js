import { validateNotes, maximumNotes } from "./tab-model.js";

export const scoreFormat = "ritim-score";
export const ticksPerBeat = 960;
export const standardTuning = [64, 59, 55, 50, 45, 40];

export class ScoreValidationError extends Error {
  constructor(path, reason) {
    super(`${path}: ${reason}`);
    this.name = "ScoreValidationError";
  }
}

function requireValue(condition, path, reason) {
  if (!condition) throw new ScoreValidationError(path, reason);
}

function checkFields(value, allowed, path) {
  requireValue(
    value && typeof value === "object" && !Array.isArray(value),
    path,
    "Expected an object",
  );
  for (const field of Object.keys(value)) {
    requireValue(
      allowed.includes(field),
      `${path}.${field}`,
      "Unsupported field; refusing to discard data",
    );
  }
}

function integerInRange(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function validateTechnique(effect, fret, path) {
  const fields = {
    vibrato: ["type", "depthCents", "rateHz"],
    bend: ["type", "semitones"],
    slide: ["type", "targetFret"],
    hammerOn: ["type", "targetFret"],
    pullOff: ["type", "targetFret"],
    palmMute: ["type"],
    deadNote: ["type"],
  };
  requireValue(Object.hasOwn(fields, effect?.type), path, "Unknown technique");
  checkFields(effect, fields[effect.type], path);
  if (effect.type === "vibrato") {
    const depthCents = effect.depthCents ?? 30;
    const rateHz = effect.rateHz ?? 5;
    requireValue(
      Number.isFinite(depthCents) && depthCents >= 5 && depthCents <= 200,
      path,
      "Vibrato depth must be 5–200 cents",
    );
    requireValue(
      Number.isFinite(rateHz) && rateHz >= 1 && rateHz <= 12,
      path,
      "Vibrato rate must be 1–12 Hz",
    );
    return { type: "vibrato", depthCents, rateHz };
  }
  if (effect.type === "bend") {
    requireValue(
      Number.isFinite(effect.semitones) &&
        effect.semitones > 0 &&
        effect.semitones <= 4,
      path,
      "Bend must be greater than 0 and at most 4 semitones",
    );
    return { type: "bend", semitones: effect.semitones };
  }
  if (["slide", "hammerOn", "pullOff"].includes(effect.type)) {
    requireValue(
      integerInRange(effect.targetFret, 0, 24),
      path,
      "Target fret must be 0–24",
    );
    const directionIsValid =
      effect.type === "hammerOn"
        ? effect.targetFret > fret
        : effect.type === "pullOff"
          ? effect.targetFret < fret
          : effect.targetFret !== fret;
    requireValue(
      directionIsValid,
      path,
      "Technique target has an invalid direction",
    );
    return { type: effect.type, targetFret: effect.targetFret };
  }
  return { type: effect.type };
}

function validateVoice(voice, path) {
  checkFields(voice, ["string", "fret", "techniques"], path);
  requireValue(integerInRange(voice.string, 1, 6), path, "String must be 1–6");
  requireValue(integerInRange(voice.fret, 0, 24), path, "Fret must be 0–24");
  const effects = voice.techniques ?? [];
  requireValue(
    Array.isArray(effects) && effects.length <= 7,
    path,
    "Invalid technique list",
  );
  const techniques = effects.map((effect, index) =>
    validateTechnique(effect, voice.fret, `${path}.techniques[${index}]`),
  );
  const types = techniques.map((effect) => effect.type);
  requireValue(
    !types.includes("bend") ||
      !types.some((type) => ["slide", "hammerOn", "pullOff"].includes(type)),
    path,
    "Choose bend or a target transition for one note",
  );
  requireValue(
    new Set(types).size === types.length,
    path,
    "Duplicate techniques",
  );
  requireValue(
    !types.includes("deadNote") || techniques.length === 1,
    path,
    "A dead note cannot also carry pitched techniques",
  );
  requireValue(
    types.filter((type) => ["slide", "hammerOn", "pullOff"].includes(type))
      .length <= 1,
    path,
    "Only one target transition is allowed per note",
  );
  return { string: voice.string, fret: voice.fret, techniques };
}

export function createEmptyScore(bpm = 90) {
  return validateScore({
    format: scoreFormat,
    version: 1,
    ppq: ticksPerBeat,
    bpm,
    meter: { beats: 4, unit: 4 },
    tuning: [...standardTuning],
    events: [],
  });
}

// Her doğrulama yeni nesneler döndürür; undo/redo ve kayıt aynı veriyi paylaşmaz.
export function validateScore(score) {
  checkFields(
    score,
    ["format", "version", "ppq", "bpm", "meter", "tuning", "events"],
    "score",
  );
  requireValue(
    score.format === scoreFormat && score.version === 1,
    "score",
    "Unsupported document format/version",
  );
  requireValue(
    score.ppq === ticksPerBeat,
    "score.ppq",
    "Unsupported timing resolution",
  );
  requireValue(
    Number.isFinite(score.bpm) && score.bpm >= 30 && score.bpm <= 240,
    "score.bpm",
    "BPM must be 30–240",
  );
  checkFields(score.meter, ["beats", "unit"], "score.meter");
  requireValue(
    integerInRange(score.meter.beats, 1, 32) &&
      [2, 4, 8, 16].includes(score.meter.unit),
    "score.meter",
    "Unsupported time signature",
  );
  requireValue(
    Array.isArray(score.tuning) &&
      score.tuning.length === 6 &&
      score.tuning.every((midi) => integerInRange(midi, 0, 103)),
    "score.tuning",
    "Expected six open-string MIDI pitches in the range 0–103",
  );
  requireValue(
    Array.isArray(score.events) && score.events.length <= maximumNotes,
    "score.events",
    "Too many events",
  );
  const identifiers = new Set();
  const events = score.events.map((event, index) => {
    const path = `score.events[${index}]`;
    checkFields(event, ["id", "durationTicks", "notes"], path);
    requireValue(
      typeof event.id === "string" &&
        /^[a-zA-Z0-9_-]{1,64}$/.test(event.id) &&
        !identifiers.has(event.id),
      path,
      "Expected a unique event ID",
    );
    identifiers.add(event.id);
    requireValue(
      integerInRange(event.durationTicks, 1, ticksPerBeat * 16),
      path,
      "Invalid duration",
    );
    requireValue(
      Array.isArray(event.notes) && event.notes.length <= 6,
      path,
      "An event can have up to six notes",
    );
    const notes = event.notes.map((voice, voiceIndex) =>
      validateVoice(voice, `${path}.notes[${voiceIndex}]`),
    );
    requireValue(
      new Set(notes.map((voice) => voice.string)).size === notes.length,
      path,
      "A string cannot have two notes in one event",
    );
    return { id: event.id, durationTicks: event.durationTicks, notes };
  });
  const totalTicks = events.reduce(
    (sum, event) => sum + event.durationTicks,
    0,
  );
  const measureTicks =
    (score.meter.beats * ticksPerBeat * 4) / score.meter.unit;
  requireValue(
    Math.ceil(totalTicks / measureTicks) <= 512,
    "score.events",
    "At most 512 measures are supported",
  );
  return {
    format: scoreFormat,
    version: 1,
    ppq: ticksPerBeat,
    bpm: score.bpm,
    meter: { ...score.meter },
    tuning: [...score.tuning],
    events,
  };
}

export function migrateLegacyDraft(draft) {
  checkFields(draft, ["version", "bpm", "notes"], "draft");
  requireValue(
    draft.version === 1 && Array.isArray(draft.notes),
    "draft",
    "Unsupported legacy draft",
  );
  requireValue(Number.isFinite(draft.bpm), "draft.bpm", "Expected a BPM value");
  draft.notes.forEach((note, index) =>
    checkFields(note, ["string", "fret", "beats"], `draft.notes[${index}]`),
  );
  const notes = validateNotes(draft.notes);
  const score = createEmptyScore(draft.bpm);
  score.events = notes.map((note, index) => ({
    id: `step-${index + 1}`,
    durationTicks: note.beats * ticksPerBeat,
    notes:
      note.string === null
        ? []
        : [{ string: note.string, fret: note.fret, techniques: [] }],
  }));
  return validateScore(score);
}

export function serializeScore(score) {
  return JSON.stringify(validateScore(score), null, 2);
}

export function parseScore(text) {
  const value = JSON.parse(text);
  return value?.format === scoreFormat
    ? validateScore(value)
    : migrateLegacyDraft(value);
}
