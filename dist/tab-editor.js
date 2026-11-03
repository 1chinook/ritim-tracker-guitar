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
import { setText } from "./preferences.js";

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
  let session = new ScoreSession(example);
  let selected = null;
  let active = null;
  let unavailable = false;
  let loading = false;
  let storageProtected = false;
  let digitBuffer = "";
  let digitTime = 0;
  let initialMessage = "";
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
  }

  function readVoice() {
    if (fields.string.value === "rest") return null;
    if (!fields.fret.checkValidity())
      throw new Error("Perde 0–24 arasında bir tam sayı olmalı.");
    const techniques = [];
    if (fields.dead.checked) techniques.push({ type: "deadNote" });
    else {
      if (fields.pitch.value === "bend")
        techniques.push({ type: "bend", semitones: Number(fields.bend.value) });
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
    }
    return {
      string: Number(fields.string.value),
      fret: Number(fields.fret.value),
      techniques,
    };
  }

  function render(focus = null) {
    const focused = grid.contains(document.activeElement)
      ? document.activeElement
      : null;
    const restore =
      focus ??
      (focused
        ? { id: focused.dataset.event, string: focused.dataset.string }
        : null);
    renderScoreGrid(grid, session.document, {
      selected,
      active,
      disabled: blocked(),
      string: fields.string.value,
    });
    section.querySelectorAll("[data-editor-control]").forEach((control) => {
      control.disabled = blocked();
    });
    fields.fret.disabled = blocked() || fields.string.value === "rest";
    fields.bend.disabled =
      blocked() || fields.pitch.value !== "bend" || fields.dead.checked;
    fields.target.disabled =
      blocked() ||
      !["slide", "hammerOn", "pullOff"].includes(fields.pitch.value) ||
      fields.dead.checked;
    fields.depth.disabled =
      blocked() || !fields.vibrato.checked || fields.dead.checked;
    fields.rate.disabled = fields.depth.disabled;
    for (const control of [fields.pitch, fields.vibrato, fields.mute])
      control.disabled = blocked() || fields.dead.checked;
    find("editorPlay").disabled = blocked() || !session.document.events.length;
    find("editorStop").disabled = !player.playing;
    find("editorUndo").disabled = blocked() || !session.past.length;
    find("editorRedo").disabled = blocked() || !session.future.length;
    find("editorDelete").disabled = blocked() || !selectedEvent();
    find("editorRemoveVoice").disabled = blocked() || !selectedVoice();
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
      selectedEvent()
        ? "Seçili adım: {step} · Değişiklikler otomatik uygulanır."
        : "Yeni nota · Tablodaki + işaretine basarak ekle.",
      {
        step:
          session.document.events.findIndex((event) => event.id === selected) +
          1,
      },
    );
    if (restore?.id)
      grid
        .querySelector(
          `[data-event="${restore.id}"][data-string="${restore.string ?? fields.string.value}"]`,
        )
        ?.focus({ preventScroll: true });
  }

  function edit(action, focus = false) {
    if (blocked()) return;
    try {
      action();
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

  function add(rest = false) {
    edit(() => {
      const voice = rest ? null : readVoice();
      selected = session.add(voice, Number(fields.duration.value));
      if (rest) fields.string.value = "rest";
      syncFields();
    }, true);
  }

  grid.addEventListener("click", (event) => {
    const cell = event.target.closest("[data-event]");
    if (!cell || blocked()) return;
    digitBuffer = "";
    const string = cell.dataset.string;
    if (string) fields.string.value = string;
    if (cell.dataset.event === "new") {
      add();
      return;
    }
    selected = cell.dataset.event;
    if (!string)
      fields.string.value = selectedEvent().notes[0]?.string ?? "rest";
    const existing = selectedVoice();
    if (string && !existing) {
      // Boş tel hücresine tıklamak aynı akora yeni ses ekler; diğer teller korunur.
      fields.pitch.value = "none";
      fields.vibrato.checked = false;
      fields.mute.checked = false;
      fields.dead.checked = false;
      edit(() => session.setVoice(selected, readVoice()), true);
    } else {
      syncFields();
      render({ id: selected, string: fields.string.value });
    }
  });

  function enterFret(fret) {
    fields.fret.value = fret;
    if (fields.string.value === "rest") fields.string.value = "6";
    if (!selectedEvent()) add();
    else edit(() => session.setVoice(selected, readVoice()), true);
  }
  find("editorFrets").addEventListener("click", (event) => {
    const button = event.target.closest("[data-fret]");
    if (button) {
      digitBuffer = "";
      enterFret(Number(button.dataset.fret));
    }
  });
  find("editorAdd").addEventListener("click", () => add());
  find("editorRest").addEventListener("click", () => add(true));
  find("editorNew").addEventListener("click", () => {
    selected = null;
    digitBuffer = "";
    syncFields();
    render({
      id: "new",
      string: fields.string.value === "rest" ? "6" : fields.string.value,
    });
  });
  find("editorDelete").addEventListener("click", () =>
    edit(() => {
      session.removeEvent(selected);
      selected = null;
      syncFields();
    }),
  );
  find("editorRemoveVoice").addEventListener("click", () =>
    edit(() => {
      session.removeVoice(selected, Number(fields.string.value));
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
      if (selectedEvent() && fields.string.value !== "rest")
        edit(() => session.setVoice(selected, readVoice()));
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
    if (event.ctrlKey || event.metaKey || !grid.contains(event.target)) return;
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
    if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const events = session.document.events;
      const index = selected
        ? events.findIndex((item) => item.id === selected)
        : events.length;
      const next = index + (event.key === "ArrowRight" ? 1 : -1);
      selected = events[Math.max(0, next)]?.id ?? null;
      syncFields();
      render({
        id: selected ?? "new",
        string: fields.string.value === "rest" ? "6" : fields.string.value,
      });
    }
    if (["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
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
    setText("#editorPlaybackStatus", "Tab çalınıyor");
    const starting = player.play(session.document);
    render();
    try {
      await starting;
    } catch {
      message(
        "Sesli oynatma başlatılamadı. Tarayıcının ses iznini kontrol et.",
      );
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
