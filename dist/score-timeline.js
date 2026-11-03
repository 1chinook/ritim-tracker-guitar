import { validateScore, ticksPerBeat } from "./score-document.js";
import { midiToFrequency } from "./pitch.js";

// Arayüz ve ses motoru aynı zaman çizelgesini tüketebilecek.
// Teknikler taşınır ama bu aşamada sese uygulanmaz.
export function compileScore(input) {
  const score = validateScore(input);
  const secondsPerTick = 60 / score.bpm / ticksPerBeat;
  const measureTicks =
    (score.meter.beats * ticksPerBeat * 4) / score.meter.unit;
  let positionTicks = 0;
  const events = score.events.map((event) => {
    const compiled = {
      id: event.id,
      startTicks: positionTicks,
      durationTicks: event.durationTicks,
      start: positionTicks * secondsPerTick,
      duration: event.durationTicks * secondsPerTick,
      measureIndex: Math.floor(positionTicks / measureTicks),
      offsetInMeasure: positionTicks % measureTicks,
      notes: event.notes.map((note) => ({
        ...note,
        midi: score.tuning[note.string - 1] + note.fret,
        frequency: midiToFrequency(score.tuning[note.string - 1] + note.fret),
      })),
    };
    positionTicks += event.durationTicks;
    return compiled;
  });
  return {
    bpm: score.bpm,
    measureTicks,
    totalTicks: positionTicks,
    duration: positionTicks * secondsPerTick,
    events,
  };
}
