import {
  guitarTunings,
  matchingTuning,
  parseTuning,
} from "./guitar-tunings.js";
import { midiLabel } from "./score-notation.js";
export function initializeTuningControls({ find, apply, report }) {
  const preset = find("editorTuning");
  const notes = find("editorTuningNotes");
  const button = find("editorApplyTuning");
  let lastTuning = "";
  preset.addEventListener("change", () => {
    const selected = guitarTunings.find((item) => item.id === preset.value);
    if (selected) notes.value = selected.notes.map(midiLabel).join(" ");
  });
  button.addEventListener("click", () => {
    try {
      apply(parseTuning(notes.value));
    } catch (error) {
      report(error.message);
    }
  });
  return {
    sync(tuning, disabled) {
      const key = tuning.join(",");
      if (key !== lastTuning) {
        lastTuning = key;
        preset.value = matchingTuning(tuning);
        notes.value = tuning.map(midiLabel).join(" ");
      }
      for (const control of [preset, notes, button])
        control.disabled = disabled;
    },
  };
}
