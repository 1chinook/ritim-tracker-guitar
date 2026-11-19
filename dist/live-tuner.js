import { detectPitch } from "./pitch.js";
import { GuitarInput } from "./guitar-input.js";

export class LiveTuner {
  running = false;
  generation = 0;
  timer = null;
  context = null;
  constructor({ onPitch, onEnded, onLevel, onInputReady = () => {} }) {
    this.onPitch = onPitch;
    this.onEnded = onEnded;
    this.onInputReady = onInputReady;
    this.input = new GuitarInput({
      onLevel,
      onEnded: () => {
        this.stop();
        this.onEnded();
      },
    });
  }
  async start(options) {
    this.stop();
    const generation = this.generation;
    this.running = true;
    try {
      const info = await this.input.open(options);
      if (!info || generation !== this.generation) return;
      this.context = this.input.context;
      this.onInputReady(info);
      const analyser = this.input.analyser;
      analyser.fftSize = 8192;
      const samples = new Float32Array(analyser.fftSize);
      this.timer = setInterval(() => {
        if (generation !== this.generation) return;
        analyser.getFloatTimeDomainData(samples);
        this.onPitch(detectPitch(samples, this.context.sampleRate));
      }, 120);
    } catch (error) {
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
    this.input.close();
    this.context = null;
  }
}
