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

Hızlı giriş: tablodaki bir telin `+` hücresine bas, sonra perdeyi hızlı seçim düğmelerinden seç veya klavyeyle yaz. Mevcut bir notayı başka teldeki hücreye tıklayarak taşıyabilirsin. Alan değişiklikleri seçili notaya otomatik uygulanır. “Yeni nota” düğmesi ekleme moduna döner. “Geri al / Yinele” son 50 nota düzenlemesini kapsar; “Seçili notayı çoğalt” aynı notayı hemen arkasına ekler.

Tab üzerindeyken sayılar perdeyi girer (10–24 için iki rakamı kısa aralıkla yaz), sol/sağ adımlar arasında, yukarı/aşağı teller arasında gezinir. Delete/Backspace seçili adımı siler. Ctrl/⌘ Z geri alır, Ctrl/⌘ Shift Z yineler. Metin ve sayı alanlarında tarayıcının normal klavye davranışı korunur.

Tel (1 en ince, 6 en kalın), 0–24 perde ve nota süresi seçerek en fazla 128 adımlık tek sesli egzersiz yazabilirsin. “Sus” seçeneği sessiz bir adım ekler. Seçili notanın alanları değiştirildiğinde düzenleme otomatik uygulanır; silme düğmesi seçili adımı kaldırır. Bir vuruş dörtlük notadır; sekizlik yarım, onaltılık çeyrek vuruştur.

Editörün kendi BPM alanı ve oynat/durdur düğmeleri vardır. Oynatma sırasında çalınan sütun vurgulanır. Ses, standart akortta sentetik bir önizlemedir. Mikrofon, akort cihazı ve metronom ile eşzamanlı çalıştırılmaz. Düzenlemeler bu tarayıcıya otomatik kaydedilir; metin tabı olarak da indirilebilir. İndirilen metindeki `Beats` satırı her sütunun vuruş süresini korur. Metin dosyasını yeniden içe aktarma henüz yoktur. Editörün nota zaman çizelgesi henüz performans karşılaştırmasına bağlanmaz.

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

Gelişmiş tab editörü için ilk veri altyapısı eklendi: sürümlü belge, akor/sus modeli, teknik bilgileri ve ortak zaman çizelgesi. Bu model henüz arayüze veya ses motoruna bağlanmadı. Taslaklar otomatik dönüştürülüp üzerine yazılmaz. Ayrıntılar: [veri modeli ve aşamalı plan](docs/score-format.md).

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

Sıradaki geliştirmeler: Guitar Pro/MusicXML okuma, ritimli nota zaman çizelgesi, perde algılama ve performansı nota nota eşleştirme.

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

Quick entry: click a string's `+` cell, then select a fret from the quick buttons or type it on your keyboard. Click another string in an existing column to move that note. Field changes apply automatically to the selected note. “New note” returns to insert mode. Undo/redo covers the last 50 note edits; duplicating a note inserts a copy immediately after it.

When the tab has focus, digits enter frets (type two digits quickly for 10–24), left/right arrows navigate steps, and up/down arrows navigate strings. Delete/Backspace removes the selected step. Ctrl/⌘ Z undoes and Ctrl/⌘ Shift Z redoes. Text and number fields retain their normal browser keyboard behavior.

Build a single-note exercise with up to 128 steps. Choose a string (1 is highest, 6 is lowest), fret 0–24, and duration, or select a rest. Select a step heading to update or delete it. One beat is a quarter note; eighth notes last half a beat and sixteenth notes last a quarter beat.

The editor has its own BPM and play/stop controls, with a highlighted playback cursor. Audio is a synthesized preview in standard tuning. Playback runs separately from recording, the tuner, and the metronome. Edits are saved automatically in this browser. Download a text tab to keep a copy; its `Beats` line preserves each column's duration. Text import is not implemented yet. The editor's timed note sequence is not yet connected to performance comparison.

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

The advanced editor foundation now includes a versioned score document, chord/rest data, technique metadata, and a shared timeline compiler. It is not yet connected to the editor UI or audio engine and does not overwrite existing drafts. See the [format and incremental plan](docs/score-format.md).

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

Planned improvements include Guitar Pro/MusicXML import, a timed note sequence, pitch detection, and note-by-note performance alignment.
