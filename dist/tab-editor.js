import {
  migrateLegacyDraft,
  parseScore,
  serializeScore,
} from "./score-document.js";
import { ScoreSession } from "./score-session.js";
import { loadScoreDraft, saveScoreDraft } from "./score-storage.js";
import { splitMeasures, exportScoreText, midiLabel } from "./score-notation.js";
import { ScorePlayer } from "./score-player.js";
import { renderScoreGrid } from "./score-grid.js";
import { compileScore } from "./score-timeline.js";
import { setText, t } from "./preferences.js";
import { parseRiff } from "./riff-input.js";
import { initializeTechniqueControls } from "./technique-controls.js";
import { maximumNotes } from "./tab-model.js";
import { selectionBounds, selectedRegion } from "./score-selection.js";

const example = migrateLegacyDraft({
  version: 1,
  bpm: 90,
  notes: [
    { string: 6, fret: 0, beats: 1 },
    { string: 6, fret: 3, beats: 0.5 },
    { string: 5, fret: 0, beats: 0.5 },
    { string: null, fret: null, beats: 1 },
    { string: 5, fret: 3, beats: 1 },
  ],
});

export function initializeTabEditor({ onStart, onStop }) {
  const find = (id) => document.querySelector(`#${id}`);
  const section = find("tabEditor");
  const grid = find("editorTable");
  const fields = {
    string: find("editorString"),
    fret: find("editorFret"),
    duration: find("editorDuration"),
    bpm: find("editorBpm"),
    meter: find("editorMeter"),
    pitch: find("editorPitchTechnique"),
    bend: find("editorBend"),
    target: find("editorTargetFret"),
    vibrato: find("editorVibrato"),
    depth: find("editorVibratoDepth"),
    rate: find("editorVibratoRate"),
    mute: find("editorPalmMute"),
    dead: find("editorDeadNote"),
  };
  const extraTechniques = initializeTechniqueControls({
    find,
    bendAmount: () => Number(fields.bend.value),
    onChange: () => {
      if (selectedVoice())
        edit(() => {
          session.setVoice(selected, readVoice());
          syncFields();
        });
    },
    onLink: (type) => {
      const area = region();
      if (area.ids.length !== 2 || area.strings.length !== 1) return;
      edit(() => {
        session.linkNotes(area.ids[0], area.ids[1], area.strings[0], type);
        selected = area.ids[0];
        syncFields();
      }, true);
    },
  });
  let session = new ScoreSession(example);
  let selected = null;
  let active = null;
  let unavailable = false;
  let loading = false;
  let storageProtected = false;
  let digitBuffer = "";
  let digitTime = 0;
  let initialMessage = "";
  let selectionAnchor = null;
  let selectionFocus = null;
  let clipboard = [];
  let drag = null;
  let inlineEditor = null;
  try {
    const draft = loadScoreDraft(localStorage);
    if (draft) session = new ScoreSession(draft.score);
  } catch {
    storageProtected = true;
    initialMessage =
      "Taslak okunamadı. Eski kayıt korunuyor; yeni çalışmanı JSON olarak indir.";
  }

  const selectedEvent = () =>
    session.document.events.find((event) => event.id === selected);
  const selectedVoice = () =>
    selectedEvent()?.notes.find(
      (note) => note.string === Number(fields.string.value),
    );
  const blocked = () => unavailable || loading || player.playing;
  const currentCell = () =>
    selected ? { id: selected, string: Number(fields.string.value) } : null;
  const bounds = () =>
    selectionBounds(
      session.document,
      selectionAnchor ?? currentCell(),
      selectionFocus ?? currentCell(),
    );
  const region = () => selectedRegion(session.document, bounds());
  function clearRange() {
    selectionAnchor = null;
    selectionFocus = null;
    drag = null;
  }

  function paintSelection() {
    const area = bounds();
    grid.querySelectorAll("[data-event][data-string]").forEach((cell) => {
      const index = session.document.events.findIndex(
        (event) => event.id === cell.dataset.event,
      );
      const string = Number(cell.dataset.string);
      const included = Boolean(
        area &&
          index >= area.first &&
          index <= area.last &&
          string >= area.top &&
          string <= area.bottom,
      );
      cell.classList.toggle("range-selected", included);
      cell.classList.toggle(
        "voice-selected",
        cell.dataset.event === (selected ?? "new") &&
          string === Number(fields.string.value),
      );
      cell.setAttribute("aria-pressed", String(included));
      cell.parentElement?.classList.toggle(
        "cursor-column",
        cell.dataset.event === (selected ?? "new"),
      );
    });
  }

  function message(source = "") {
    setText("#editorMessage", source);
    find("editorMessage").classList.toggle("hidden", !source);
  }

  function save() {
    try {
      if (storageProtected) throw new Error("Protected");
      saveScoreDraft(localStorage, session.document);
      setText("#editorSaveStatus", "Taslak bu tarayıcıya kaydedildi.");
    } catch {
      setText(
        "#editorSaveStatus",
        "Taslak kaydedilemedi. Kaybetmemek için indir.",
      );
    }
  }

  function ensureOption(select, value, label) {
    if (![...select.options].some((option) => option.value === String(value))) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    select.value = value;
  }

  function syncFields() {
    for (const option of fields.string.options) {
      const string = Number(option.value);
      if (string >= 1 && string <= 6)
        option.textContent = `${string} · ${midiLabel(session.document.tuning[string - 1])}`;
    }
    const event = selectedEvent();
    const note = selectedVoice();
    if (event)
      ensureOption(
        fields.duration,
        event.durationTicks,
        `${event.durationTicks} tick`,
      );
    if (note) fields.fret.value = note.fret;
    const effects = note?.techniques ?? [];
    const pitch = effects.find((effect) =>
      ["bend", "slide", "hammerOn", "pullOff"].includes(effect.type),
    );
    const vibrato = effects.find((effect) => effect.type === "vibrato");
    fields.pitch.value = pitch?.type ?? "none";
    fields.bend.value = pitch?.semitones ?? 1;
    fields.target.value =
      pitch?.targetFret ?? Math.min(24, Number(fields.fret.value) + 2);
    fields.vibrato.checked = Boolean(vibrato);
    fields.depth.value = vibrato?.depthCents ?? 30;
    fields.rate.value = vibrato?.rateHz ?? 5;
    fields.mute.checked = effects.some((effect) => effect.type === "palmMute");
    fields.dead.checked = effects.some((effect) => effect.type === "deadNote");
    extraTechniques.sync(note);
  }

  function readVoice() {
    if (!fields.fret.checkValidity())
      throw new Error("Perde 0–24 arasında bir tam sayı olmalı.");
    const techniques = [];
    if (fields.dead.checked) techniques.push({ type: "deadNote" });
    else {
      if (fields.pitch.value === "bend")
        techniques.push({
          type: "bend",
          semitones: Number(fields.bend.value),
          curve: extraTechniques.curve(),
        });
      if (["slide", "hammerOn", "pullOff"].includes(fields.pitch.value))
        techniques.push({
          type: fields.pitch.value,
          targetFret: Number(fields.target.value),
        });
      if (fields.vibrato.checked)
        techniques.push({
          type: "vibrato",
          depthCents: Number(fields.depth.value),
          rateHz: Number(fields.rate.value),
        });
      if (fields.mute.checked) techniques.push({ type: "palmMute" });
      techniques.push(...extraTechniques.read());
    }
    return {
      string: Number(fields.string.value),
      fret: Number(fields.fret.value),
      techniques,
    };
  }

  function render(focus = null, preserveGrid = false) {
    const focused = grid.contains(document.activeElement)
      ? document.activeElement
      : null;
    const restore =
      focus ??
      (focused
        ? { id: focused.dataset.event, string: focused.dataset.string }
        : null);
    if (!preserveGrid) {
      inlineEditor = null;
      renderScoreGrid(grid, session.document, {
        selected,
        active,
        disabled: blocked(),
        string: fields.string.value,
      });
    }
    paintSelection();
    section.querySelectorAll("[data-editor-control]").forEach((control) => {
      control.disabled = blocked();
    });
    const full = session.document.events.length >= maximumNotes;
    const event = selectedEvent();
    find("editorNew").disabled = blocked() || full;
    find("editorRest").disabled = blocked() || full;
    find("editorNext").disabled =
      blocked() || !event || (full && event === session.document.events.at(-1));
    find("editorEditFret").disabled = blocked() || (full && !event);
    find("editorInsertBefore").disabled = blocked() || !event || full;
    find("editorCopy").disabled = blocked() || !region().ids.length;
    find("editorPaste").disabled =
      blocked() ||
      !clipboard.length ||
      session.document.events.length + clipboard.length > maximumNotes;
    find("editorRemoveVoice").disabled =
      blocked() || !region().events.some((event) => event.notes.length);
    setText(
      "#editorDurationLabel",
      event ? "Bu adımın süresi" : "Yeni notanın süresi",
    );
    const hasVoice = Boolean(selectedVoice());
    const techniqueBlocked = blocked() || !hasVoice || fields.dead.checked;
    fields.dead.disabled = blocked() || !hasVoice;
    fields.bend.disabled = techniqueBlocked || fields.pitch.value !== "bend";
    fields.target.disabled =
      techniqueBlocked ||
      !["slide", "hammerOn", "pullOff"].includes(fields.pitch.value);
    fields.depth.disabled = techniqueBlocked || !fields.vibrato.checked;
    fields.rate.disabled = fields.depth.disabled;
    extraTechniques.disable(
      techniqueBlocked,
      fields.pitch.value === "bend",
      region().ids.length === 2 && region().strings.length === 1,
      blocked(),
    );
    for (const control of [fields.pitch, fields.vibrato, fields.mute])
      control.disabled = techniqueBlocked;
    find("editorPlay").disabled = blocked() || !session.document.events.length;
    find("editorStop").disabled = !player.playing;
    find("editorUndo").disabled = blocked() || !session.past.length;
    find("editorRedo").disabled = blocked() || !session.future.length;
    find("editorDelete").disabled = blocked() || !selectedEvent();
    find("editorDuplicate").disabled =
      blocked() || !selectedEvent() || session.document.events.length >= 128;
    fields.bpm.value = session.document.bpm;
    const meter = session.document.meter;
    ensureOption(
      fields.meter,
      `${meter.beats}/${meter.unit}`,
      `${meter.beats}/${meter.unit}`,
    );
    const timeline = compileScore(session.document);
    setText("#editorSummary", "{count} adım · {seconds} sn", {
      count: session.document.events.length,
      seconds: timeline.duration.toFixed(1),
    });
    setText(
      "#editorSelection",
      event
        ? "{step}. adım · {string}. tel"
        : "Yeni nota · {string}. tel · Çift tıklayarak perde yaz.",
      {
        step: session.document.events.indexOf(event) + 1,
        string: fields.string.value,
      },
    );
    if (region().ids.length > 1 || region().strings.length > 1)
      setText("#editorSelection", "{steps} adım · {strings} tel seçili", {
        steps: region().ids.length,
        strings: region().strings.length,
      });
    if (restore?.id) {
      const cell = grid.querySelector(
        `[data-event="${restore.id}"][data-string="${restore.string ?? fields.string.value}"]`,
      );
      cell?.focus({ preventScroll: true });
      if (focus) cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  function edit(action, focus = false) {
    if (blocked()) return;
    try {
      action();
      clearRange();
      // Önceden alınmış belgelerde de ölçü sayısı arayüz sınırında kalmalı.
      message();
      save();
      render(
        focus ? { id: selected ?? "new", string: fields.string.value } : null,
      );
    } catch (error) {
      message(
        error.message.startsWith("score")
          ? "Teknik değerlerini kontrol et. Hedef perde ve teknik yönü uyumlu olmalı."
          : error.message,
      );
      syncFields();
      render();
    }
  }

  const player = new ScorePlayer({
    onStep(id) {
      active = id;
      grid
        .querySelectorAll("[data-event]")
        .forEach((cell) =>
          cell.classList.toggle("step-playing", cell.dataset.event === id),
        );
      grid
        .querySelector(`[data-event="${id}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
    onStop() {
      active = null;
      onStop();
      render();
      setText("#editorPlaybackStatus", "Oynatma durdu");
    },
  });

  function add(rest = false, stayAtEnd = false) {
    edit(() => {
      const voice = rest ? null : readVoice();
      const id = session.add(voice, Number(fields.duration.value));
      selected =
        stayAtEnd && session.document.events.length < maximumNotes ? null : id;
      syncFields();
    }, !stayAtEnd);
  }

  function openInline(beforeId = null) {
    if (blocked()) return;
    digitBuffer = "";
    const id = selected ?? "new";
    const string = Number(fields.string.value);
    const cell = grid.querySelector(
      `[data-event="${id}"][data-string="${string}"]`,
    );
    if (!cell) return;
    const voice = selectedVoice();
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.className = "inline-fret";
    input.dataset.inlineFret = "true";
    input.value = beforeId ? "" : String(voice?.fret ?? "");
    input.placeholder = "0–24";
    input.setAttribute(
      "aria-label",
      t(beforeId ? "Araya eklenecek perde" : "Perdeyi düzenle"),
    );
    inlineEditor = input;
    const finish = (cancel = false, fromBlur = false) => {
      if (inlineEditor !== input) return;
      const raw = input.value.trim();
      const valid = /^\d{1,2}$/.test(raw) && Number(raw) <= 24;
      if (!cancel && raw && !valid && !fromBlur) {
        input.setAttribute("aria-invalid", "true");
        message("Perde 0–24 arasında bir tam sayı olmalı.");
        return;
      }
      inlineEditor = null;
      if (cancel || (!valid && raw) || (beforeId && !raw)) {
        render({ id, string });
        if (!cancel && raw) message("Perde 0–24 arasında bir tam sayı olmalı.");
        return;
      }
      edit(() => {
        const note = {
          string,
          fret: Number(raw),
          techniques: voice?.techniques ?? [],
        };
        if (beforeId) {
          note.techniques = [];
          selected = session.insertBefore(
            beforeId,
            note,
            Number(fields.duration.value),
          );
        } else if (!raw) {
          if (id !== "new") session.removeVoice(id, string);
        } else if (id === "new") {
          selected = session.add(note, Number(fields.duration.value));
        } else {
          session.setVoice(id, note);
        }
        syncFields();
      }, true);
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish(event.key === "Escape");
      }
    });
    input.addEventListener("blur", () => {
      if (input.isConnected) finish(false, true);
    });
    cell.parentElement.replaceChildren(input);
    input.focus();
    input.select();
  }

  function copySelection() {
    if (blocked() || !region().ids.length) return;
    clipboard = region().events;
    render(null, true);
    setText(
      "#editorClipboardStatus",
      "{count} adım kopyalandı. Yapıştır seçili adımdan sonra ekler.",
      { count: clipboard.length },
    );
  }
  function pasteSelection() {
    if (!clipboard.length) return;
    edit(() => {
      selected = session.insertEvents(clipboard, selected).at(-1);
      syncFields();
    }, true);
  }
  find("editorEditFret").addEventListener("click", () => openInline());
  find("editorInsertBefore").addEventListener("click", () =>
    openInline(selected),
  );
  find("editorCopy").addEventListener("click", copySelection);
  find("editorPaste").addEventListener("click", pasteSelection);

  const cellPoint = (cell) => ({
    id: cell.dataset.event,
    string: Number(cell.dataset.string),
  });
  grid.addEventListener("focusin", (event) => {
    if (blocked() || drag || inlineEditor) return;
    const cell = event.target.closest("[data-event][data-string]");
    if (!cell) return;
    const point = cellPoint(cell);
    const id = point.id === "new" ? null : point.id;
    if (selected === id && Number(fields.string.value) === point.string) return;
    clearRange();
    selected = id;
    fields.string.value = String(point.string);
    syncFields();
    render(null, true);
  });
  grid.addEventListener("pointerdown", (event) => {
    if (blocked() || event.button !== 0 || event.pointerType === "touch")
      return;
    const cell = event.target.closest("[data-event][data-string]");
    drag = null;
    if (!cell || cell.dataset.event === "new") return;
    const point = cellPoint(cell);
    drag = {
      anchor: event.shiftKey
        ? (selectionAnchor ?? currentCell() ?? point)
        : point,
      focus: point,
      moved: false,
    };
  });
  grid.addEventListener("pointerover", (event) => {
    if (!drag || event.buttons !== 1 || blocked()) return;
    const cell = event.target.closest("[data-event][data-string]");
    if (!cell || cell.dataset.event === "new") return;
    const point = cellPoint(cell);
    if (point.id === drag.focus.id && point.string === drag.focus.string)
      return;
    drag.focus = point;
    drag.moved = true;
    selectionAnchor = drag.anchor;
    selectionFocus = point;
    selected = point.id;
    fields.string.value = String(point.string);
    paintSelection();
  });
  document.addEventListener("pointerup", (event) => {
    if (drag && !grid.contains(event.target)) {
      drag = null;
      syncFields();
      render(null, true);
    }
  });
  document.addEventListener("pointercancel", () => {
    drag = null;
  });
  grid.addEventListener("dblclick", (event) => {
    const cell = event.target.closest("[data-event][data-string]");
    if (cell && !blocked()) openInline();
  });

  grid.addEventListener("click", (event) => {
    if (blocked()) return;
    if (event.target.closest("[data-inline-fret]")) return;
    if (drag?.moved) {
      drag = null;
      syncFields();
      render(null, true);
      return;
    }
    drag = null;
    const duplicate = event.target.closest("[data-duplicate-measure]");
    if (duplicate && !duplicate.disabled) {
      edit(() => {
        selected =
          session.duplicateMeasure(
            Number(duplicate.dataset.duplicateMeasure),
          )[0] ?? null;
        syncFields();
      }, true);
      return;
    }
    const remove = event.target.closest("[data-remove-measure]");
    if (remove && !remove.disabled) {
      const index = Number(remove.dataset.removeMeasure);
      edit(() => {
        session.removeMeasure(index);
        const measures = splitMeasures(session.document);
        const nextMeasure = measures[index] ?? measures.at(-1);
        selected = nextMeasure.segments[0]?.id ?? null;
        syncFields();
      }, true);
      return;
    }
    const cell = event.target.closest("[data-event]");
    if (!cell) return;
    digitBuffer = "";
    const previous = selectionAnchor ?? currentCell();
    const string = cell.dataset.string;
    if (string) fields.string.value = string;
    if (cell.dataset.event === "new") {
      clearRange();
      selected = null;
      syncFields();
      render({ id: "new", string: fields.string.value });
      return;
    }
    selected = cell.dataset.event;
    if (!string && selectedEvent().notes.length)
      fields.string.value = selectedEvent().notes[0].string;
    if (event.shiftKey && previous) {
      selectionAnchor = previous;
      selectionFocus = currentCell();
    } else {
      clearRange();
      if (!string) {
        selectionAnchor = { id: selected, string: 1 };
        selectionFocus = { id: selected, string: 6 };
      }
    }
    syncFields();
    render({ id: selected, string: fields.string.value }, true);
  });

  function enterFret(fret) {
    fields.fret.value = fret;
    if (!selectedEvent()) add();
    else edit(() => session.setVoice(selected, readVoice()), true);
  }

  function moveStep(direction) {
    if (blocked()) return;
    digitBuffer = "";
    clearRange();
    const events = session.document.events;
    const index = selected ? events.indexOf(selectedEvent()) : events.length;
    const end =
      events.length < maximumNotes ? events.length : events.length - 1;
    const next = Math.max(0, Math.min(end, index + direction));
    selected = events[next]?.id ?? null;
    syncFields();
    render({ id: selected ?? "new", string: fields.string.value });
  }
  find("editorNext").addEventListener("click", () => moveStep(1));
  function insertRiff() {
    edit(() => {
      const input = find("editorRiff");
      const voices = parseRiff(input.value, Number(fields.string.value));
      selected = session.insertSequence(
        voices,
        Number(fields.duration.value),
        selected,
      );
      input.value = "";
      digitBuffer = "";
      syncFields();
    }, true);
  }
  find("editorInsertRiff").addEventListener("click", insertRiff);
  find("editorRiff").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      insertRiff();
    }
  });
  find("editorRest").addEventListener("click", () =>
    add(true, !selectedEvent()),
  );
  find("editorNew").addEventListener("click", () => {
    clearRange();
    selected = null;
    digitBuffer = "";
    syncFields();
    render({
      id: "new",
      string: fields.string.value,
    });
  });
  find("editorDelete").addEventListener("click", () =>
    edit(() => {
      session.removeEvents(region().ids);
      selected = null;
      syncFields();
    }),
  );
  find("editorRemoveVoice").addEventListener("click", () =>
    edit(() => {
      const area = region();
      session.removeVoices(area.ids, area.strings);
      syncFields();
    }),
  );
  find("editorDuplicate").addEventListener("click", () =>
    edit(() => {
      selected = session.duplicate(selected);
      syncFields();
    }),
  );
  function restore(direction) {
    edit(() => {
      session[direction]();
      selected = null;
      syncFields();
    });
  }
  find("editorUndo").addEventListener("click", () => restore("undo"));
  find("editorRedo").addEventListener("click", () => restore("redo"));

  fields.string.addEventListener("change", () => {
    clearRange();
    syncFields();
    render();
  });
  fields.duration.addEventListener("change", () => {
    if (selectedEvent())
      edit(() =>
        session.change((score) => {
          score.events.find((event) => event.id === selected).durationTicks =
            Number(fields.duration.value);
        }),
      );
  });
  for (const input of [
    fields.fret,
    fields.pitch,
    fields.bend,
    fields.target,
    fields.vibrato,
    fields.depth,
    fields.rate,
    fields.mute,
    fields.dead,
  ]) {
    input.addEventListener("change", () => {
      if (selectedVoice()) edit(() => session.setVoice(selected, readVoice()));
      else render();
    });
  }
  fields.bpm.addEventListener("change", () =>
    edit(() => {
      if (!fields.bpm.checkValidity())
        throw new Error("Hedef tempo 30–240 BPM arasında olmalı.");
      session.change((score) => {
        score.bpm = Number(fields.bpm.value);
      });
    }),
  );
  fields.meter.addEventListener("change", () =>
    edit(() =>
      session.change((score) => {
        const [beats, unit] = fields.meter.value.split("/").map(Number);
        score.meter = { beats, unit };
      }),
    ),
  );

  section.addEventListener("keydown", (event) => {
    const cell =
      grid.contains(event.target) && event.target.closest("[data-event]");
    if (event.key === " " && cell) {
      event.preventDefault();
      find(player.playing ? "editorStop" : "editorPlay").click();
      return;
    }
    if (
      event.target.matches("input, select, textarea") ||
      blocked() ||
      event.altKey
    )
      return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      restore(event.shiftKey ? "redo" : "undo");
      return;
    }
    if ((event.ctrlKey || event.metaKey) && cell) {
      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelection();
      }
      if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteSelection();
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || !cell) return;
    if (event.key === "F2" || event.key === "Insert") {
      event.preventDefault();
      openInline(event.key === "Insert" ? selected : null);
      return;
    }
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
    digitBuffer = "";
    if (["Delete", "Backspace"].includes(event.key)) {
      event.preventDefault();
      find(event.shiftKey ? "editorDelete" : "editorRemoveVoice").click();
      return;
    }
    if (["ArrowLeft", "ArrowRight", "Enter"].includes(event.key)) {
      event.preventDefault();
      moveStep(event.key === "ArrowLeft" ? -1 : 1);
    }
    if (["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      clearRange();
      fields.string.value = Math.max(
        1,
        Math.min(
          6,
          (Number(fields.string.value) || 6) +
            (event.key === "ArrowUp" ? -1 : 1),
        ),
      );
      syncFields();
      render({ id: selected ?? "new", string: fields.string.value });
    }
  });

  find("editorPlay").addEventListener("click", async () => {
    if (blocked() || !session.document.events.length) return;
    message();
    onStart();
    setText("#editorPlaybackStatus", "Gitar sesleri hazırlanıyor…");
    const starting = player.play(session.document, find("editorTone").value);
    render();
    try {
      await starting;
      if (player.playing) setText("#editorPlaybackStatus", "Tab çalınıyor");
    } catch {
      message("Gitar sesleri yüklenemedi. Sayfayı yenileyip tekrar dene.");
    }
  });
  find("editorStop").addEventListener("click", () => player.stop());
  function download(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  find("editorDownload").addEventListener("click", () =>
    download(
      exportScoreText(session.document),
      "ritim-izi-tab.txt",
      "text/plain;charset=utf-8",
    ),
  );
  find("editorJson").addEventListener("click", () =>
    download(
      serializeScore(session.document),
      "ritim-izi-score.json",
      "application/json",
    ),
  );
  find("editorImport").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file || blocked()) return;
    if (file.size > 1024 * 1024) {
      message("JSON dosyası en fazla 1 MB olabilir.");
      return;
    }
    loading = true;
    render();
    try {
      const score = parseScore(await file.text());
      splitMeasures(score);
      // Dosya açma da geri alınabilir; eski belge kaybolmaz.
      session.change((draft) => {
        Object.assign(draft, score);
      });
      selected = null;
      storageProtected = false;
      clearRange();
      syncFields();
      save();
      message();
    } catch {
      message("Dosya okunamadı. Desteklenen bir Ritim İzi JSON dosyası seç.");
    } finally {
      loading = false;
      event.target.value = "";
      render();
    }
  });
  document.addEventListener("preferenceschange", () => render());
  syncFields();
  render();
  message(initialMessage);
  setText(
    "#editorSaveStatus",
    storageProtected
      ? "Taslak kaydedilemedi. Kaybetmemek için indir."
      : "Düzenlemeler bu tarayıcıda saklanır.",
  );
  return {
    stop: () => player.stop(),
    setUnavailable(value) {
      unavailable = value;
      render();
    },
  };
}
