import {
  createEmptyScore,
  validateScore,
  ticksPerBeat,
} from "./score-document.js";
import { maximumNotes } from "./tab-model.js";

export const importFileLimit = 10 * 1024 * 1024;
const requireImport = (condition, message) => {
  if (!condition) throw new Error(message);
};

// alphaTab tel numaralarını kalından inceye, akort dizisini inceden kalına tutar.
export function listImportParts(source) {
  const parts = [];
  source.tracks.forEach((track, trackIndex) => {
    track.staves.forEach((staff, staffIndex) => {
      if (staff.isPercussion || ![0, 6].includes(staff.tuning.length)) return;
      const voices = new Set();
      for (const bar of staff.bars)
        bar.voices.forEach((voice, index) => {
          if (voice.beats.some((beat) => !beat.isEmpty)) voices.add(index);
        });
      for (const voice of voices)
        parts.push({
          key: trackIndex + "/" + staffIndex + "/" + voice,
          name:
            (track.name || "Guitar") +
            " · " +
            (staffIndex + 1) +
            " / " +
            (voice + 1),
          track: trackIndex,
          staff: staffIndex,
          voice,
        });
    });
  });
  return parts;
}

function placeNotes(notes, tuning) {
  let best = null;
  let bestCost = Infinity;
  const candidates = notes.map((note) => {
    if (note.string > 0 && Number.isInteger(note.fret) && note.fret >= 0)
      return [{ string: 7 - note.string, fret: note.fret }];
    const pitch = note.realValueWithoutHarmonic;
    return tuning.flatMap((open, index) => {
      const fret = pitch - open;
      return Number.isInteger(fret) && fret >= 0 && fret <= 24
        ? [{ string: index + 1, fret }]
        : [];
    });
  });
  const visit = (index, used, placed, cost) => {
    if (cost >= bestCost) return;
    if (index === candidates.length) {
      best = placed.slice();
      bestCost = cost;
      return;
    }
    for (const candidate of candidates[index]) {
      if (
        candidate.string < 1 ||
        candidate.string > 6 ||
        candidate.fret > 24 ||
        used.has(candidate.string)
      )
        continue;
      used.add(candidate.string);
      placed.push(candidate);
      visit(
        index + 1,
        used,
        placed,
        cost + candidate.fret + 0.01 * candidate.string,
      );
      placed.pop();
      used.delete(candidate.string);
    }
  };
  visit(0, new Set(), [], 0);
  requireImport(
    best !== null,
    "Bu notalar altı tel ve 0–24 perde aralığına yerleştirilemiyor.",
  );
  return best;
}

function importedTechniques(note, beat, warnings) {
  if (note.isDead) return [{ type: "deadNote" }];
  const effects = [];
  if (note.isPalmMute || beat.isPalmMute) effects.push({ type: "palmMute" });
  if (note.isLetRing || beat.isLetRing) effects.push({ type: "letRing" });
  if (note.vibrato || beat.vibrato)
    effects.push({ type: "vibrato", depthCents: 30, rateHz: 5 });
  if (beat.tap) effects.push({ type: "tapping" });
  if (beat.pickStroke)
    effects.push({
      type: "pickDirection",
      direction: beat.pickStroke === 1 ? "up" : "down",
    });
  if (beat.tremoloPicking) {
    const subdivision = beat.tremoloPicking.getDuration(beat.duration);
    if ([8, 16, 32].includes(subdivision))
      effects.push({ type: "tremoloPicking", subdivision });
    else warnings.add("Bazı teknikler bu sürümde gösterilemiyor.");
  }
  if (note.harmonicType) {
    if (note.harmonicType === 1 && [5, 7, 12, 19, 24].includes(note.fret))
      effects.push({ type: "harmonic", kind: "natural" });
    else if (
      note.harmonicType === 2 &&
      Math.abs(note.harmonicPitch - 12) < 0.01
    )
      effects.push({ type: "harmonic", kind: "artificial" });
    else warnings.add("Bazı teknikler bu sürümde gösterilemiyor.");
  }
  const points = note.bendPoints;
  if (points?.length) {
    const peak = Math.max(...points.map((point) => point.value / 2));
    if (peak > 0 && peak <= 4 && points.length <= 8) {
      const curve = points.map((point) => ({
        position: point.offset / 60,
        semitones: point.value / 2,
      }));
      if (curve[0].position !== 0) curve.unshift({ position: 0, semitones: 0 });
      if (curve.at(-1).position !== 1)
        curve.push({ position: 1, semitones: curve.at(-1).semitones });
      if (
        curve.length <= 8 &&
        curve.every((point, i) => !i || point.position > curve[i - 1].position)
      )
        effects.push({ type: "bend", semitones: peak, curve });
      else warnings.add("Bazı teknikler bu sürümde gösterilemiyor.");
    } else warnings.add("Bazı teknikler bu sürümde gösterilemiyor.");
  }
  const target = note.hammerPullDestination ?? note.slideTarget;
  if (target && !effects.some((effect) => effect.type === "bend")) {
    if (
      target.fret !== note.fret &&
      target.string === note.string &&
      target.fret >= 0 &&
      target.fret <= 24
    )
      effects.push({
        type: note.hammerPullDestination
          ? target.fret > note.fret
            ? "hammerOn"
            : "pullOff"
          : "slide",
        targetFret: target.fret,
      });
  } else if (note.slideInType || note.slideOutType)
    warnings.add("Bazı teknikler bu sürümde gösterilemiyor.");
  if (
    note.accentuated ||
    note.isGhost ||
    beat.brushType ||
    beat.whammyBarPoints?.length
  )
    warnings.add("Bazı teknikler bu sürümde gösterilemiyor.");
  return effects;
}

