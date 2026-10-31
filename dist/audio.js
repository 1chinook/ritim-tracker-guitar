export class Metronome {
  context = null;
  timer = null;

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
    await this.prepare();
    this.tick();
    this.timer = setInterval(() => this.tick(), 60000 / bpm);
  }

  async countIn(bpm, onBeat) {
    await this.prepare();
    for (let remaining = 4; remaining > 0; remaining--) {
      onBeat(remaining);
      this.tick();
      await new Promise((resolve) => setTimeout(resolve, 60000 / bpm));
    }
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
  dispose() {
    this.stop();
    void this.context?.close();
  }
}

export class GuitarRecorder {
  constructor(callbacks) {
    this.callbacks = callbacks;
  }

  get isRecording() {
    return this.recorder?.state === "recording";
  }

  async prepare() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error("Recording unavailable");
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.context = new AudioContext();
    await this.context.resume();
    this.analyser = this.context.createAnalyser();
    this.context.createMediaStreamSource(this.stream).connect(this.analyser);
    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    this.recorder = new MediaRecorder(
      this.stream,
      mimeType ? { mimeType } : {},
    );
  }

  start() {
    const chunks = [];
    let failed = false;
    this.recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    this.recorder.onerror = () => {
      failed = true;
      this.callbacks.onError(
        "Kayıt kesildi. Mikrofon bağlantını kontrol edip tekrar dene.",
      );
      this.dispose();
    };
    this.recorder.onstop = () => {
      const mimeType = this.recorder.mimeType;
      const extension = mimeType.includes("mp4")
        ? "m4a"
        : mimeType.includes("ogg")
          ? "ogg"
          : "webm";
      this.dispose();
      if (!failed)
        this.callbacks.onComplete(
          new Blob(chunks, { type: mimeType }),
          extension,
        );
    };
    this.recorder.start(1000);
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
    clearInterval(this.clock);
    cancelAnimationFrame(this.animation);
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context?.state !== "closed") void this.context?.close();
  }
}
