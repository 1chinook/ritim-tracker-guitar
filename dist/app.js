import { analyzeRhythm, AnalysisError } from "./rhythm.js";
import { GuitarRecorder, Metronome } from "./audio.js";

const elements = {
  recordButton: document.querySelector("#recordBtn"),
  analyzeButton: document.querySelector("#analyzeBtn"),
  player: document.querySelector("#audioPlayer"),
  bpm: document.querySelector("#bpmInput"),
  density: document.querySelector("#noteDensity"),
  message: document.querySelector("#message"),
  results: document.querySelector("#results"),
};
const metronome = new Metronome();
let selectedAudio = null;
let audioUrl = null;
let isBusy = false;

function showMessage(message = "") {
  elements.message.textContent = message;
  elements.message.classList.toggle("hidden", !message);
}

function setBusy(busy) {
  isBusy = busy;
  document
    .querySelectorAll(
      ".source, #fileInput, #bpmInput, #noteDensity, #metronomeBtn, #countIn, #demoBtn",
    )
    .forEach((control) => {
      control.disabled = busy;
    });
  elements.analyzeButton.disabled = busy || !selectedAudio;
}

function readTargetBpm() {
  if (!elements.bpm.checkValidity())
    throw new AnalysisError("Hedef tempo 30–240 BPM arasında olmalı.");
  return Number(elements.bpm.value);
}

function selectAudio(blob, filename) {
  if (!blob.size || blob.size > 30 * 1024 * 1024) {
    showMessage("Boş olmayan ve en fazla 30 MB boyutunda bir ses dosyası seç.");
    return;
  }
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(blob);
  selectedAudio = blob;
  elements.player.src = audioUrl;
  document.querySelector("#audioName").textContent = filename;
  document.querySelector("#audioMeta").textContent =
    `${(blob.size / 1024 / 1024).toFixed(1)} MB · analize hazır`;
  const download = document.querySelector("#downloadAudio");
  download.href = audioUrl;
  download.download = filename;
  document.querySelector("#audioReady").classList.remove("hidden");
  elements.results.classList.add("hidden");
  showMessage();
}

const recorder = new GuitarRecorder({
  canvas: document.querySelector("#liveCanvas"),
  onTime(seconds) {
    document.querySelector("#timer").textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  },
  onComplete(blob, extension) {
    selectAudio(blob, `gitar-kaydi.${extension}`);
    setBusy(false);
    elements.recordButton.classList.remove("recording");
    elements.recordButton.setAttribute("aria-label", "Kaydı başlat");
    document.querySelector("#recordStatus").textContent =
      "Kayıt hazır. Dinleyebilir, indirebilir veya analiz edebilirsin.";
  },
  onError(message) {
    showMessage(message);
    setBusy(false);
    elements.recordButton.classList.remove("recording");
  },
});

elements.recordButton.addEventListener("click", async () => {
  if (recorder.isRecording) {
    recorder.stop();
    return;
  }
  if (isBusy) return;
  try {
    const bpm = readTargetBpm();
    setBusy(true);
    showMessage();
    elements.results.classList.add("hidden");
    elements.player.pause();
    metronome.stop();
    updateMetronomeButton();
    elements.recordButton.disabled = true;
    document.querySelector("#recordStatus").textContent =
      "Mikrofon hazırlanıyor…";
    await recorder.prepare();
    if (document.querySelector("#countIn").checked) {
      await metronome.countIn(bpm, (remaining) => {
        document.querySelector("#recordStatus").textContent =
          `Hazır ol: ${remaining}`;
      });
    }
    recorder.start();
    elements.recordButton.classList.add("recording");
    elements.recordButton.setAttribute("aria-label", "Kaydı durdur");
    document.querySelector("#recordStatus").textContent =
      "Kaydediliyor · durdurmak için dokun · en fazla 3 dakika";
  } catch (error) {
    recorder.dispose();
    setBusy(false);
    showMessage(
      error instanceof AnalysisError
        ? error.message
        : "Mikrofon başlatılamadı. Tarayıcı iznini ve mikrofon bağlantını kontrol et.",
    );
    document.querySelector("#recordStatus").textContent =
      "Tekrar deneyebilir veya ses dosyası yükleyebilirsin.";
  } finally {
    elements.recordButton.disabled = false;
  }
});