export function convertImportedScore(
  source,
  partKey,
  firstMeasure,
  lastMeasure,
) {
  const parts = listImportParts(source);
  const part = parts.find((item) => item.key === partKey);
  requireImport(part, "Aktarılacak gitar partisini seç.");
  requireImport(
    Number.isInteger(firstMeasure) &&
      Number.isInteger(lastMeasure) &&
      firstMeasure >= 1 &&
      lastMeasure >= firstMeasure &&
      lastMeasure <= source.masterBars.length,
    "Geçerli bir ölçü aralığı seç.",
  );
  const staff = source.tracks[part.track].staves[part.staff];
  const warnings = new Set();
  const first = source.masterBars[firstMeasure - 1];
  let bpm = 120;
  for (const master of source.masterBars.slice(0, firstMeasure))
    for (const tempo of master.tempoAutomations)
      if (tempo.value) bpm = tempo.value;
  requireImport(
    bpm >= 30 && bpm <= 240,
    "Bu dosyanın temposu 30–240 BPM aralığının dışında.",
  );
  const score = createEmptyScore(bpm);
  score.meter = {
    beats: first.timeSignatureNumerator,
    unit: first.timeSignatureDenominator,
  };
  const baseTuning = staff.tuning.length === 6 ? staff.tuning : score.tuning;
  // Kapo ve gerçek ses transpozisyonu açık tel perdelerine işlenir.
  score.tuning = baseTuning.map(
    (midi) => midi + staff.capo - staff.transpositionPitch,
  );
  if (staff.capo || staff.transpositionPitch)
    warnings.add("Kapo ve transpozisyon akorda işlendi.");
  if (parts.length > 1)
    warnings.add("Yalnızca seçilen parti ve ses aktarılır.");
  let number = 0;
  const append = (durationTicks, notes) => {
    if (!durationTicks) return;
    requireImport(
      Number.isInteger(durationTicks) && durationTicks > 0,
      "Bu nota süreleri desteklenmiyor.",
    );
    requireImport(
      score.events.length < maximumNotes,
      "128 adım sınırı aşılıyor. Daha kısa bir ölçü aralığı seç.",
    );
    requireImport(
      durationTicks <= ticksPerBeat * 16,
      "Bu nota süresi desteklenen sınırı aşıyor.",
    );
    score.events.push({ id: "import-" + ++number, durationTicks, notes });
  };
  for (let index = firstMeasure - 1; index < lastMeasure; index++) {
    const master = source.masterBars[index];
    requireImport(
      master.timeSignatureNumerator === score.meter.beats &&
        master.timeSignatureDenominator === score.meter.unit,
      "Bu aralıkta ölçü değişiyor. Tek ölçü türü içeren bir aralık seç.",
    );
    requireImport(
      master.tempoAutomations.every(
        (tempo) => !tempo.value || Math.abs(tempo.value - bpm) < 0.001,
      ),
      "Bu aralıkta tempo değişiyor. Sabit tempolu bir aralık seç.",
    );
    requireImport(
      !master.isAnacrusis,
      "Eksik ölçüyü dışarıda bırakan bir aralık seç.",
    );
    const duration = master.calculateDuration();
    const beats = staff.bars[index]?.voices[part.voice]?.beats ?? [];
    let position = 0;
    for (const beat of beats) {
      if (beat.isEmpty) continue;
      if (beat.graceType) {
        warnings.add("Süsleme notaları aktarılmadı.");
        continue;
      }
      const start = beat.playbackStart;
      const length = beat.playbackDuration;
      requireImport(
        start >= position && start + length <= duration,
        "Bu sesin nota zamanlaması desteklenmiyor.",
      );
      append(start - position, []);
      const placements = placeNotes(beat.notes, score.tuning);
      const notes = beat.notes.map((note, i) => ({
        ...placements[i],
        techniques: importedTechniques(note, beat, warnings),
      }));
      const ties = beat.notes.map((note) => note.isTieDestination);
      if (ties.some(Boolean)) {
        const previous = score.events.at(-1);
        const allTied =
          ties.every(Boolean) &&
          previous &&
          previous.notes.length === notes.length &&
          notes.every((note) =>
            previous.notes.some(
              (old) => old.string === note.string && old.fret === note.fret,
            ),
          );
        requireImport(
          allTied,
          "Bu aralıkta farklı sürelerle bağlanmış akor var. Daha sade bir ses veya aralık seç.",
        );
        previous.durationTicks += length;
      } else append(length, notes);
      if (
        beat.notes.some(
          (note) =>
            !Number.isInteger(note.string) ||
            note.string < 1 ||
            !Number.isInteger(note.fret) ||
            note.fret < 0,
        )
      )
        warnings.add(
          "Perde bilgisi olmayan notalar akorda göre yerleştirildi.",
        );
      position = start + length;
    }
    append(duration - position, []);
    if (master.isRepeatStart || master.isRepeatEnd || master.alternateEndings)
      warnings.add(
        "Tekrar işaretleri açılmaz; ölçüler dosyadaki sırayla aktarılır.",
      );
  }
  return { score: validateScore(score), warnings: [...warnings] };
}
