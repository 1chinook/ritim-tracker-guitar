// Küçük yerel örnek bankası: E2–E6 aralığında üç yarım seste bir kayıt.
// Kaynak ve lisans: sounds/CREDITS.md. Oynatma üçüncü taraf bir sunucuya bağlanmaz.
const sampleBytes = new Map();

export function sampleMidi(midi) {
  return Math.max(40, Math.min(88, 40 + Math.round((midi - 40) / 3) * 3));
}

export async function loadGuitarSamples(context, notes, tone, signal) {
  if (!["distortion", "acoustic"].includes(tone))
    throw new Error("Unknown guitar tone");
  const roots = [
    ...new Set(
      notes
        .filter(
          (note) =>
            !note.techniques.some((effect) => effect.type === "deadNote"),
        )
        .map((note) => sampleMidi(note.midi)),
    ),
  ];
  const samples = new Map();
  await Promise.all(
    roots.map(async (midi) => {
      const url = new URL(`./sounds/${tone}/${midi}.mp3`, import.meta.url);
      const key = url.href;
      let bytes = sampleBytes.get(key);
      if (!bytes) {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error("Guitar sample could not be loaded");
        bytes = await response.arrayBuffer();
        sampleBytes.set(key, bytes);
      }
      signal?.throwIfAborted();
      const buffer = await context.decodeAudioData(bytes.slice(0));
      signal?.throwIfAborted();
      samples.set(midi, { midi, buffer });
    }),
  );
  return samples;
}
