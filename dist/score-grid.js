import { splitMeasures, noteLabel, midiLabel } from "./score-notation.js";
import { t } from "./preferences.js";

const durations = {
  120: "1/32",
  240: "1/16",
  320: "1/8×3",
  480: "1/8",
  640: "1/4×3",
  720: "1/8·",
  960: "1/4",
  1440: "1/4·",
  1920: "1/2",
  3840: "1/1",
};

export function renderScoreGrid(container, score, state) {
  container.replaceChildren();
  const measures = splitMeasures(score);
  const makeButton = (label, id, string, aria) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.event = id;
    if (string) button.dataset.string = string;
    button.disabled =
      state.disabled || (id === "new" && score.events.length >= 128);
    button.setAttribute("aria-label", aria);
    button.classList.toggle("step-playing", state.active === id);
    return button;
  };
  measures.forEach((measure, measureIndex) => {
    const box = document.createElement("div");
    box.className = "score-measure";
    const title = document.createElement("p");
    title.className = "measure-title";
    title.textContent = t("Ölçü {number} · {meter}", {
      number: measure.index + 1,
      meter: `${score.meter.beats}/${score.meter.unit}`,
    });
    box.append(title);
    const table = document.createElement("table");
    table.className = "score-table";
    const header = document.createElement("tr");
    const blank = document.createElement("th");
    blank.textContent = "TAB";
    header.append(blank);
    measure.segments.forEach((segment) => {
      const th = document.createElement("th");
      const duration = segment.continuation
        ? "↝"
        : (durations[score.events[segment.eventIndex].durationTicks] ??
          `${score.events[segment.eventIndex].durationTicks}/960`);
      th.append(
        makeButton(
          `${segment.eventIndex + 1} · ${duration}`,
          segment.id,
          null,
          t("{step}. adımı düzenle", { step: segment.eventIndex + 1 }),
        ),
      );
      header.append(th);
    });
    const lastMeasure = measureIndex === measures.length - 1;
    if (lastMeasure) {
      const th = document.createElement("th");
      th.textContent = "+";
      header.append(th);
    }
    table.append(header);
    ["e", "B", "G", "D", "A", "E"].forEach((name, row) => {
      const tr = document.createElement("tr");
      const label = document.createElement("th");
      label.textContent = `${row + 1} ${midiLabel(score.tuning[row])}`;
      label.scope = "row";
      tr.append(label);
      measure.segments.forEach((segment) => {
        const note = segment.notes.find((note) => note.string === row + 1);
        const td = document.createElement("td");
        td.style.minWidth = `${Math.max(66, Math.min(200, (segment.durationTicks / 960) * 90))}px`;
        const text = segment.continuation
          ? note
            ? "↝"
            : "—"
          : noteLabel(note);
        const button = makeButton(
          text,
          segment.id,
          row + 1,
          t("{step}. adım, {string}. tel, perde {fret}", {
            step: segment.eventIndex + 1,
            string: row + 1,
            fret: noteLabel(note),
          }),
        );
        button.classList.toggle(
          "voice-selected",
          state.selected === segment.id && String(row + 1) === state.string,
        );
        button.className += " score-cell";
        td.append(button);
        tr.append(td);
      });
      if (lastMeasure) {
        const td = document.createElement("td");
        const button = makeButton(
          "+",
          "new",
          row + 1,
          t("{string}. tele yeni nota ekle", { string: row + 1 }),
        );
        button.className = "score-cell add-cell";
        td.append(button);
        tr.append(td);
      }
      table.append(tr);
    });
    box.append(table);
    container.append(box);
  });
}
