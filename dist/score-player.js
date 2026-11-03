import { compileScore } from "./score-timeline.js";
import { scheduleVoice } from "./score-audio.js";

export class ScorePlayer {
  generation = 0;
  playing = false;
  context = null;
  animation = null;

  constructor({ onStep, onStop }) {
    this.onStep = onStep;
    this.onStop = onStop;
  }

  async play(document) {
    const timeline = compileScore(document);
    if (!timeline.events.length) return;
    this.stop();
    const generation = this.generation;
    this.playing = true;
    try {
      const context = new AudioContext();
      this.context = context;
      await context.resume();
      if (generation !== this.generation) return;
      const start = context.currentTime + 0.08;
      for (const event of timeline.events) {
        event.notes.forEach((note) =>
          scheduleVoice(
            context,
            note,
            event.duration,
            start + event.start,
            event.notes.length,
          ),
        );
      }
      let previous = null;
      const update = () => {
        if (generation !== this.generation) return;
        const elapsed = context.currentTime - start;
        if (elapsed >= timeline.duration) {
          this.stop();
          return;
        }
        const event = timeline.events.find(
          (event) =>
            elapsed >= event.start && elapsed < event.start + event.duration,
        );
        if (event && event.id !== previous) {
          previous = event.id;
          this.onStep(event.id);
        }
        this.animation = requestAnimationFrame(update);
      };
      update();
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
