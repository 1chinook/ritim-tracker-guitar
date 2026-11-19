import { GuitarInput, inputError } from "./guitar-input.js";
import { setText } from "./preferences.js";

export function initializeInputControls({ onStart, onStop }) {
  const find = (id) => document.querySelector(`#${id}`);
  const device = find("inputDevice");
  const channel = find("inputChannel");
  const toggle = find("inputTest");
  const refresh = find("inputRefresh");
  const meter = find("inputLevel");
  const levelText = find("inputLevelValue");
  let active = false;
  let blocked = false;
  let disposed = false;
  let listing = 0;
  let lastLevelStatus = "";
  try {
    const saved = JSON.parse(localStorage.getItem("ritim-audio-input-v1"));
    if (typeof saved?.deviceId === "string")
      device.dataset.saved = saved.deviceId;
    if (["left", "right", "mix"].includes(saved?.channel))
      channel.value = saved.channel;
  } catch {
    /* Tercih kaydedilemezse varsayılan giriş kullanılabilir. */
  }
  const options = () => ({
    deviceId: device.dataset.saved ?? device.value,
    channel: channel.value,
  });
  function setLevel(level) {
    const db = Math.min(0, level?.db ?? -72);
    meter.style.setProperty("--input-level", `${((db + 72) / 72) * 100}%`);
    meter.setAttribute("aria-valuenow", String(Math.round(db)));
    levelText.textContent =
      level && db > -72 ? `${db.toFixed(0)} dBFS` : "— dBFS";
    const state = !level
      ? "idle"
      : level.clipped
        ? "clip"
        : db < -60
          ? "silent"
          : db < -40
            ? "low"
            : "good";
    meter.dataset.level = state;
    const status = {
      idle: "Giriş kapalı",
      clip: "Sinyal kırpılıyor · ses kartındaki gain değerini azalt.",
      silent: "Sinyal bekleniyor · gitarı çal ve doğru kanalı kontrol et.",
      low: "Sinyal düşük · ses kartındaki giriş seviyesini kontrol et.",
      good: "Sinyal alınıyor",
    }[state];
    if (status !== lastLevelStatus) {
      lastLevelStatus = status;
      setText("#inputLevelStatus", status);
    }
  }
  function sync() {
    device.disabled = channel.disabled = blocked || active;
    refresh.disabled = blocked || active;
    toggle.disabled = blocked && !active;
    toggle.setAttribute("aria-pressed", String(active));
    setText(toggle, active ? "Giriş testini durdur" : "Girişi test et");
  }
  function showConnection(info) {
    if (!info) return;
    setText("#inputConnection", "{name} · {channels} kanal · {rate} Hz", {
      name: info.label || "Audio input",
      channels: info.channels ?? "?",
      rate: info.sampleRate,
    });
    const processing = info.processing.some((value) => value === true)
      ? "Tarayıcıda otomatik ses işleme açık. Ses kartı ve tarayıcı ayarlarını kontrol et."
      : info.processing.every((value) => value === false)
        ? "Yankı giderme, gürültü bastırma ve otomatik gain kapalı."
        : "Otomatik ses işleme kapalı istendi; tarayıcı tüm ayarların durumunu bildirmiyor.";
    setText("#inputProcessing", processing);
    void listDevices();
  }
  const preview = new GuitarInput({
    onLevel: setLevel,
    onEnded() {
      stop();
      setText("#inputStatus", "Ses girişi bağlantısı kesildi. Tekrar başlat.");
    },
  });
  function stop() {
    const wasActive = active;
    active = false;
    preview.close();
    if (wasActive) onStop();
    sync();
  }
  async function listDevices() {
    const current = ++listing;
    try {
      if (!navigator.mediaDevices?.enumerateDevices)
        throw new Error(
          "Ses girişi bu tarayıcıda kullanılamıyor. HTTPS veya yerel sunucu kullan.",
        );
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (disposed || current !== listing) return;
      const chosen = device.dataset.saved ?? device.value;
      device.replaceChildren();
      const add = (value, label, parameters) => {
        const option = document.createElement("option");
        option.value = value;
        setText(option, label, parameters);
        device.append(option);
      };
      add("", "Sistem varsayılanı");
      let number = 0;
      for (const entry of devices.filter(
        (entry) =>
          entry.kind === "audioinput" &&
          entry.deviceId &&
          !["default", "communications"].includes(entry.deviceId),
      )) {
        number++;
        if (entry.label) add(entry.deviceId, entry.label);
        else add(entry.deviceId, "Ses girişi {number}", { number });
      }
      if (
        chosen &&
        ![...device.options].some((option) => option.value === chosen)
      )
        add(chosen, "Seçili giriş · bağlantı veya izin gerekli");
      device.value = chosen;
      delete device.dataset.saved;
      sync();
    } catch (error) {
      if (!disposed && current === listing)
        setText("#inputStatus", inputError(error));
    }
  }
  for (const element of [device, channel])
    element.addEventListener("change", () => {
      if (element === device) delete device.dataset.saved;
      try {
        localStorage.setItem("ritim-audio-input-v1", JSON.stringify(options()));
      } catch {
        /* İsteğe bağlı tercih kaydı. */
      }
      setText("#inputConnection", "");
      setText("#inputProcessing", "");
      setText("#inputStatus", "Seçimi doğrulamak için girişi test et.");
      setLevel(null);
    });
  toggle.addEventListener("click", async () => {
    if (active) {
      stop();
      setText("#inputStatus", "Giriş testi durduruldu.");
      return;
    }
    if (blocked || disposed) return;
    active = true;
    onStart();
    sync();
    setText("#inputStatus", "Ses girişi hazırlanıyor…");
    try {
      const info = await preview.open(options());
      if (!info || !active || disposed) return;
      showConnection(info);
      setText(
        "#inputStatus",
        "Giriş testi açık · ses kaydedilmez ve hoparlöre verilmez.",
      );
    } catch (error) {
      stop();
      setText("#inputStatus", inputError(error));
    }
  });
  refresh.addEventListener("click", () => {
    void listDevices();
  });
  const deviceChange = () => {
    void listDevices();
  };
  navigator.mediaDevices?.addEventListener?.("devicechange", deviceChange);
  setLevel(null);
  sync();
  void listDevices();
  return {
    options,
    setLevel,
    showConnection,
    setDisabled(value) {
      blocked = value;
      sync();
    },
    dispose() {
      disposed = true;
      listing++;
      stop();
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        deviceChange,
      );
    },
  };
}
