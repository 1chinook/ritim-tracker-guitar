# Ritim İzi

[Türkçe](#başlatma) · [English](#english)

Gitar egzersizlerini mikrofon veya ses dosyası üzerinden inceleyen tarayıcı uygulaması.

Bu proje henüz ilkel bir ilk sürümdür; öğrenme ve deneme amacıyla geliştirilmektedir. Tab editörü, sentetik oynatma ve akort cihazı temel prototiplerdir. Gerçek mikrofon ve tarayıcıyla uçtan uca kullanım henüz tam doğrulanmamıştır; tab ile performansı nota nota eşleştirme desteklenmez.

Ana sayfa akort, kayıt ve analiz araçlarını içerir. Tab editörü üst menüdeki bağlantıdan açılan ayrı `editor.html` sayfasındadır. Dil ve görünüm, etiketli seçim menülerinden değiştirilir.

Üst çubuktan Türkçe veya İngilizce arayüzü seçebilir, açık ve karanlık tema arasında geçiş yapabilirsin. Tercihler bu tarayıcıda saklanır. İlk açılışta tema sistem ayarına uyar; varsayılan dil Türkçedir.

## Başlatma

Node.js 22 veya üzeri kurulu olmalı. Proje klasöründe:

```sh
npm install
npm start
```

Tarayıcıda http://127.0.0.1:4173 adresini aç. Mikrofon için localhost veya HTTPS gerekir; HTML dosyasını çift tıklayarak açmak yeterli değildir.

## Kullanım

### Tab editörü ve oynatma

Editör artık sürümlü nota belgesini kullanır. Aynı sütundaki farklı tellerdeki boş hücrelere tıklayarak akor oluştur; mevcut notaya tıklayıp perde ve tekniklerini düzenle. Yeni sütun için `+` veya “Yeni nota” kullan. “Sus ekle” ayrı bir sessiz adım ekler.

- Her sütun bir adım, içindeki teller eşzamanlı çalan seslerdir. Süre değişikliği bütün akoru etkiler.
- Vibrato derinliği/hızı, bend miktarı, slide, hammer-on ve pull-off hedef perdesi seçilebilir. Palm mute ve ölü nota da desteklenir.
- Tab işaretleri: `~` vibrato, `↑` bend, `/` veya `\\` slide, `h` hammer-on, `p` pull-off, `PM` palm mute, `×` ölü nota.
- Bend için yarım ses sayısını gir: 1 = yarım ton, 2 = tam ton. Hammer-on hedefi başlangıçtan yüksek; pull-off hedefi düşük olmalı.
- Slide/hammer-on/pull-off, hedef perdeye aynı adımın süresi içinde geçer; ikinci bir adım oluşturmaz.
- 4/4, 3/4, 6/8 ve diğer ölçüler desteklenir. Ölçüyü aşan nota `↝` ile devam eder; oynatmada tekrar tetiklenmez.
- Noktalı süreler ve üçlemeler seçilebilir. Bir dörtlük 960 tick'tir; tekniklerde süreler ortak ses saatine planlanır.
- En fazla 128 adım ve 512 ölçü desteklenir. Tek gitar, altı tel ve 0–24 perde kullanılır.

Tab odaktayken rakamlar perde girer; 10–24 için iki rakamı hızlı yaz. Sol/sağ adımlar, yukarı/aşağı teller arasında gezinir. Delete/Backspace seçili telin notasını, Shift+Delete tüm adımı siler. Son ses silindiğinde adım sus olarak kalır. Ctrl/⌘ Z geri alır, Ctrl/⌘ Shift Z yineler. BPM, ölçü, teknik ve akor değişiklikleri de geri alınabilir.

“Tabı çal”, akorları aynı anda ve teknikleri sentetik olarak önizler. Ses gerçek gitar örneklerinden üretilmez. Özellikle hammer-on/pull-off basitleştirilmiş koparmasız perde değişimleridir; profesyonel bir fiziksel gitar modeli değildir.

Taslak yeni `ritim-score-v1` anahtarına kaydedilir; eski `ritim-tab-draft-v1` taslağı yedek olarak korunur. Akor ve teknikleri tam saklamak için JSON indir/aç özelliğini kullan. Dosya açma geri alınabilir. Bozuk veya gelecekteki kayıt üzerine sessizce yazılmaz. Metin tabı insan tarafından okunabilir bir çıktıdır; yeniden içe aktarılmaz. Bu editör henüz kayıtla nota nota performans karşılaştırması yapmaz.

### Canlı akort cihazı

“Akort cihazını başlat” düğmesiyle mikrofonu aç. Tek bir açık teli çal; algılanan nota, frekans ve hedefe göre cent sapması görüntülenir. Otomatik mod standart akorttaki en yakın teli seçer: E2–A2–D3–G3–B3–E4. Fazla bozuk akortta hedef teli elle seç. Negatif değer pes, pozitif değer tiz anlamına gelir; ±5 cent aralığı doğru akort olarak gösterilir. Referans A4 = 440 Hz'dir.

Akort sesi kaydedilmez veya sunucuya gönderilmez. Akort cihazı açıkken performans kaydı ve metronom kullanılamaz. İşin bitince durdur; mikrofon serbest bırakılır. Tek sesli, temiz ve yeterli seviyedeki seslerle kullan; akorlar ve gürültü algılamayı bozabilir. 65–1200 Hz aralığındaki periyodik sesler için tahmin yapılır.

### Performans analizi

1. Hedef BPM ve vuruş başına nota sayısını seç.
2. İstersen metronomla alıştırma yap. Metronom kayıt başlarken susar.
3. Mikrofonla en az 5 notayı eşit aralıklarla çal veya ses dosyası seç.
4. Analiz sonucunda tahmini tempo, ritim tutarlılığı ve nota aralığı dalgalanmasını incele.
5. Kaydı saklamak için “Kaydı indir” bağlantısını kullan.

Kayıt sınırı 3 saniye–3 dakika, dosya boyutu sınırı 30 MB'dir. Tarayıcının çözebildiği WAV, MP3, M4A, OGG, WebM ve FLAC dosyaları kullanılabilir. Ses dosyaları sunucuya gönderilmez; sayfa kapandığında indirilmeyen kayıt kaybolur.

## Analizin sınırları

Bu sürüm eşit nota aralıkları olan tek sesli egzersizler için yaklaşık ritim analizi yapar. Düz metin tab, çalışma notudur; sesle nota nota karşılaştırılmaz. Değişen nota süreleri, suslar, distortion, akorlar ve arka plan sesleri tahmini etkiler.

Tempo, tipik nota başlangıcı aralığı ve seçilen nota sıklığı üzerinden hesaplanır. Tutarlılık puanı, aralıkların değişimine dayanır; hedef BPM'den bağımsızdır. Milisaniye değeri nota aralıklarının tipik aralıktan RMS sapmasıdır; nota bazında erken/geç ölçümü değildir.

Sonuçlar yalnızca yüklenen veya kaydedilen sesten hesaplanır. Sessiz, çok kısa veya okunamayan kayıtlara sonuç uydurulmaz.

## Kod düzeni

Gelişmiş editör, sürümlü belgeyi düzenleme, kayıt, çizim ve oynatmada ortak kullanır. Ayrıntılar: [veri modeli ve sınırlar](docs/score-format.md).

- `dist/app.js`: Ekran olayları, dosya seçimi ve sonuç görünümü.
- `dist/audio.js`: Mikrofon, kayıt yaşam döngüsü ve metronom.
- `dist/rhythm.js`: Ekrandan bağımsız ses analizi.
- `dist/styles.css`: Okunabilir ve biçimlendirilmiş stil kuralları.
- `scripts/serve.mjs`: Yerel geliştirme sunucusu.
- `test/rhythm.test.js`: Bilinen tempolar ve hatalı kayıt senaryoları.

```sh
npm test
npm run format:check
npm run format
```

Sıradaki geliştirmeler: Guitar Pro/MusicXML, çoklu enstrüman, daha doğal gitar sesi ve kayıtları nota nota eşleştirme.

---

## English

Ritim İzi is a browser-based guitar practice tool that analyzes microphone recordings or uploaded audio files. It estimates tempo and rhythmic consistency for exercises played with evenly spaced notes.

This is an early, rudimentary prototype built for learning and experimentation. The tab editor, synthesized playback, and tuner provide basic functionality. End-to-end use with a real microphone and browser has not been fully verified, and note-by-note alignment between the tab and performance is not supported.

The main page contains the tuner, recording, and analysis tools. The tab editor lives on a separate `editor.html` page linked from the header. Labeled language and appearance menus are available on both pages.

### Getting started

Install Node.js 22 or newer, then run these commands in the project directory:

```sh
npm install
npm start
```

Open http://127.0.0.1:4173 in your browser. Microphone access requires localhost or HTTPS. Opening the HTML file directly will not work.

Use the header controls to switch between Turkish and English, or between light and dark mode. Your preferences are saved in this browser. On first use, the theme follows your system setting and the language defaults to Turkish. Changing language or theme preserves the selected audio and displayed analysis.

### How to use

#### Tab editor and playback

The editor now uses the versioned score document. Click empty cells on different strings in the same column to build chords. Select an existing note to edit its fret and techniques. Use `+` or “New note” for a new step, or add a separate rest.

- Each column is one event with simultaneous notes. Changing its duration affects the whole chord.
- Edit vibrato depth/rate, bend amount, slide, hammer-on and pull-off target frets, palm mute, and dead notes.
- Notation: `~` vibrato, `↑` bend, `/` or `\\` slide, `h` hammer-on, `p` pull-off, `PM` palm mute, `×` dead note.
- Bend amounts are semitones: 1 = a half step, 2 = a whole step. Hammer-on targets must be higher; pull-off targets lower.
- Slide/hammer-on/pull-off transitions reach the target within the current event's duration; they do not create a second event.
- Time signatures include 4/4, 3/4 and 6/8. Notes crossing bars continue with `↝` and are not re-triggered in audio.
- Dotted durations and triplets are supported with a shared audio clock and 960 ticks per quarter note.
- Limits: 128 events, 512 measures, one six-string guitar, frets 0–24.

With the tab focused, type fret digits (two digits quickly for 10–24). Left/right arrows navigate steps; up/down navigate strings. Delete/Backspace removes one string's note, Shift+Delete the entire step. Removing the last voice leaves a rest. Ctrl/⌘ Z undoes and Ctrl/⌘ Shift Z redoes. Tempo, meter, techniques and chords are included in undo/redo.

Playback previews simultaneous chords and techniques using synthesis, not recorded guitar samples. Hammer-ons and pull-offs are simplified legato pitch changes, not a professional physical guitar model.

The new draft is saved under `ritim-score-v1`; the old `ritim-tab-draft-v1` draft remains as a backup. Download/open JSON to preserve full chords and techniques; opening a file is undoable. Corrupt or future-version drafts are not silently overwritten. Text tabs are readable exports and cannot be re-imported. Recorded performance is not yet aligned against this score.

#### Live guitar tuner

Press “Start tuner” and allow microphone access. Play one open string to see the detected note, frequency, and deviation from the target in cents. Automatic mode selects the closest standard guitar string: E2–A2–D3–G3–B3–E4. Select a string manually if it is far out of tune. Negative values are flat, positive values are sharp, and ±5 cents is considered in tune. The reference is A4 = 440 Hz.

Tuner audio is not recorded or uploaded. Performance recording and the metronome are unavailable while tuning. Stop the tuner to release the microphone. Use one clear note at a time; chords, noise, and weak signals can affect detection. The detector estimates periodic sounds in the 65–1200 Hz range.

#### Performance analysis

1. Set the target BPM and the number of notes per beat.
2. Optionally practice with the metronome. It stops when recording begins.
3. Record at least five evenly spaced notes with your microphone, or select an audio file. An optional four-beat count-in helps you prepare.
4. Review the estimated tempo, rhythmic consistency score, and note-interval variation.
5. Use the download link to keep your recording.

Recordings must be between 3 seconds and 3 minutes long. The file size limit is 30 MB. WAV, MP3, M4A, OGG, WebM, and FLAC files are accepted when supported by your browser's audio decoder. Audio is processed locally in the browser and is not uploaded to a server. Download recordings you want to keep before closing the page.

### What the analysis measures

- **Estimated tempo:** calculated from the median detected note-onset interval and the selected number of notes per beat.
- **Rhythmic consistency:** measures how much note intervals vary, independently of the target BPM. Playing steadily at a different tempo does not automatically reduce this score.
- **Interval variation:** the root-mean-square deviation of note intervals from their median, shown in milliseconds. This is not a note-by-note early/late timing measurement.

This version provides approximate rhythm analysis for single-note exercises with evenly spaced notes. Plain-text tablature is a practice reference only; it is not matched against the recording. Rests, changing note durations, distortion, chords, and background noise can affect the estimates. Pitch recognition and correct/incorrect note detection are not implemented yet.

Results are calculated only from uploaded or recorded audio. Silent, short, or unreadable recordings produce an error instead of fabricated results.

### Project structure

The editor uses the shared score document for editing, storage, notation, and playback. See the [format and limitations](docs/score-format.md).

- `dist/app.js`: interface events, file selection, and result rendering.
- `dist/audio.js`: microphone recording, resource cleanup, and metronome.
- `dist/rhythm.js`: audio analysis independent of the interface.
- `dist/styles.css` and `dist/practice.css`: layout and practice controls.
- `scripts/serve.mjs`: local development server.
- `test/rhythm.test.js`: known-tempo fixtures and invalid recording cases.

### Development checks

```sh
npm test
npm run format:check
npm run format
```

Planned improvements include Guitar Pro/MusicXML, multiple instruments, more natural guitar sound, and note-by-note performance alignment.
