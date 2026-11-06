import { compileScore } from "./score-timeline.js";
import { validateScore } from "./score-document.js";

export function midiLabel(midi) {
  const names = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function noteLabel(note) {
  if (!note) return "—";
  let label = String(note.fret);
  for (const technique of note.techniques) {
    if (technique.type === "deadNote") return "×";
    if (technique.type === "vibrato") label += "~";
    if (technique.type === "bend") label += `↑${technique.semitones}`;
    if (technique.type === "slide")
      label += `${technique.targetFret > note.fret ? "/" : "\\"}${technique.targetFret}`;
    if (technique.type === "hammerOn") label += `h${technique.targetFret}`;
    if (technique.type === "pullOff") label += `p${technique.targetFret}`;
    if (technique.type === "palmMute") label += " PM";
    if (technique.type === "bend" && technique.curve?.at(-1).semitones === 0)
      label += "↘";
    if (technique.type === "letRing") label += " LR";
    if (technique.type === "harmonic")
      label = (technique.kind === "natural" ? "◇" : "◆") + label;
    if (technique.type === "tapping") label = "T" + label;
    if (technique.type === "tremoloPicking")
      label += " ≋" + technique.subdivision;
    if (technique.type === "pickDirection")
      label += technique.direction === "down" ? " ∏" : " ∨";
  }
  return label;
}

// Ölçü sınırındaki nota/sus görsel parçalara ayrılır; ses tekrar tetiklenmez.
export function splitMeasures(score) {
  const timeline = compileScore(score);
  const measures = [];
  timeline.events.forEach((event, eventIndex) => {
    let remaining = event.durationTicks;
    let position = event.startTicks;
    while (remaining > 0) {
      const measureIndex = Math.floor(position / timeline.measureTicks);
      const offset = position % timeline.measureTicks;
      const durationTicks = Math.min(remaining, timeline.measureTicks - offset);
      measures[measureIndex] ??= { index: measureIndex, segments: [] };
      measures[measureIndex].segments.push({
        eventIndex,
        id: event.id,
        notes: event.notes,
        durationTicks,
        continuation: position !== event.startTicks,
      });
      remaining -= durationTicks;
      position += durationTicks;
    }
  });
  if (!measures.length) measures.push({ index: 0, segments: [] });
  return measures;
}

export function exportScoreText(input) {
  const score = validateScore(input);
  const widths = score.events.map((event) =>
    Math.max(3, ...event.notes.map((note) => noteLabel(note).length + 2)),
  );
  const rows = ["e", "B", "G", "D", "A", "E"].map(
    (name, row) =>
      `${name}|${score.events.map((event, index) => noteLabel(event.notes.find((note) => note.string === row + 1)).padStart(widths[index], "-")).join("|")}|`,
  );
  return [
    `BPM: ${score.bpm} | Meter: ${score.meter.beats}/${score.meter.unit}`,
    ...rows,
    `Ticks (${score.ppq}/quarter): ${score.events.map((event) => event.durationTicks).join(" / ")}`,
    "~ vibrato | ↑ bend | / \\ slide | h hammer-on | p pull-off | PM palm mute | × dead note",
  ].join("\n");
}
