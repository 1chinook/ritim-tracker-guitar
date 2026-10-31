export class AnalysisError extends Error {}

function median(values) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function detectAttacks(samples, sampleRate) {
  const frameSize = Math.round(sampleRate * 0.01);
  const envelope = [];
  for (
    let offset = 0;
    offset + frameSize <= samples.length;
    offset += frameSize
  ) {
    let squaredSum = 0;
    for (let index = offset; index < offset + frameSize; index++)
      squaredSum += samples[index] ** 2;
    envelope.push(Math.sqrt(squaredSum / frameSize));
  }
  const peak = envelope.reduce((highest, value) => Math.max(highest, value), 0);
  if (peak < 0.005)
    throw new AnalysisError(
      "Kayıt sessiz veya ses seviyesi çok düşük. Mikrofona yaklaşarak tekrar dene.",
    );

  // Sabit ses yerine, enerjideki ani yükselişleri nota başlangıcı sayarız.
  const attacks = [];
  let previousAttack = -Infinity;
  for (let index = 2; index < envelope.length; index++) {
    const baseline = (envelope[index - 1] + envelope[index - 2]) / 2;
    const time = (index * frameSize) / sampleRate;
    const isAttack =
      envelope[index] > Math.max(0.004, peak * 0.12, baseline * 1.8);
    if (isAttack && time - previousAttack >= 0.09) {
      attacks.push(time);
      previousAttack = time;
    }
  }
  return attacks;
}

export function analyzeRhythm(
  samples,
  sampleRate,
  targetBpm,
  notesPerBeat = 1,
) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !samples.length)
    throw new AnalysisError("Ses verisi okunamadı.");
  if (!Number.isFinite(targetBpm) || targetBpm < 30 || targetBpm > 240)
    throw new AnalysisError("Hedef tempo 30–240 BPM arasında olmalı.");
  if (![1, 2, 4].includes(notesPerBeat))
    throw new AnalysisError("Geçerli bir nota sıklığı seç.");
  const duration = samples.length / sampleRate;
  if (duration < 3 || duration > 180)
    throw new AnalysisError("3 saniye ile 3 dakika arasında bir kayıt kullan.");

  const attacks = detectAttacks(samples, sampleRate);
  if (attacks.length < 5)
    throw new AnalysisError(
      "Yeterli belirgin nota başlangıcı bulunamadı. En az 5 notayı eşit aralıklarla çal.",
    );
  const intervals = attacks
    .slice(1)
    .map((time, index) => time - attacks[index]);
  const typicalInterval = median(intervals);
  const intervalDeviation = Math.sqrt(
    intervals.reduce(
      (sum, interval) => sum + (interval - typicalInterval) ** 2,
      0,
    ) / intervals.length,
  );
  const estimatedBpm = 60 / (typicalInterval * notesPerBeat);
  if (estimatedBpm < 30 || estimatedBpm > 300)
    throw new AnalysisError(
      "Tempo tahmin edilemedi. Nota sıklığını kontrol edip eşit aralıklarla çal.",
    );

  // Tutarlılık puanı, hedef BPM'den bağımsızdır. Farklı hızda düzenli çalmak mümkündür.
  return {
    estimatedBpm,
    targetBpm,
    duration,
    consistencyScore: Math.max(
      0,
      Math.round(100 * (1 - Math.min(1, intervalDeviation / typicalInterval))),
    ),
    intervalDeviationMs: intervalDeviation * 1000,
    attackCount: attacks.length,
    points: intervals.map((interval, index) => ({
      time: attacks[index + 1],
      bpm: 60 / (interval * notesPerBeat),
    })),
    lowConfidence: intervalDeviation / typicalInterval > 0.25,
  };
}
