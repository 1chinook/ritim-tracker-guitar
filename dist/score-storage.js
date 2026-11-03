import { parseScore, serializeScore } from "./score-document.js";

export const scoreStorageKey = "ritim-score-v1";
export const legacyStorageKey = "ritim-tab-draft-v1";

export function loadScoreDraft(storage) {
  // Yeni kayıt varsa hatalı olsa bile eski kayda sessizce geri düşülmez.
  const current = storage.getItem(scoreStorageKey);
  if (current !== null) return { score: parseScore(current), migrated: false };
  const legacy = storage.getItem(legacyStorageKey);
  return legacy === null ? null : { score: parseScore(legacy), migrated: true };
}

export function saveScoreDraft(storage, score) {
  // Eski taslağı yedek olarak koru. Yeni biçim yalnızca kendi anahtarına yazılır.
  storage.setItem(scoreStorageKey, serializeScore(score));
}
