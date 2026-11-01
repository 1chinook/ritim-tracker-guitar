import { guitarStrings, midiToFrequency } from "./pitch.js";

export const noteDurations = [0.25, 0.5, 1, 2, 4];
export const maximumNotes = 128;

export function validateNotes(notes) {
  if (!Array.isArray(notes) || notes.length > maximumNotes)
    throw new Error("Geçersiz egzersiz");
  return notes.map((note) => {
    if (!note || !noteDurations.includes(note.beats))
      throw new Error("Geçersiz süre");
    if (note.string === null && note.fret === null)
      return { string: null, fret: null, beats: note.beats };
    if (
      !Number.isInteger(note.string) ||
      note.string < 1 ||
      note.string > 6 ||
      !Number.isInteger(note.fret) ||
      note.fret < 0 ||
      note.fret > 24
    )
      throw new Error("Geçersiz tel veya perde");
    return { string: note.string, fret: note.fret, beats: note.beats };
  });
}

export function createTimeline(notes, bpm) {
  if (!Number.isFinite(bpm) || bpm < 30 || bpm > 240)
    throw new Error("Geçersiz BPM");
  let start = 0;
  return validateNotes(notes).map((note, index) => {
    const duration = (note.beats * 60) / bpm;
    const openString = guitarStrings.find(
      (string) => string.number === note.string,
    );
    const event = {
      ...note,
      index,
      start,
      duration,
      frequency: openString
        ? midiToFrequency(openString.midi + note.fret)
        : null,
    };
    start += duration;
    return event;
  });
}

export function exportTextTab(notes) {
  const validated = validateNotes(notes);
  const rows = ["e", "B", "G", "D", "A", "E"].map((name, index) => {
    const columns = validated.map((note) =>
      note.string === index + 1 ? String(note.fret).padStart(2, "-") : "--",
    );
    return `${name}|${columns.join("-")}|`;
  });
  return [
    ...rows,
    "",
    `Beats: ${validated.map((note) => note.beats).join(" / ")}`,
  ].join("\n");
}
