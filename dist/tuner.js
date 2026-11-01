import { LiveTuner } from "./live-tuner.js";
import { describePitch, guitarStrings, midiToFrequency } from "./pitch.js";
import { setText, t } from "./preferences.js";

export function initializeTuner({ onStart, onStop }) {
  const button = document.querySelector("#tunerToggle");
  const selector = document.querySelector("#tunerString");
  const meter = document.querySelector("#tunerMeter");
  let recentFrequencies = [];
  let missedFrames = 0;
  let currentPitch = null;
  let lastStatus = "";

  function showStatus(source) {
    if (source !== lastStatus) {
      setText("#tunerStatus", source);
      lastStatus = source;
    }
  }

  function renderTarget() {
    const selected = selector.value === "auto" ? null : Number(selector.value);
    const target =
      currentPitch?.target ??
      guitarStrings.find((string) => string.midi === selected);
    if (!target) {
      setText("#tunerTarget", "Hedef tel otomatik seçilir");
      return;
    }
    setText("#tunerTarget", "{number}. tel · {note} · {frequency} Hz", {
      number: target.number,
      note: target.note,
      frequency: midiToFrequency(target.midi).toFixed(2),
    });
  }

  function clearReading() {
    currentPitch = null;
    recentFrequencies = [];
    document.querySelector("#tunerNote").textContent = "—";
    document.querySelector("#tunerFrequency").textContent = "— Hz";
    document.querySelector("#tunerCents").textContent = "— cent";
    meter.style.setProperty("--needle-position", "50%");
    meter.dataset.tuning = "waiting";
    meter.setAttribute("aria-valuenow", "0");
    meter.setAttribute("aria-valuetext", t("Nota bekleniyor"));
    renderTarget();
  }

  function renderPitch() {
    if (!currentPitch) return;
    const { frequency, note, cents } = currentPitch;
    document.querySelector("#tunerNote").textContent = note;
    document.querySelector("#tunerFrequency").textContent =
      `${frequency.toFixed(1)} Hz`;
    document.querySelector("#tunerCents").textContent =
      `${cents > 0 ? "+" : ""}${Math.round(cents)} cent`;
    const inTune = Math.abs(cents) <= 5;
    const status = inTune
      ? "Akort doğru"
      : cents < 0
        ? "Pes · teli biraz sık"
        : "Tiz · teli biraz gevşet";
    showStatus(status);
    meter.dataset.tuning = inTune ? "in-tune" : "off";
    meter.style.setProperty(
      "--needle-position",
      `${50 + Math.max(-50, Math.min(50, cents))}%`,
    );
    meter.setAttribute(
      "aria-valuenow",
      String(Math.round(Math.max(-50, Math.min(50, cents)))),
    );
    meter.setAttribute(
      "aria-valuetext",
      `${note}, ${Math.round(cents)} cent, ${t(status)}`,
    );
    renderTarget();
  }

  const microphone = new LiveTuner({
    onPitch(pitch) {
      if (!pitch) {
        if (++missedFrames >= 3) {
          clearReading();
          showStatus("Nota bekleniyor");
        }
        return;
      }
      missedFrames = 0;
      // Yeni nota çalındığında eski notayla ortalama alma.
      if (
        recentFrequencies.length &&
        Math.abs(12 * Math.log2(pitch.frequency / recentFrequencies.at(-1))) > 1
      )
        recentFrequencies = [];
      recentFrequencies.push(pitch.frequency);
      recentFrequencies = recentFrequencies.slice(-3);
      const sorted = [...recentFrequencies].sort(
        (first, second) => first - second,
      );
      const frequency = sorted[Math.floor(sorted.length / 2)];
      currentPitch = describePitch(
        frequency,
        selector.value === "auto" ? null : Number(selector.value),
      );
      renderPitch();
    },
    onEnded() {
      stop();
      showStatus("Mikrofon bağlantısı kesildi. Tekrar başlat.");
    },
  });

  function stop() {
    microphone.stop();
    button.setAttribute("aria-pressed", "false");
    setText(button, "Akort cihazını başlat");
    clearReading();
    showStatus("Akort cihazı kapalı");
    onStop();
  }

  button.addEventListener("click", async () => {
    if (microphone.running) {
      stop();
      return;
    }
    onStart();
    setText(button, "Akort cihazını durdur");
    button.setAttribute("aria-pressed", "true");
    showStatus("Mikrofon hazırlanıyor…");
    try {
      await microphone.start();
      if (microphone.running) showStatus("Nota bekleniyor");
    } catch {
      stop();
      showStatus(
        "Mikrofon başlatılamadı. Tarayıcı iznini ve mikrofon bağlantını kontrol et.",
      );
    }
  });
  selector.addEventListener("change", () => {
    clearReading();
    if (microphone.running) showStatus("Nota bekleniyor");
  });
  document.addEventListener("preferenceschange", () => {
    if (currentPitch) renderPitch();
    else meter.setAttribute("aria-valuetext", t("Nota bekleniyor"));
  });
  clearReading();
  return { stop };
}
