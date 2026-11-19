import { importer, Settings } from "./vendor/alphatab/alphaTab.core.min.mjs";
import { listImportParts, convertImportedScore } from "./score-file-import.js";
let parsed = null;
self.onmessage = ({ data }) => {
  try {
    if (data.type === "open") {
      try {
        parsed = importer.ScoreLoader.loadScoreFromBytes(
          new Uint8Array(data.bytes),
          new Settings(),
        );
      } catch {
        parsed = null;
        throw new Error(
          "Dosya okunamadı. Geçerli bir Guitar Pro veya MusicXML dosyası seç.",
        );
      }
      const parts = listImportParts(parsed);
      if (!parts.length)
        throw new Error(
          "Dosyada aktarılabilir altı telli gitar partisi bulunamadı.",
        );
      self.postMessage({
        id: data.id,
        title: parsed.title,
        parts,
        measures: parsed.masterBars.length,
      });
    } else if (data.type === "convert" && parsed) {
      self.postMessage({
        id: data.id,
        ...convertImportedScore(parsed, data.part, data.first, data.last),
      });
    } else throw new Error("Önce bir dosya aç.");
  } catch (error) {
    self.postMessage({
      id: data.id,
      error:
        error.name === "ScoreValidationError"
          ? "Bu dosyanın nota yapısı desteklenmiyor. Daha sade bir ses veya ölçü aralığı seç."
          : error.message || "Dosya okunamadı.",
    });
  }
};
