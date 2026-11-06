// Bağlı notalar aynı ses kaynağında devam eder. İmleç özgün adımları izler.
export function linkedTransition(note, next) {
  const transition = note.techniques.find((effect) =>
    ["slide", "hammerOn", "pullOff"].includes(effect.type),
  );
  const unsupported = [note, next].some((voice) =>
    voice?.techniques.some((effect) =>
      ["deadNote", "tremoloPicking", "harmonic"].includes(effect.type),
    ),
  );
  return transition &&
    next &&
    transition.targetFret === next.fret &&
    !unsupported
    ? transition
    : null;
}

export function buildPerformance(timeline) {
  const voices = [];
  const consumed = new Set();
  timeline.events.forEach((event, index) => {
    for (const note of event.notes) {
      if (consumed.has(index + ":" + note.string)) continue;
      const segments = [{ note, duration: event.duration, offset: 0 }];
      let cursor = index;
      let current = note;
      let duration = event.duration;
      while (cursor + 1 < timeline.events.length) {
        const nextEvent = timeline.events[cursor + 1];
        const next = nextEvent.notes.find(
          (voice) => voice.string === note.string,
        );
        if (!linkedTransition(current, next)) break;
        consumed.add(cursor + 1 + ":" + note.string);
        segments.push({
          note: next,
          duration: nextEvent.duration,
          offset: duration,
        });
        duration += nextEvent.duration;
        current = next;
        cursor++;
      }
      if (current.techniques.some((effect) => effect.type === "letRing")) {
        const next = timeline.events
          .slice(cursor + 1)
          .find((step) =>
            step.notes.some((voice) => voice.string === note.string),
          );
        const end = next ? next.start : timeline.duration + 2;
        duration = Math.max(duration, end - event.start);
        segments.at(-1).duration = duration - segments.at(-1).offset;
      }
      voices.push({
        note: {
          ...note,
          segments,
          bpm: timeline.bpm,
          attackDuration: event.duration,
        },
        start: event.start,
        duration,
        chordSize: event.notes.length,
      });
    }
  });
  return {
    voices,
    duration: Math.max(
      timeline.duration,
      ...voices.map((voice) => voice.start + voice.duration),
    ),
  };
}
