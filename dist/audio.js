import { GuitarInput } from "./guitar-input.js";

export class Metronome {
  context = null;
  timer = null;
  generation = 0;
  countTimer = null;
  countFinish = null;

  get isPlaying() {
    return this.timer !== null;
  }

  async prepare() {
    this.context ??= new AudioContext();
    await this.context.resume();
  }

  tick() {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.frequency.value = 1000;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.06);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  async start(bpm) {
    this.stop();
    const generation = this.generation;
    await this.prepare();
    if (generation !== this.generation) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), 60000 / bpm);
  }

  async countIn(bpm, onBeat) {
    this.stop();
    const generation = this.generation;
    await this.prepare();
    for (let remaining = 4; remaining > 0; remaining--) {
      if (generation !== this.generation) return false;
      onBeat(remaining);
      this.tick();
      await new Promise((resolve) => {
        this.countFinish = resolve;
        this.countTimer = setTimeout(() => {
          this.countFinish = null;
          resolve();
        }, 60000 / bpm);
      });
    }
    return generation === this.generation;
  }

  stop() {
    this.generation++;
    clearTimeout(this.countTimer);
    this.countFinish?.();
    this.countFinish = null;
    clearInterval(this.timer);
    this.timer = null;
  }
  dispose() {
    this.stop();
    void this.context?.close();
  }
}

export class GuitarRecorder {
  generation = 0;
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.input = new GuitarInput({
      onLevel: (level) => this.callbacks.onLevel?.(level),
      onEnded: () => this.fail(),
    });
  }
  get isRecording() {
    return this.recorder?.state === "recording";
  }
  async prepare(options) {
    this.dispose();
    const generation = this.generation;
    if (!globalThis.MediaRecorder)
      throw new Error("Ses kaydı bu tarayıcıda desteklenmiyor.");
    const info = await this.input.open(options);
    if (!info || generation !== this.generation) return null;
    try {
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      this.recorder = new MediaRecorder(
        this.input.stream,
        mimeType ? { mimeType } : {},
      );
      this.analyser = this.input.analyser;
      return info;
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  fail() {
    this.dispose();
    this.callbacks.onError(
      "Kayıt kesildi. Ses kartı veya giriş bağlantını kontrol edip tekrar dene.",
    );
  }
  start() {
    if (!this.recorder || !this.input.running)
      throw new Error("Ses girişi bağlantısı kesildi. Tekrar başlat.");
    const recorder = this.recorder;
    const generation = this.generation;
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      if (generation === this.generation) this.fail();
    };
    recorder.onstop = () => {
      if (generation !== this.generation) return;
      const mimeType = recorder.mimeType;
      const extension = mimeType.includes("mp4")
        ? "m4a"
        : mimeType.includes("ogg")
          ? "ogg"
          : "webm";
      this.dispose();
      this.callbacks.onComplete(
        new Blob(chunks, { type: mimeType }),
        extension,
      );
    };
    recorder.start(1000);
    this.startedAt = performance.now();
    this.callbacks.onTime(0);
    this.clock = setInterval(() => {
      const seconds = Math.floor((performance.now() - this.startedAt) / 1000);
      this.callbacks.onTime(seconds);
      if (seconds >= 180) this.stop();
    }, 250);
    this.drawWaveform();
  }
  drawWaveform() {
    const canvas = this.callbacks.canvas;
    const context = canvas.getContext("2d");
    const samples = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(samples);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    context.strokeStyle = "#20483a";
    context.lineWidth = 2;
    samples.forEach((value, index) => {
      const x = (index / samples.length) * canvas.width;
      const y = (value / 255) * canvas.height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    this.animation = requestAnimationFrame(() => this.drawWaveform());
  }
  stop() {
    if (this.isRecording) this.recorder.stop();
  }
  dispose() {
    this.generation++;
    clearInterval(this.clock);
    if (this.animation !== undefined) cancelAnimationFrame(this.animation);
    this.animation = undefined;
    if (this.recorder) {
      this.recorder.ondataavailable =
        this.recorder.onerror =
        this.recorder.onstop =
          null;
      if (this.recorder.state === "recording") this.recorder.stop();
    }
    this.recorder = null;
    this.input.close();
  }
}
