// Standart gitar akordu: en kalın telden en ince tele, A4 = 440 Hz.
export const guitarStrings = [
  { number: 6, note: "E2", midi: 40 },
  { number: 5, note: "A2", midi: 45 },
  { number: 4, note: "D3", midi: 50 },
  { number: 3, note: "G3", midi: 55 },
  { number: 2, note: "B3", midi: 59 },
  { number: 1, note: "E4", midi: 64 },
];

export function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function describePitch(frequency, selectedMidi = null) {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const fractionalMidi = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(fractionalMidi);
  const names = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ];
  const target =
    selectedMidi === null
      ? guitarStrings.reduce((nearest, string) =>
          Math.abs(string.midi - fractionalMidi) <
          Math.abs(nearest.midi - fractionalMidi)
            ? string
            : nearest,
        )
      : guitarStrings.find((string) => string.midi === selectedMidi);
  if (!target) return null;
  return {
    frequency,
    note: `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`,
    target,
    targetFrequency: midiToFrequency(target.midi),
    cents: 100 * (fractionalMidi - target.midi),
  };
}

// YIN: periyodun fark fonksiyonunu kümülatif ortalamayla normalize ederiz.
// İlk güvenilir çukur temel periyodu seçer; parabolik ara değer hassasiyeti artırır.
export function detectPitch(input, sampleRate) {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || input.length < 1024)
    return null;
  const stride = Math.max(1, Math.floor(sampleRate / 12000));
  const rate = sampleRate / stride;
  const samples = new Float32Array(Math.floor(input.length / stride));
  let energy = 0;
  let mean = 0;
  for (let index = 0; index < samples.length; index++) {
    samples[index] = input[index * stride];
    mean += samples[index];
  }
  mean /= samples.length;
  for (let index = 0; index < samples.length; index++) {
    samples[index] -= mean;
    energy += samples[index] ** 2;
  }
  if (Math.sqrt(energy / samples.length) < 0.008) return null;

  const minimumLag = Math.max(2, Math.floor(rate / 1200));
  const maximumLag = Math.min(
    Math.ceil(rate / 65),
    Math.floor(samples.length / 2),
  );
  const windowSize = samples.length - maximumLag - 1;
  const difference = new Float64Array(maximumLag + 1);
  let cumulative = 0;
  for (let lag = 1; lag <= maximumLag; lag++) {
    let sum = 0;
    for (let index = 0; index < windowSize; index++) {
      sum += (samples[index] - samples[index + lag]) ** 2;
    }
    cumulative += sum;
    difference[lag] = cumulative > 0 ? (sum * lag) / cumulative : 1;
  }
  for (let lag = minimumLag; lag < maximumLag; lag++) {
    if (difference[lag] >= 0.15) continue;
    while (lag + 1 < maximumLag && difference[lag + 1] < difference[lag]) lag++;
    if (lag >= maximumLag) return null;
    const left = difference[lag - 1];
    const center = difference[lag];
    const right = difference[lag + 1];
    const curvature = left - 2 * center + right;
    const offset = curvature === 0 ? 0 : (left - right) / (2 * curvature);
    const frequency = rate / (lag + Math.max(-1, Math.min(1, offset)));
    if (frequency < 65 || frequency > 1200) return null;
    return { frequency, confidence: 1 - center };
  }
  return null;
}
