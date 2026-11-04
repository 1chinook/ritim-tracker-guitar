# Gelişmiş editör: ortak belge ve oynatma

Editör, kayıt ve oynatma artık aynı sürümlü belgeyi kullanır. Tek sesli eski taslaklar açılışta bellekte dönüştürülür; ilk düzenleme yeni kayıt anahtarına yazılır ve eski taslak yedek kalır.

## Yapı

`dist/score-document.js` sürümlü belgeyi doğrular, JSON'a çevirir ve eski taslakları **kaynak veriyi değiştirmeden** dönüştürür. `dist/score-timeline.js` bu belgeden arayüz ve ses motoru için ortak zaman çizelgesi çıkarır.

- Belge: `format`, `version`, `ppq`, `bpm`, `meter`, `tuning`, `events`.
- Akort: 1. telden 6. tele MIDI perde numaraları.
- Adım: sabit `id`, `durationTicks` ve eşzamanlı `notes` listesi.
- Nota: `string`, `fret` ve `techniques`.
- Sus: boş `notes` listesi.
- Akor: aynı adımda farklı tellerde birden fazla nota.
- Zaman: bir dörtlük 960 tick. Sekizlik 480, noktalı dörtlük 1440, sekizlik üçleme 320 tick. Süreler kayan noktalı vuruş toplamlarıyla tutulmaz.

Tek gitar, altı tel, 0–24 perde, en fazla 128 adım ve 512 ölçü desteklenir. Çizimde ölçüyü aşan adımlar parçalara ayrılıp devam işaretiyle gösterilir; aynı adım kimliği ve tek ses başlangıcı korunur.

## Teknik verisi

Aşağıdaki teknikler doğrulanır, tabda işaretlenir ve gitar örnekleri üzerinde yaklaşık olarak önizlenir:

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

Bu liste tek notaya aynı anda uygulanacak bir kombinasyon değildir. Ölü nota tek başına kullanılır; hammer-on ve pull-off hedefleri başlangıç perdesine göre doğru yönde olmalıdır. Bir notada bend veya slide/hammer-on/pull-off geçişinden biri seçilir; vibrato bunlarla birlikte kullanılabilir. Daha ayrıntılı bend eğrileri, let ring, harmonikler ve bir sonraki nota bağlantıları sonraki adımlardır.

## Veri kaybını önleme

- Bilinmeyen sürüm, alan veya teknik silinerek kabul edilmez; açıkça reddedilir.
- Eski `{version: 1, bpm, notes}` taslaklarını `migrateLegacyDraft` dönüştürür. Bu işlem tarayıcı depolamasına yazmaz.
- JSON işlemleri nota, akor, sus ve teknik bilgilerini korur.
- Doğrulama ve derleme yeni nesneler üretir; kaynak belgeyi değiştirmez.

## Uygulama katmanları

- `score-session.js`: doğrulanan, atomik düzenleme işlemleri ve belge düzeyinde geri al/yinele.
- `score-storage.js`: yeni kayıt anahtarı ve eski taslağı koruyan geçiş.
- `score-grid.js` / `score-notation.js`: ölçüler, akorlar, teknik işaretleri ve devam parçaları.
- `score-audio.js` / `score-player.js`: eşzamanlı akor sesleri, zarf, vibrato ve perde geçişleri.
- `tab-editor.js`: kullanıcı kontrollerini bu katmanlara bağlar.

Bend miktarı yarım ses (semitone), vibrato derinliği cent, hızı Hz ile tutulur. Slide/hammer-on/pull-off hedefi aynı sesin süresinin içinde uygulanır; ayrı nota bağlantısı değildir. `guitar-samples.js` yerel Distortion veya Akustik kayıtlarını yükler. Perde geçişleri örneğin oynatma hızıyla, vibrato detune ile uygulanır; ölü nota kısa filtreli gürültüdür. Uzun notalar örneklerin doğal uzunluğuyla sınırlıdır. Kaynak ve lisans `dist/sounds/CREDITS.md` dosyasındadır. Çoklu enstrüman, değişken ölçü/tempo ve tekrar işaretleri bu sürümde yoktur.

## English

The versioned score document is used by editing, storage, notation, and sample-based playback. Chord voices share an event; an empty event is a rest. Measure splitting preserves event identity and does not retrigger the audio. Pitch transitions occur within the current event, rather than linking separately entered notes. Undo/redo includes chords, techniques, tempo and meter. JSON round-trips retain the full score; legacy drafts remain backed up under their old key.

Playback uses bundled Distortion or Acoustic guitar samples, filtering, amplitude envelopes and pitch automation. A short filtered noise burst approximates dead notes. Techniques are approximate and long notes are limited by the natural sample length. See `dist/sounds/CREDITS.md` for attribution. Multiple instruments, variable meter/tempo maps, repeats and full Guitar Pro/MusicXML support are future work.
