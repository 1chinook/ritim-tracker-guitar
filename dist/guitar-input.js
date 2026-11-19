export function inputConstraints({ deviceId = "" } = {}) {
  const audio = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 2 },
  };
  if (deviceId) audio.deviceId = { exact: deviceId };
  return { audio };
}

export function measureInput(samples) {
  let peak = 0;
  let energy = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
    energy += sample * sample;
  }
  const rms = samples.length ? Math.sqrt(energy / samples.length) : 0;
  return { peak, db: rms > 0 ? Math.max(-72, 20 * Math.log10(rms)) : -72 };
}

// Seviye ölçümü ve kayıt aynı mono sinyali kullanır. Hoparlöre bağlantı yoktur.
export function routeInput(context, stream, channel, channelCount) {
  if (!["left", "right", "mix"].includes(channel))
    throw new Error("Geçerli bir giriş kanalı seç.");
  if (channel === "right" && !(channelCount >= 2))
    throw new Error(
      "Sağ kanal için iki giriş kanalı gerekli. Sol kanalı seç veya ses kartının ayarlarını kontrol et.",
    );
  const source = context.createMediaStreamSource(stream);
  const mono = context.createGain();
  mono.channelCount = 1;
  mono.channelCountMode = "explicit";
  let splitter;
  if (channel === "mix") source.connect(mono);
  else {
    splitter = context.createChannelSplitter(Math.max(2, channelCount || 2));
    source.connect(splitter);
    splitter.connect(mono, channel === "right" ? 1 : 0, 0);
  }
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  const destination = context.createMediaStreamDestination();
  destination.channelCount = 1;
  destination.channelCountMode = "explicit";
  mono.connect(analyser);
  analyser.connect(destination);
  return {
    analyser,
    stream: destination.stream,
    nodes: [source, splitter, mono, analyser, destination].filter(Boolean),
  };
}

export class GuitarInput {
  generation = 0;
  running = false;
  constructor({ onLevel = () => {}, onEnded = () => {} } = {}) {
    this.onLevel = onLevel;
    this.onEnded = onEnded;
  }
  async open(options = {}) {
    this.close();
    const generation = this.generation;
    this.running = true;
    let stream;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Ses girişi bu tarayıcıda kullanılamıyor. HTTPS veya yerel sunucu kullan.",
        );
      stream = await navigator.mediaDevices.getUserMedia(
        inputConstraints(options),
      );
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return null;
      }
      this.rawStream = stream;
      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState === "ended")
        throw new Error("Ses girişi bağlantısı kesildi. Tekrar başlat.");
      const settings = track.getSettings?.() ?? {};
      const context = new AudioContext();
      this.context = context;
      await context.resume();
      if (generation !== this.generation) return null;
      if (track.readyState === "ended")
        throw new Error("Ses girişi bağlantısı kesildi. Tekrar başlat.");
      this.route = routeInput(
        context,
        stream,
        options.channel ?? "left",
        settings.channelCount,
      );
      this.analyser = this.route.analyser;
      this.stream = this.route.stream;
      for (const inputTrack of stream.getAudioTracks())
        inputTrack.onended = () => {
          if (generation !== this.generation) return;
          this.close();
          this.onEnded();
        };
      const samples = new Float32Array(2048);
      let clipUntil = 0;
      this.timer = setInterval(() => {
        if (generation !== this.generation) return;
        this.analyser.getFloatTimeDomainData(samples);
        const level = measureInput(samples);
        if (level.peak >= 0.98) clipUntil = performance.now() + 1000;
        this.onLevel({ ...level, clipped: performance.now() < clipUntil });
      }, 80);
      return {
        label: track.label,
        channels: settings.channelCount,
        sampleRate: context.sampleRate,
        processing: [
          settings.echoCancellation,
          settings.noiseSuppression,
          settings.autoGainControl,
        ],
      };
    } catch (error) {
      if (generation !== this.generation) return null;
      this.close();
      throw error;
    }
  }
  close() {
    this.generation++;
    this.running = false;
    clearInterval(this.timer);
    for (const track of this.rawStream?.getTracks() ?? []) {
      track.onended = null;
      track.stop();
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.route?.nodes.forEach((node) => node.disconnect());
    if (this.context && this.context.state !== "closed")
      void this.context.close();
    this.rawStream =
      this.stream =
      this.route =
      this.analyser =
      this.context =
        null;
    this.onLevel(null);
  }
}

export function inputError(error) {
  if (error.name === "NotAllowedError" || error.name === "SecurityError")
    return "Ses girişine izin verilmedi. Tarayıcının mikrofon iznini kontrol et.";
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError")
    return "Seçili ses girişi bulunamadı. Ses kartını bağla ve girişleri yenile.";
  if (error.name === "NotReadableError")
    return "Ses kartı açılamadı. Başka bir uygulama kullanıyor olabilir; aygıt ve sürücü ayarlarını kontrol et.";
  const ownMessages = [
    "Geçerli bir giriş kanalı seç.",
    "Sağ kanal için iki giriş kanalı gerekli. Sol kanalı seç veya ses kartının ayarlarını kontrol et.",
    "Ses girişi bu tarayıcıda kullanılamıyor. HTTPS veya yerel sunucu kullan.",
    "Ses girişi bağlantısı kesildi. Tekrar başlat.",
    "Ses kaydı bu tarayıcıda desteklenmiyor.",
  ];
  return ownMessages.includes(error.message)
    ? error.message
    : "Ses girişi başlatılamadı. Bağlantıyı kontrol edip tekrar dene.";
}
