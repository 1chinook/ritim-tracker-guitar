import {
  createEmptyScore,
  validateScore,
  ticksPerBeat,
} from "./score-document.js";
import { maximumNotes } from "./tab-model.js";
import { splitMeasures } from "./score-notation.js";

// Bütün düzenlemeler tek doğrulama ve geçmiş katmanından geçer.
export class ScoreSession {
  past = [];
  future = [];

  constructor(score = createEmptyScore()) {
    this.document = validateScore(score);
  }

  change(edit) {
    const previous = this.document;
    const candidate = structuredClone(previous);
    edit(candidate);
    const next = validateScore(candidate);
    if (JSON.stringify(next) === JSON.stringify(previous)) return;
    this.past.push(previous);
    this.past = this.past.slice(-50);
    this.future = [];
    this.document = next;
  }

  undo() {
    if (!this.past.length) return;
    this.future.push(this.document);
    this.document = this.past.pop();
  }

  redo() {
    if (!this.future.length) return;
    this.past.push(this.document);
    this.document = this.future.pop();
  }

  add(voice, durationTicks = ticksPerBeat) {
    let id;
    this.change((score) => {
      if (score.events.length >= maximumNotes)
        throw new Error("En fazla 128 adım ekleyebilirsin.");
      let number = 1;
      while (score.events.some((event) => event.id === `note-${number}`))
        number++;
      id = `note-${number}`;
      score.events.push({
        id,
        durationTicks,
        notes: voice ? [structuredClone(voice)] : [],
      });
    });
    return id;
  }

  setVoice(id, voice) {
    this.change((score) => {
      const event = score.events.find((event) => event.id === id);
      if (!event) throw new Error("Önce bir adım seç.");
      const index = event.notes.findIndex(
        (note) => note.string === voice.string,
      );
      if (index < 0) event.notes.push(structuredClone(voice));
      else event.notes[index] = structuredClone(voice);
    });
  }

  insertSequence(voices, durationTicks, afterId = null) {
    let lastId;
    this.change((score) => {
      if (score.events.length + voices.length > maximumNotes)
        throw new Error("En fazla 128 adım ekleyebilirsin.");
      const used = new Set(score.events.map((event) => event.id));
      let number = 1;
      const events = voices.map((voice) => {
        while (used.has(`note-${number}`)) number++;
        lastId = `note-${number++}`;
        used.add(lastId);
        return {
          id: lastId,
          durationTicks,
          notes: voice ? [structuredClone(voice)] : [],
        };
      });
      const index =
        afterId === null
          ? score.events.length
          : score.events.findIndex((event) => event.id === afterId) + 1;
      if (afterId !== null && index === 0)
        throw new Error("Önce bir adım seç.");
      score.events.splice(index, 0, ...events);
    });
    return lastId;
  }

  removeVoice(id, string) {
    this.change((score) => {
      const event = score.events.find((event) => event.id === id);
      if (event)
        event.notes = event.notes.filter((note) => note.string !== string);
    });
  }

  removeEvent(id) {
    this.change((score) => {
      score.events = score.events.filter((event) => event.id !== id);
    });
  }

  removeMeasure(index) {
    const measure = splitMeasures(this.document)[index];
    if (!measure?.segments.length) return;

    const removedTicks = new Map(
      measure.segments.map(({ id, durationTicks }) => [id, durationTicks]),
    );
    this.change((score) => {
      for (const event of score.events)
        event.durationTicks -= removedTicks.get(event.id) ?? 0;
      score.events = score.events.filter((event) => event.durationTicks > 0);
    });
  }

  duplicate(id) {
    let copiedId;
    this.change((score) => {
      if (score.events.length >= maximumNotes)
        throw new Error("En fazla 128 adım ekleyebilirsin.");
      const index = score.events.findIndex((event) => event.id === id);
      if (index < 0) return;
      let suffix = 1;
      while (score.events.some((event) => event.id === `copy-${suffix}`))
        suffix++;
      copiedId = `copy-${suffix}`;
      score.events.splice(index + 1, 0, {
        ...structuredClone(score.events[index]),
        id: copiedId,
      });
    });
    return copiedId;
  }
}