document.querySelectorAll(".source").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".source").forEach((source) => {
      source.classList.toggle("active", source === button);
      source.setAttribute("aria-pressed", String(source === button));
    });
    document
      .querySelectorAll(".panel")
      .forEach((panel) =>
        panel.classList.toggle(
          "active",
          panel.id === `${button.dataset.mode}Panel`,
        ),
      );
  });
});

function acceptFile(file) {
  if (isBusy || !file) return;
  const isAudio =
    file.type.startsWith("audio/") ||
    /\.(wav|mp3|m4a|ogg|webm|flac)$/i.test(file.name);
  if (!isAudio) {
    showMessage("Bir ses dosyası seç: WAV, MP3, M4A, OGG, WebM veya FLAC.");
    return;
  }
  selectAudio(file, file.name);
  setBusy(false);
}

document
  .querySelector("#fileInput")
  .addEventListener("change", (event) => acceptFile(event.target.files[0]));
const dropzone = document.querySelector("#dropzone");
for (const eventName of ["dragenter", "dragover"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("drag-over");
  });
}
dropzone.addEventListener("dragleave", () =>
  dropzone.classList.remove("drag-over"),
);
dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("drag-over");
  acceptFile(event.dataTransfer.files[0]);
});

function updateMetronomeButton() {
  const button = document.querySelector("#metronomeBtn");
  button.textContent = metronome.isPlaying
    ? "Metronomu durdur"
    : "Metronomu aç";
  button.setAttribute("aria-pressed", String(metronome.isPlaying));
}

document.querySelector("#metronomeBtn").addEventListener("click", async () => {
  try {
    if (metronome.isPlaying) metronome.stop();
    else await metronome.start(readTargetBpm());
    updateMetronomeButton();
  } catch {
    showMessage(
      "Metronom başlatılamadı. BPM değerini ve tarayıcının ses iznini kontrol et.",
    );
  }
});
elements.bpm.addEventListener("input", () => {
  metronome.stop();
  updateMetronomeButton();
});

elements.analyzeButton.addEventListener("click", async () => {
  if (!selectedAudio || isBusy) return;
  let audioContext;
  try {
    const bpm = readTargetBpm();
    setBusy(true);
    elements.recordButton.disabled = true;
    showMessage();
    elements.results.classList.add("hidden");
    elements.analyzeButton.textContent = "Ses analiz ediliyor…";
    metronome.stop();
    updateMetronomeButton();
    audioContext = new AudioContext();
    const buffer = await audioContext.decodeAudioData(
      await selectedAudio.arrayBuffer(),
    );
    // Ters fazdaki stereo kanalları toplamak sesi silebilir; en güçlü kanalı seç.
    let samples = buffer.getChannelData(0);
    let maximumEnergy = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const candidate = buffer.getChannelData(channel);
      let energy = 0;
      for (let index = 0; index < candidate.length; index += 100)
        energy += candidate[index] ** 2;
      if (energy > maximumEnergy) {
        maximumEnergy = energy;
        samples = candidate;
      }
    }
    renderResults(
      analyzeRhythm(
        samples,
        buffer.sampleRate,
        bpm,
        Number(elements.density.value),
      ),
    );
  } catch (error) {
    showMessage(
      error instanceof AnalysisError
        ? error.message
        : "Ses dosyası okunamadı. Başka bir dosya veya WAV biçimini dene.",
    );
  } finally {
    if (audioContext) await audioContext.close();
    elements.analyzeButton.textContent = "Performansı analiz et ↗";
    elements.recordButton.disabled = false;
    setBusy(false);
  }
});

