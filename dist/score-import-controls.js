import { ScoreImportClient } from "./score-import-client.js";
import { setText } from "./preferences.js";
export function initializeScoreImport({ find, isBlocked, setBusy, apply }) {
  const client = new ScoreImportClient();
  const file = find("editorScoreFile");
  const part = find("editorImportPart");
  const first = find("editorImportFirst");
  const last = find("editorImportLast");
  const preview = find("editorImportPreview");
  const confirm = find("editorImportApply");
  const cancel = find("editorImportCancel");
  const info = find("editorImportInfo");
  const status = find("editorImportStatus");
  let loaded = null;
  let candidate = null;
  let busy = false;
  let externalBlocked = false;
  let version = 0;
  function refresh() {
    file.disabled = busy || externalBlocked;
    for (const control of [part, first, last, preview])
      control.disabled = !loaded || busy || externalBlocked;
    confirm.disabled = !candidate || busy || externalBlocked;
    cancel.disabled = externalBlocked || (!loaded && !busy);
  }
  function clearPreview() {
    candidate = null;
    find("editorImportWarnings").replaceChildren();
    setText(status, "");
    refresh();
  }
  for (const control of [part, first, last])
    control.addEventListener("change", clearPreview);
  async function run(task) {
    if (busy || isBlocked()) return;
    const current = ++version;
    busy = true;
    setBusy(true);
    refresh();
    try {
      await task(current);
    } catch (error) {
      if (current === version) setText(status, error.message);
    } finally {
      if (current === version) {
        busy = false;
        setBusy(false);
        refresh();
      }
    }
  }
  file.addEventListener("change", () => {
    const chosen = file.files[0];
    file.value = "";
    if (!chosen) return;
    void run(async (current) => {
      candidate = null;
      loaded = null;
      setText(info, "");
      find("editorImportWarnings").replaceChildren();
      setText(status, "Dosya okunuyor…");
      part.replaceChildren();
      const result = await client.open(chosen);
      if (current !== version) return;
      loaded = result;
      for (const item of result.parts) {
        const option = document.createElement("option");
        option.value = item.key;
        option.textContent = item.name;
        part.append(option);
      }
      part.value = result.parts[0].key;
      first.value = 1;
      last.value = Math.min(4, result.measures);
      first.max = last.max = result.measures;
      setText(info, "{name} · {count} ölçü", {
        name: chosen.name,
        count: result.measures,
      });
      setText(status, "Partiyi ve ölçü aralığını seç, ardından önizle.");
      file.value = "";
    });
  });
  preview.addEventListener("click", () => {
    if (!loaded) return;
    void run(async (current) => {
      candidate = null;
      setText(status, "Önizleme hazırlanıyor…");
      const result = await client.convert(
        part.value,
        Number(first.value),
        Number(last.value),
      );
      if (current !== version) return;
      candidate = result.score;
      setText(
        status,
        "{count} adım · {bpm} BPM. İçe aktarma geri alınabilir.",
        {
          count: candidate.events.length,
          bpm: candidate.bpm,
        },
      );
      const warnings = find("editorImportWarnings");
      warnings.replaceChildren();
      for (const warning of result.warnings) {
        const line = document.createElement("li");
        setText(line, warning);
        warnings.append(line);
      }
    });
  });
  confirm.addEventListener("click", () => {
    if (!candidate || busy || isBlocked()) return;
    apply(candidate);
    candidate = null;
    setText(
      status,
      "Tab içe aktarıldı. Geri al ile önceki çalışmana dönebilirsin.",
    );
    refresh();
  });
  function close() {
    version++;
    client.close();
    loaded = candidate = null;
    busy = false;
    part.replaceChildren();
    find("editorImportWarnings").replaceChildren();
    setBusy(false);
    setText(info, "");
    setText(status, "");
    refresh();
  }
  cancel.addEventListener("click", close);
  refresh();
  return {
    close,
    setDisabled(value) {
      externalBlocked = value;
      refresh();
    },
  };
}
