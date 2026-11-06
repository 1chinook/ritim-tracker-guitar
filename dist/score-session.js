import {
  createEmptyScore,
  validateScore,
  ticksPerBeat,
} from "./score-document.js";
import { maximumNotes } from "./tab-model.js";
import { splitMeasures } from "./score-notation.js";
import { compileScore } from "./score-timeline.js";

// Araya ekleme ölçü sınırındaki uzun bir notayı iki parçaya bölebilir.
// Kimlikler, eklenen adımlar ve sağdaki devam parçası için yeniden üretilir.
function insertAtTick(score, tick, events) {
  if (!events.length) return [];
  const used = new Set(score.events.map((event) => event.id));
  let suffix = 1;
  const freshEvent = (event) => {
    while (used.has(`note-${suffix}`)) suffix++;
    const id = `note-${suffix++}`;
    used.add(id);
    return { ...structuredClone(event), id };
  };
  let position = 0;
  let index = 0;
  while (index < score.events.length && position < tick) {
    const event = score.events[index];
    const end = position + event.durationTicks;
    if (tick < end) {
      const continuation = freshEvent({
        ...event,
        durationTicks: end - tick,
      });
      event.durationTicks = tick - position;
      score.events.splice(index + 1, 0, continuation);
    }
    position = end;
    index++;
  }
  const inserted = events.map(freshEvent);
  score.events.splice(index, 0, ...inserted);
  if (score.events.length > maximumNotes)
    throw new Error("En fazla 128 adım ekleyebilirsin.");
  return inserted.map((event) => event.id);
}

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

  insertEvents(events, afterId = null) {
    const timeline = compileScore(this.document);
    const after = timeline.events.find((event) => event.id === afterId);
    if (afterId !== null && !after) throw new Error("Önce bir adım seç.");
    const tick = after
      ? after.startTicks + after.durationTicks
      : timeline.totalTicks;
    let ids;
    this.change((score) => {
      ids = insertAtTick(score, tick, events);
    });
    return ids;
  }

  insertBefore(id, voice, durationTicks = ticksPerBeat) {
    const event = compileScore(this.document).events.find(
      (event) => event.id === id,
    );
    if (!event) throw new Error("Önce bir adım seç.");
    let ids;
    this.change((score) => {
      ids = insertAtTick(score, event.startTicks, [
        {
          durationTicks,
          notes: voice ? [voice] : [],
        },
      ]);
    });
    return ids[0];
  }

  removeVoices(ids, strings) {
    this.change((score) => {
      for (const event of score.events)
        if (ids.includes(event.id))
          event.notes = event.notes.filter(
            (note) => !strings.includes(note.string),
          );
    });
  }

  removeEvents(ids) {
    this.change((score) => {
      score.events = score.events.filter((event) => !ids.includes(event.id));
    });
  }

  duplicateMeasure(index) {
    const measure = splitMeasures(this.document)[index];
    if (!measure?.segments.length) return [];
    const timeline = compileScore(this.document);
    const tick = Math.min(
      (index + 1) * timeline.measureTicks,
      timeline.totalTicks,
    );
    const events = measure.segments.map(({ durationTicks, eventIndex }) => ({
      durationTicks,
      notes: this.document.events[eventIndex].notes,
    }));
    let ids;
    this.change((score) => {
      ids = insertAtTick(score, tick, events);
    });
    return ids;
  }

  removeEvent(id) {
    this.change((score) => {
      score.events = score.events.filter((event) => event.id !== id);
    });
  }

  linkNotes(firstId, secondId, string, type) {
    const index = this.document.events.findIndex(
      (event) => event.id === firstId,
    );
    const first = this.document.events[index]?.notes.find(
      (note) => note.string === string,
    );
    const next = this.document.events[index + 1];
    const target = next?.notes.find((note) => note.string === string);
    if (
      !["slide", "hammerOn", "pullOff"].includes(type) ||
      next?.id !== secondId ||
      !first ||
      !target
    )
      throw new Error("Aynı telde yan yana iki nota seç.");
    if (
      [first, target].some((note) =>
        note.techniques.some((effect) =>
          ["deadNote", "tremoloPicking", "harmonic"].includes(effect.type),
        ),
      )
    )
      throw new Error(
        "Bağlanacak notalarda ölü nota, harmonik veya tremolo olmamalı.",
      );
    this.setVoice(firstId, {
      ...first,
      techniques: [
        ...first.techniques.filter(
          (effect) =>
            !["bend", "slide", "hammerOn", "pullOff"].includes(effect.type),
        ),
        { type, targetFret: target.fret },
      ],
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
