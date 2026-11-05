export function selectionBounds(score, anchor, focus) {
  if (!anchor || !focus) return null;
  const start = score.events.findIndex((event) => event.id === anchor.id);
  const end = score.events.findIndex((event) => event.id === focus.id);
  if (start < 0 || end < 0) return null;
  return {
    first: Math.min(start, end),
    last: Math.max(start, end),
    top: Math.min(anchor.string, focus.string),
    bottom: Math.max(anchor.string, focus.string),
  };
}

export function selectedRegion(score, bounds) {
  if (!bounds) return { ids: [], strings: [], events: [] };
  const strings = Array.from(
    { length: bounds.bottom - bounds.top + 1 },
    (_, index) => bounds.top + index,
  );
  const events = score.events.slice(bounds.first, bounds.last + 1);
  return {
    ids: events.map((event) => event.id),
    strings,
    events: events.map((event) => ({
      durationTicks: event.durationTicks,
      notes: structuredClone(
        event.notes.filter((note) => strings.includes(note.string)),
      ),
    })),
  };
}
