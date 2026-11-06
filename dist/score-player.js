import { buildPerformance } from "./score-performance.js";
import { compileScore } from "./score-timeline.js";
import { scheduleVoice } from "./score-audio.js";
import { loadGuitarSamples, sampleMidi } from "./guitar-samples.js";

export class ScorePlayer {
  generation = 0;
  playing = false;
  context = null;
  animation = null;
  pending = null;

  constructor({ onStep, onStop, loadSamples = loadGuitarSamples }) {
    this.onStep = onStep;
    this.onStop = onStop;
    this.loadSamples = loadSamples;
  }

  async play(document, tone = "distortion") {
    const timeline = compileScore(document);
    if (!timeline.events.length) return;
    const performance = buildPerformance(timeline);
    this.stop();
    const generation = this.generation;
    this.playing = true;
    try {
      const context = new AudioContext();
      this.context = context;
      const pending = new AbortController();
      this.pending = pending;
      await context.resume();
      if (generation !== this.generation) return;
      const samples = await this.loadSamples(
        context,
        timeline.events.flatMap((event) => event.notes),
        tone,
        pending.signal,
      );
      if (generation !== this.generation) return;
      const start = context.currentTime + 0.08;
      for (const voice of performance.voices)
        scheduleVoice(
          context,
          voice.note,
          voice.duration,
          start + voice.start,
          voice.chordSize,
          samples.get(sampleMidi(voice.note.midi)),
        );
      let previous = null;
      const update = () => {
        if (generation !== this.generation) return;
        const elapsed = context.currentTime - start;
        if (elapsed >= performance.duration) {
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
    this.pending?.abort();
    this.pending = null;
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => {});
    this.context = null;
    if (wasPlaying) this.onStop();
  }
}
