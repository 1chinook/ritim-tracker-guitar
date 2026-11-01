import {
  validateNotes,
  createTimeline,
  exportTextTab,
  maximumNotes,
} from "./tab-model.js";
import { TabPlayer } from "./tab-player.js";
import { setText, t } from "./preferences.js";

const storageKey = "ritim-tab-draft-v1";
const example = [
  { string: 6, fret: 0, beats: 1 },
  { string: 6, fret: 3, beats: 0.5 },
  { string: 5, fret: 0, beats: 0.5 },
  { string: null, fret: null, beats: 1 },
  { string: 5, fret: 3, beats: 1 },
];

export function initializeTabEditor({ onStart, onStop }) {
  const section = document.querySelector("#tabEditor");
  const table = document.querySelector("#editorTable");
  const bpm = document.querySelector("#editorBpm");
  const stringInput = document.querySelector("#editorString");
  const fretInput = document.querySelector("#editorFret");
  const durationInput = document.querySelector("#editorDuration");
  let notes = structuredClone(example);
  let selected = -1;
  let active = -1;
  let unavailable = false;
  let saved = true;

  try {
    const draft = JSON.parse(localStorage.getItem(storageKey));
    if (draft?.version === 1) {
      const restored = validateNotes(draft.notes);
      createTimeline(restored, draft.bpm);
      notes = restored;
      bpm.value = draft.bpm;
    }
  } catch {
    /* Bozuk veya erişilemeyen taslak yerine örnekle başla. */
  }

  function message(source = "") {
    setText("#editorMessage", source);
    document
      .querySelector("#editorMessage")
      .classList.toggle("hidden", !source);
  }

  function save() {
    try {
      const tempo = Number(bpm.value);
      createTimeline(notes, tempo);
      localStorage.setItem(
        storageKey,
        JSON.stringify({ version: 1, bpm: tempo, notes }),
      );
      saved = true;
    } catch {
      saved = false;
    }
    setText(
      "#editorSaveStatus",
      saved
        ? "Taslak bu tarayıcıya kaydedildi."
        : "Taslak kaydedilemedi. Kaybetmemek için indir.",
    );
  }

  function render() {
    table.replaceChildren();
    const header = document.createElement("tr");
    const label = document.createElement("th");
    label.textContent = t("Adım / vuruş");
    header.append(label);
    notes.forEach((note, index) => {
      const cell = document.createElement("th");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${index + 1} · ${note.beats}`;
      button.setAttribute(
        "aria-label",
        t("{step}. adımı düzenle", { step: index + 1 }),
      );
      button.setAttribute("aria-pressed", String(selected === index));
      button.disabled = unavailable || player.playing;
      button.addEventListener("click", () => {
        selected = index;
        stringInput.value = note.string ?? "rest";
        fretInput.value = note.fret ?? 0;
        durationInput.value = note.beats;
        render();
      });
      cell.append(button);
      cell.classList.toggle("step-selected", index === selected);
      cell.classList.toggle("step-playing", index === active);
      header.append(cell);
    });
    table.append(header);
    ["e", "B", "G", "D", "A", "E"].forEach((name, row) => {
      const line = document.createElement("tr");
      const label = document.createElement("th");
      label.scope = "row";
      label.textContent = name;
      line.append(label);
      notes.forEach((note, index) => {
        const cell = document.createElement("td");
        cell.textContent = note.string === row + 1 ? note.fret : "—";
        cell.classList.toggle("step-selected", selected === index);
        cell.classList.toggle("step-playing", active === index);
        line.append(cell);
      });
      table.append(line);
    });
    const tempo = Number(bpm.value);
    let seconds = "—";
    if (bpm.checkValidity()) {
      const timeline = createTimeline(notes, tempo);
      seconds = timeline.length
        ? (timeline.at(-1).start + timeline.at(-1).duration).toFixed(1)
        : "0";
    }
    setText("#editorSummary", "{count} adım · {seconds} sn", {
      count: notes.length,
      seconds,
    });
    fretInput.disabled =
      unavailable || player.playing || stringInput.value === "rest";
    section.querySelectorAll("[data-editor-control]").forEach((control) => {
      control.disabled = unavailable || player.playing;
    });
    document.querySelector("#editorPlay").disabled =
      unavailable || player.playing || !notes.length;
    document.querySelector("#editorStop").disabled = !player.playing;
    document.querySelector("#editorUpdate").disabled =
      unavailable || player.playing || selected < 0;
    document.querySelector("#editorDelete").disabled =
      unavailable || player.playing || selected < 0;
    fretInput.disabled =
      unavailable || player.playing || stringInput.value === "rest";
  }

  function readNote() {
    const rest = stringInput.value === "rest";
    if (!rest && !fretInput.checkValidity())
      throw new Error("Perde 0–24 arasında bir tam sayı olmalı.");
    return validateNotes([
      {
        string: rest ? null : Number(stringInput.value),
        fret: rest ? null : Number(fretInput.value),
        beats: Number(durationInput.value),
      },
    ])[0];
  }

  function changeNotes(action) {
    if (unavailable || player.playing) return;
    try {
      action();
      message();
      save();
      render();
    } catch (error) {
      message(error.message);
    }
  }

  const player = new TabPlayer({
    onStep(index) {
      active = index;
      // Tablosunu yeniden kurmadan imleci taşı: klavye odağı korunur.
      table.querySelectorAll("tr").forEach((row) => {
        [...row.children].forEach((cell, column) =>
          cell.classList.toggle("step-playing", column === index + 1),
        );
      });
      const cell = table.rows[0]?.cells[index + 1];
      if (cell) {
        const wrapper = document.querySelector("#editorScroll");
        if (
          cell.offsetLeft > wrapper.scrollLeft + wrapper.clientWidth - 80 ||
          cell.offsetLeft < wrapper.scrollLeft
        )
          wrapper.scrollLeft = Math.max(
            0,
            cell.offsetLeft - wrapper.clientWidth / 2,
          );
      }
    },
    onStop() {
      active = -1;
      onStop();
      render();
      setText("#editorPlaybackStatus", "Oynatma durdu");
    },
  });

  document.querySelector("#editorAdd").addEventListener("click", () =>
    changeNotes(() => {
      if (notes.length >= maximumNotes)
        throw new Error("En fazla 128 adım ekleyebilirsin.");
      const note = readNote();
      notes.push(note);
      selected = notes.length - 1;
    }),
  );
  document.querySelector("#editorUpdate").addEventListener("click", () =>
    changeNotes(() => {
      if (selected >= 0) notes[selected] = readNote();
    }),
  );
  document.querySelector("#editorDelete").addEventListener("click", () =>
    changeNotes(() => {
      if (selected >= 0) {
        notes.splice(selected, 1);
        selected = -1;
      }
    }),
  );
  stringInput.addEventListener("change", render);
  bpm.addEventListener("input", () => {
    save();
    render();
  });
  document.querySelector("#editorPlay").addEventListener("click", async () => {
    if (unavailable || player.playing || !notes.length) return;
    if (!bpm.checkValidity()) {
      message("Hedef tempo 30–240 BPM arasında olmalı.");
      return;
    }
    message();
    onStart();
    setText("#editorPlaybackStatus", "Tab çalınıyor");
    const starting = player.play(notes, Number(bpm.value));
    render();
    try {
      await starting;
    } catch {
      message(
        "Sesli oynatma başlatılamadı. Tarayıcının ses iznini kontrol et.",
      );
    }
  });
  document
    .querySelector("#editorStop")
    .addEventListener("click", () => player.stop());
  document.querySelector("#editorDownload").addEventListener("click", () => {
    if (!bpm.checkValidity()) {
      message("Hedef tempo 30–240 BPM arasında olmalı.");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([`BPM: ${bpm.value}\n${exportTextTab(notes)}`], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ritim-izi-tab.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.addEventListener("preferenceschange", render);
  render();
  setText("#editorSaveStatus", "Düzenlemeler bu tarayıcıda saklanır.");
  return {
    stop: () => player.stop(),
    setUnavailable(value) {
      unavailable = value;
      render();
    },
  };
}