function renderResults(result, isExample = false) {
  document.querySelector("#resultLabel").textContent = isExample
    ? "ÖRNEK VERİ · SENİN KAYDIN DEĞİL"
    : "ANALİZ TAMAMLANDI";
  document.querySelector("#score").textContent = result.consistencyScore;
  document.querySelector("#tempoResult").textContent =
    `${Math.round(result.estimatedBpm)} BPM`;
  document.querySelector("#timingResult").textContent =
    `${Math.round(result.intervalDeviationMs)} ms`;
  document.querySelector("#onsetResult").textContent = result.attackCount;
  document.querySelector("#noteCompare").textContent =
    "Ses içindeki belirgin başlangıçlar";
  const difference = result.estimatedBpm - result.targetBpm;
  document.querySelector("#tempoDelta").textContent =
    `Hedef ${result.targetBpm} BPM · fark ${difference >= 0 ? "+" : ""}${Math.round(difference)} BPM`;
  document.querySelector("#verdict").textContent =
    result.consistencyScore >= 85
      ? "Nota aralıkların tutarlı."
      : "Nota aralıkların değişiyor.";
  document.querySelector("#summary").textContent =
    "Puan, hedef hızdan bağımsız hesaplanır.";
  document.querySelector("#insight").textContent = result.lowConfidence
    ? "Tahmin belirsiz. Suslar, değişen nota süreleri veya arka plan sesleri sonucu etkileyebilir. Eşit aralıklı bir egzersizle tekrar dene."
    : "Bu sonuç eşit aralıklı notalar varsayar. Nota sıklığı seçimi doğruysa hedef tempo ile karşılaştırabilirsin. Tabla nota eşleştirmesi yapılmaz.";
  drawTempoChart(result);
  elements.results.classList.remove("hidden");
  elements.results.scrollIntoView({ behavior: "smooth" });
}

function drawTempoChart(result) {
  const canvas = document.querySelector("#resultCanvas");
  const context = canvas.getContext("2d");
  const padding = 48;
  const minimum =
    Math.min(result.targetBpm, ...result.points.map((point) => point.bpm)) - 10;
  const maximum =
    Math.max(result.targetBpm, ...result.points.map((point) => point.bpm)) + 10;
  const xPosition = (time) =>
    padding + (time / result.duration) * (canvas.width - padding * 2);
  const yPosition = (bpm) =>
    canvas.height -
    padding -
    ((bpm - minimum) / (maximum - minimum)) * (canvas.height - padding * 2);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "14px sans-serif";
  context.fillStyle = "#666a62";
  context.lineWidth = 1;
  for (let line = 0; line < 4; line++) {
    const bpm = minimum + ((maximum - minimum) * line) / 3;
    const y = yPosition(bpm);
    context.strokeStyle = "#d8d6cc";
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(canvas.width - padding, y);
    context.stroke();
    context.fillText(String(Math.round(bpm)), 2, y + 4);
  }
  context.fillText("BPM", 2, 18);
  context.fillText("0 sn", padding, canvas.height - 12);
  context.fillText(
    `${result.duration.toFixed(1)} sn`,
    canvas.width - 90,
    canvas.height - 12,
  );
  context.setLineDash([8, 7]);
  context.strokeStyle = "#899088";
  context.beginPath();
  context.moveTo(padding, yPosition(result.targetBpm));
  context.lineTo(canvas.width - padding, yPosition(result.targetBpm));
  context.stroke();
  context.setLineDash([]);
  context.strokeStyle = "#20483a";
  context.lineWidth = 3;
  context.beginPath();
  result.points.forEach((point, index) => {
    if (index === 0)
      context.moveTo(xPosition(point.time), yPosition(point.bpm));
    else context.lineTo(xPosition(point.time), yPosition(point.bpm));
  });
  context.stroke();
}

document.querySelector("#demoBtn").addEventListener("click", () => {
  renderResults(
    {
      estimatedBpm: 92,
      targetBpm: 90,
      consistencyScore: 94,
      intervalDeviationMs: 35,
      attackCount: 16,
      duration: 11,
      lowConfidence: false,
      points: [89, 90, 92, 91, 94, 93, 92].map((bpm, index) => ({
        time: index * 1.4 + 1,
        bpm,
      })),
    },
    true,
  );
});
document.querySelector("#resetBtn").addEventListener("click", () => {
  elements.results.classList.add("hidden");
  document.querySelector("#calisma").scrollIntoView({ behavior: "smooth" });
});
window.addEventListener("pagehide", () => {
  recorder.dispose();
  metronome.dispose();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
});
