export const guitarTunings = [
  { id: "standard", name: "Standart E", notes: [64, 59, 55, 50, 45, 40] },
  { id: "dropD", name: "Drop D", notes: [64, 59, 55, 50, 45, 38] },
  { id: "eb", name: "Yarım ses pes", notes: [63, 58, 54, 49, 44, 39] },
  { id: "d", name: "D standard", notes: [62, 57, 53, 48, 43, 38] },
  { id: "dropC", name: "Drop C", notes: [62, 57, 53, 48, 43, 36] },
  { id: "dadgad", name: "DADGAD", notes: [62, 57, 55, 50, 45, 38] },
  { id: "openG", name: "Open G", notes: [62, 59, 55, 50, 43, 38] },
  { id: "openD", name: "Open D", notes: [62, 57, 54, 50, 45, 38] },
];
export function matchingTuning(notes) {
  return (
    guitarTunings.find((preset) =>
      preset.notes.every((midi, index) => midi === notes[index]),
    )?.id ?? "custom"
  );
}
export function parseTuning(text) {
  const names = text
    .trim()
    .replaceAll("♯", "#")
    .replaceAll("♭", "b")
    .split(/[\s,]+/);
  if (names.length !== 6)
    throw new Error(
      "İnce telden kalın tele altı nota yaz. Örnek E4 B3 G3 D3 A2 E2.",
    );
  const pitches = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return names.map((name) => {
    const match = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name);
    if (!match)
      throw new Error("Akort notalarını oktavlarıyla yaz. Örnek D2 veya F#3.");
    const midi =
      (Number(match[3]) + 1) * 12 +
      pitches[match[1].toUpperCase()] +
      (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0);
    if (midi < 0 || midi > 103)
      throw new Error("Akort notası desteklenen aralığın dışında.");
    return midi;
  });
}
