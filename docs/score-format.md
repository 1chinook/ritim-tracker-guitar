# Gelişmiş editör: ilk altyapı adımı

Bu adım yalnızca veri sözleşmesini kurar. Mevcut tek sesli editör ve ses motoru çalışmaya devam eder; yeni teknik düğmeleri veya gelişmiş gitar sesi henüz eklenmez. Yeni model henüz aktif tarayıcı taslağının yerine geçirilmez.

## Yapı

`dist/score-document.js` sürümlü belgeyi doğrular, JSON'a çevirir ve eski taslakları **kaynak veriyi değiştirmeden** dönüştürür. `dist/score-timeline.js` bu belgeden arayüz ve ilerideki ses motoru için ortak zaman çizelgesi çıkarır.

- Belge: `format`, `version`, `ppq`, `bpm`, `meter`, `tuning`, `events`.
- Akort: 1. telden 6. tele MIDI perde numaraları.
- Adım: sabit `id`, `durationTicks` ve eşzamanlı `notes` listesi.
- Nota: `string`, `fret` ve `techniques`.
- Sus: boş `notes` listesi.
- Akor: aynı adımda farklı tellerde birden fazla nota.
- Zaman: bir dörtlük 960 tick. Sekizlik 480, noktalı dörtlük 1440, sekizlik üçleme 320 tick. Süreler kayan noktalı vuruş toplamlarıyla tutulmaz.

Şimdilik tek gitar, altı tel, 0–24 perde ve en fazla 128 adım desteklenir. Ölçü hesaplaması adımın başlangıcını konumlandırır; ölçüyü aşan notaları henüz bölmez veya bağ işareti üretmez.

## Teknik verisi

Aşağıdaki kayıt biçimleri doğrulanabilir; bunların **tab çizimi ve ses yorumu henüz yoktur**:

```json
[
  { "type": "vibrato", "depthCents": 30, "rateHz": 5 },
  { "type": "bend", "semitones": 2 },
  { "type": "slide", "targetFret": 9 },
  { "type": "hammerOn", "targetFret": 9 },
  { "type": "pullOff", "targetFret": 5 },
  { "type": "palmMute" },
  { "type": "deadNote" }
]
```

Bu liste tek notaya aynı anda uygulanacak bir kombinasyon değildir. Ölü nota tek başına kullanılır; hammer-on ve pull-off hedefleri başlangıç perdesine göre doğru yönde olmalıdır. Slide/hammer-on/pull-off için bir notada en fazla bir hedef geçiş tanımlanabilir. Daha ayrıntılı bend eğrileri, let ring, harmonikler ve bir sonraki nota bağlantıları sonraki adımlardır.

## Veri kaybını önleme

- Bilinmeyen sürüm, alan veya teknik silinerek kabul edilmez; açıkça reddedilir.
- Eski `{version: 1, bpm, notes}` taslaklarını `migrateLegacyDraft` dönüştürür. Bu işlem tarayıcı depolamasına yazmaz.
- JSON işlemleri nota, akor, sus ve teknik bilgilerini korur.
- Doğrulama ve derleme yeni nesneler üretir; kaynak belgeyi değiştirmez.

## Sıradaki küçük adım

Önce editör durumunu bu modele geçirmek ve aynı sütunda akor yazmayı açmak. Ardından yalnızca vibratonun çizimini ve sesini eklemek. Diğer teknikler aynı yöntemle tek tek geliştirilecek.

## English

This first infrastructure step introduces a versioned score document and a shared timeline compiler. It supports note/chord/rest data, integer tick durations, meter positions, tuning, and validated technique metadata. The existing editor, draft storage, and audio engine are not switched to this format yet. No new technique UI or technique playback is claimed.

Unknown versions, fields, and techniques are rejected to prevent silent data loss. The legacy migration adapter is pure: it never overwrites browser drafts. Next steps are migrating editor state, enabling chord input, and implementing vibrato notation and playback before adding other techniques individually.
