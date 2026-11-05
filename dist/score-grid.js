import { splitMeasures, noteLabel, midiLabel } from "./score-notation.js";
import { t } from "./preferences.js";
import { maximumNotes } from "./tab-model.js";

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
  const systems = [];
  let columns = 0;
  for (const measure of measures) {
    if (!systems.length || columns + measure.segments.length > 12) {
      systems.push([]);
      columns = 0;
    }
    systems.at(-1).push(measure);
    columns += measure.segments.length;
  }

  const makeButton = (label, id, string, aria) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.event = id;
    if (string) button.dataset.string = string;
    button.disabled =
      state.disabled || (id === "new" && score.events.length >= maximumNotes);
    button.setAttribute("aria-label", aria);
    button.classList.toggle("step-playing", state.active === id);
    return button;
  };
  systems.forEach((system, systemIndex) => {
    const isLastSystem = systemIndex === systems.length - 1;
    const segments = system.flatMap((measure) =>
      measure.segments.map((segment, index) => ({
        ...segment,
        startsMeasure: index === 0,
      })),
    );
    const box = document.createElement("div");
    box.className = "score-system";
    const table = document.createElement("table");
    table.className = "score-table";
    const bars = document.createElement("tr");
    bars.className = "score-bars";
    const meter = document.createElement("th");
    meter.textContent = `${score.meter.beats}/${score.meter.unit}`;
    bars.append(meter);
    for (const measure of system) {
      const title = document.createElement("th");
      title.textContent = String(measure.index + 1);
      title.title = t("Ölçü {number} · {meter}", {
        number: measure.index + 1,
        meter: meter.textContent,
      });
      title.colSpan =
        measure.segments.length +
        Number(isLastSystem && measure === system.at(-1));
      if (measure.segments.length) {
        const remove = document.createElement("button");
        const label = t("{number}. ölçüyü sil", { number: measure.index + 1 });
        remove.type = "button";
        remove.className = "remove-measure";
        remove.dataset.removeMeasure = String(measure.index);
        remove.textContent = "×";
        remove.title = label;
        remove.setAttribute("aria-label", label);
        remove.disabled = state.disabled;
        title.append(remove);
      }
      bars.append(title);
    }
    table.append(bars);

    const header = document.createElement("tr");
    const blank = document.createElement("th");
    blank.textContent = "TAB";
    header.append(blank);
    segments.forEach((segment) => {
      const th = document.createElement("th");
      th.classList.toggle("bar-start", segment.startsMeasure);
      const duration = segment.continuation
        ? "↝"
        : (durations[score.events[segment.eventIndex].durationTicks] ??
          `${score.events[segment.eventIndex].durationTicks}/960`);
      th.append(
        makeButton(
          segment.notes.length ? duration : `· ${duration}`,
          segment.id,
          null,
          t("{step}. adımı düzenle", { step: segment.eventIndex + 1 }),
        ),
      );
      header.append(th);
    });
    if (isLastSystem) {
      const th = document.createElement("th");
      th.textContent = "+";
      header.append(th);
    }
    table.append(header);
    score.tuning.forEach((midi, row) => {
      const tr = document.createElement("tr");
      const label = document.createElement("th");
      label.textContent = midiLabel(midi);
      label.scope = "row";
      tr.append(label);
      segments.forEach((segment) => {
        const note = segment.notes.find((note) => note.string === row + 1);
        const td = document.createElement("td");
        td.classList.toggle("bar-start", segment.startsMeasure);
        td.classList.toggle("cursor-column", state.selected === segment.id);
        const text = note ? (segment.continuation ? "↝" : noteLabel(note)) : "";
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
        if (note) {
          const mark = document.createElement("span");
          mark.className = "score-mark";
          mark.textContent = text;
          button.replaceChildren(mark);
        }
        td.append(button);
        tr.append(td);
      });
      if (isLastSystem) {
        const td = document.createElement("td");
        const button = makeButton(
          "+",
          "new",
          row + 1,
          t("{string}. tele yeni nota ekle", { string: row + 1 }),
        );
        button.className = "score-cell add-cell";
        td.classList.toggle("cursor-column", state.selected === null);
        button.classList.toggle(
          "voice-selected",
          state.selected === null && String(row + 1) === state.string,
        );
        td.append(button);
        tr.append(td);
      }
      table.append(tr);
    });
    box.append(table);
    container.append(box);
  });
}
