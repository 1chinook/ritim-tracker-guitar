import { detectPitch } from "./pitch.js";

export class LiveTuner {
  running = false;
  generation = 0;
  timer = null;

  constructor({ onPitch, onEnded }) {
    this.onPitch = onPitch;
    this.onEnded = onEnded;
  }

  async start() {
    this.stop();
    const generation = this.generation;
    this.running = true;
    let stream;
    let context;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      // İzin penceresi açıkken kullanıcı durdurduysa mikrofonu açık bırakma.
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      context = new AudioContext();
      this.context = context;
      await context.resume();
      if (generation !== this.generation) return;
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser); // Hoparlöre bağlanmaz: geri besleme yaratmaz.
      const samples = new Float32Array(analyser.fftSize);
      for (const track of stream.getAudioTracks()) {
        track.onended = () => {
          if (this.running) {
            this.stop();
            this.onEnded();
          }
        };
      }
      this.timer = setInterval(() => {
        if (generation !== this.generation) return;
        analyser.getFloatTimeDomainData(samples);
        this.onPitch(detectPitch(samples, context.sampleRate));
      }, 120);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== "closed") await context.close();
      if (generation === this.generation) {
        this.stop();
        throw error;
      }
    }
  }

  stop() {
    this.running = false;
    this.generation++;
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
    if (this.context && this.context.state !== "closed")
      void this.context.close();
    this.context = null;
  }
}
