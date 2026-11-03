import {
  validateNotes,
  createTimeline,
  exportTextTab,
  maximumNotes,
} from "./tab-model.js";
import { TabHistory } from "./tab-history.js";
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
  const history = new TabHistory();
  let digitBuffer = "";
  let digitTime = 0;

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
    const focusedCell = table.contains(document.activeElement)
      ? document.activeElement
      : null;
    const focusStep = focusedCell?.dataset.step;
    const focusString = focusedCell?.dataset.string;
    table.replaceChildren();
    const header = document.createElement("tr");
    const label = document.createElement("th");
    label.textContent = t("Adım / vuruş");
    header.append(label);
    notes.forEach((note, index) => {
      const cell = document.createElement("th");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.step = index;
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
        digitBuffer = "";
        render();
      });
      cell.append(button);
      cell.classList.toggle("step-selected", index === selected);
      cell.classList.toggle("step-playing", index === active);
      header.append(cell);
    });
    const addHeader = document.createElement("th");
    addHeader.textContent = "+";
    header.append(addHeader);
    table.append(header);
    ["e", "B", "G", "D", "A", "E"].forEach((name, row) => {
      const line = document.createElement("tr");
      const label = document.createElement("th");
      label.scope = "row";
      label.textContent = name;
      line.append(label);
      notes.forEach((note, index) => {
        const cell = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.step = index;
        button.dataset.string = row + 1;
        button.textContent = note.string === row + 1 ? note.fret : "—";
        button.className = "tab-cell";
        button.disabled = unavailable || player.playing;
        button.setAttribute(
          "aria-label",
          t("{step}. adım, {string}. tel, perde {fret}", {
            step: index + 1,
            string: row + 1,
            fret: note.string === row + 1 ? note.fret : "—",
          }),
        );
        cell.append(button);
        cell.classList.toggle("step-selected", selected === index);
        cell.classList.toggle("step-playing", active === index);
        line.append(cell);
      });
      const extra = document.createElement("td");
      const add = document.createElement("button");
      add.type = "button";
      add.className = "tab-cell add-cell";
      add.dataset.step = notes.length;
      add.dataset.string = row + 1;
      add.textContent = "+";
      add.disabled =
        unavailable || player.playing || notes.length >= maximumNotes;
      add.setAttribute(
        "aria-label",
        t("{string}. tele yeni nota ekle", { string: row + 1 }),
      );
      extra.append(add);
      line.append(extra);
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
    document.querySelector("#editorDelete").disabled =
      unavailable || player.playing || selected < 0;
    fretInput.disabled =
      unavailable || player.playing || stringInput.value === "rest";
    document.querySelector("#editorUndo").disabled =
      unavailable || player.playing || !history.past.length;
    document.querySelector("#editorRedo").disabled =
      unavailable || player.playing || !history.future.length;
    document.querySelector("#editorDuplicate").disabled =
      unavailable ||
      player.playing ||
      selected < 0 ||
      notes.length >= maximumNotes;
    setText(
      "#editorSelection",
      selected >= 0
        ? "Seçili adım: {step} · Değişiklikler otomatik uygulanır."
        : "Yeni nota · Tablodaki + işaretine basarak ekle.",
      { step: selected + 1 },
    );
    if (focusStep !== undefined) {
      const selector = focusString
        ? `[data-step="${focusStep}"][data-string="${focusString}"]`
        : `[data-step="${focusStep}"]`;
      table.querySelector(selector)?.focus({ preventScroll: true });
    }
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
    const previous = structuredClone(notes);
    try {
      action();
      history.record(previous, notes);
      message();
      save();
      render();
    } catch (error) {
      notes = previous;
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
  document.querySelector("#editorDelete").addEventListener("click", () =>
    changeNotes(() => {
      if (selected >= 0) {
        notes.splice(selected, 1);
        selected = -1;
      }
    }),
  );
  function applyFields() {
    if (selected >= 0)
      changeNotes(() => {
        notes[selected] = readNote();
      });
    else render();
  }
  stringInput.addEventListener("change", applyFields);
  fretInput.addEventListener("change", applyFields);
  durationInput.addEventListener("change", applyFields);

  function focusGrid() {
    const step = selected < 0 ? notes.length : selected;
    const string = stringInput.value === "rest" ? "6" : stringInput.value;
    table
      .querySelector(`[data-step="${step}"][data-string="${string}"]`)
      ?.focus({ preventScroll: true });
  }

  function enterFret(fret) {
    fretInput.value = fret;
    if (stringInput.value === "rest") stringInput.value = "6";
    changeNotes(() => {
      const note = readNote();
      if (selected < 0) {
        if (notes.length >= maximumNotes)
          throw new Error("En fazla 128 adım ekleyebilirsin.");
        notes.push(note);
        selected = notes.length - 1;
      } else notes[selected] = note;
    });
    focusGrid();
  }

  table.addEventListener("click", (event) => {
    const button = event.target.closest(".tab-cell");
    if (!button || unavailable || player.playing) return;
    const index = Number(button.dataset.step);
    stringInput.value = button.dataset.string;
    digitBuffer = "";
    if (index === notes.length) {
      selected = -1;
      enterFret(Number(fretInput.value) || 0);
    } else {
      selected = index;
      fretInput.value = notes[index].fret ?? 0;
      durationInput.value = notes[index].beats;
      changeNotes(() => {
        notes[selected] = readNote();
      });
      focusGrid();
    }
  });

  document.querySelector("#editorFrets").addEventListener("click", (event) => {
    const button = event.target.closest("[data-fret]");
    if (button) {
      digitBuffer = "";
      enterFret(Number(button.dataset.fret));
    }
  });

  document.querySelector("#editorNew").addEventListener("click", () => {
    selected = -1;
    digitBuffer = "";
    render();
    focusGrid();
  });
  document.querySelector("#editorRest").addEventListener("click", () => {
    stringInput.value = "rest";
    document.querySelector("#editorAdd").click();
    digitBuffer = "";
    focusGrid();
  });
  document.querySelector("#editorDuplicate").addEventListener("click", () =>
    changeNotes(() => {
      if (selected < 0 || notes.length >= maximumNotes) return;
      notes.splice(selected + 1, 0, { ...notes[selected] });
      selected++;
    }),
  );

  function restore(direction) {
    if (unavailable || player.playing) return;
    notes = history[direction](notes);
    selected = -1;
    digitBuffer = "";
    message();
    save();
    render();
  }
  document
    .querySelector("#editorUndo")
    .addEventListener("click", () => restore("undo"));
  document
    .querySelector("#editorRedo")
    .addEventListener("click", () => restore("redo"));
  section.addEventListener("keydown", (event) => {
    const typing = event.target.matches("input, select, textarea");
    if (typing || unavailable || player.playing || event.altKey) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      restore(event.shiftKey ? "redo" : "undo");
      return;
    }
    if (event.ctrlKey || event.metaKey || !table.contains(event.target)) return;
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      const now = performance.now();
      const combined =
        now - digitTime < 800 ? digitBuffer + event.key : event.key;
      digitBuffer = Number(combined) <= 24 ? combined : event.key;
      digitTime = now;
      enterFret(Number(digitBuffer));
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      changeNotes(() => {
        if (selected >= 0) {
          notes.splice(selected, 1);
          selected = -1;
        }
      });
      focusGrid();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      digitBuffer = "";
      const next =
        (selected < 0 ? notes.length : selected) +
        (event.key === "ArrowRight" ? 1 : -1);
      selected = next >= notes.length ? -1 : Math.max(0, next);
      if (!notes.length) selected = -1;
      if (selected >= 0) {
        stringInput.value = notes[selected].string ?? "6";
        fretInput.value = notes[selected].fret ?? 0;
        durationInput.value = notes[selected].beats;
      }
      render();
      focusGrid();
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      digitBuffer = "";
      stringInput.value =
        Math.max(
          1,
          Math.min(
            6,
            Number(stringInput.value) + (event.key === "ArrowDown" ? 1 : -1),
          ),
        ) || 6;
      focusGrid();
    }
  });
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
