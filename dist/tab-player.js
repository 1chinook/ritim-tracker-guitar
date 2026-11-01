import { createTimeline } from "./tab-model.js";

export class TabPlayer {
  generation = 0;
  playing = false;
  context = null;
  animation = null;

  constructor({ onStep, onStop }) {
    this.onStep = onStep;
    this.onStop = onStop;
  }

  async play(notes, bpm) {
    const events = createTimeline(notes, bpm);
    if (!events.length) return;
    this.stop();
    const generation = this.generation;
    this.playing = true;
    try {
      const context = new AudioContext();
      this.context = context;
      await context.resume();
      if (generation !== this.generation) return;
      const startTime = context.currentTime + 0.08;
      // Sesler ses bağlamının saatine planlanır; setTimeout ile ritim tutulmaz.
      for (const event of events) {
        if (event.frequency === null) continue;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = startTime + event.start;
        const end = start + event.duration * 0.9;
        oscillator.type = "triangle";
        oscillator.frequency.value = event.frequency;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, end);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.01);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      }
      const totalDuration = events.at(-1).start + events.at(-1).duration;
      let previousIndex = -1;
      const updateCursor = () => {
        if (generation !== this.generation) return;
        const elapsed = context.currentTime - startTime;
        if (elapsed >= totalDuration) {
          this.stop();
          return;
        }
        const current = events.find(
          (event) =>
            elapsed >= event.start && elapsed < event.start + event.duration,
        );
        if (current && current.index !== previousIndex) {
          previousIndex = current.index;
          this.onStep(current.index);
        }
        this.animation = requestAnimationFrame(updateCursor);
      };
      updateCursor();
    } catch (error) {
      if (generation === this.generation) {
        this.stop();
        throw error;
      }
    }
  }

  stop() {
    const wasPlaying = this.playing;
    this.playing = false;
    this.generation++;
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => {});
    this.context = null;
    if (wasPlaying) this.onStop();
  }
}
