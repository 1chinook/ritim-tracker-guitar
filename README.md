# Ritim İzi (`ritim-izi-gitar`)

[Türkçe](#kurulum-ve-çalıştırma) · [English](#english)

Gitar egzersizlerini mikrofon, ses kartı veya ses dosyası üzerinden inceleyen; canlı akort cihazı ve tab editörü içeren tarayıcı uygulaması.

| Alan           | Değer                                                 |
| -------------- | ----------------------------------------------------- |
| **Kategori**   | Frontend Web Uygulaması                               |
| **Teknoloji**  | Node.js 22+ Statik Sunucu + Vanilla JS + AlphaTab 1.9 |
| **Port / URL** | `3002` · `http://127.0.0.1:3002`                      |
| **Başlatıcı**  | `BASLAT.bat` (`start.ps1`)                            |
| **Doğrulama**  | `npm test && npm run format:check`                    |

## Özellikler

- **Performans Analizi:** Mikrofon veya ses dosyasından tempo (BPM), ritim tutarlılığı ve nota aralığı dalgalanması ölçümü.
- **Canlı Akort Cihazı:** Standart E2–E4 otomatik/manuel tel hedefi ve cent sapması gösterimi.
- **Gelişmiş Tab Editörü (`editor.html`):** Sürümlü nota belgesi, gitar ses örnekleriyle oynatma, bend/slide/vibrato/harmonik teknikleri, alternatif akortlar ve Guitar Pro / MusicXML içe aktarma.
- **Ses Kartı Girişi ve Çoklu Dil:** Kanal seçimi (Sol/Sağ/Karışım), RMS/kırpılma göstergesi, Türkçe/İngilizce arayüz ve açık/koyu tema.

## Klasör Yapısı

```text
ritim-izi-gitar/
├── dist/                   # Uygulama arayüzü, ses/ritim/tab modülleri ve örnek ses bankaları
├── scripts/                # Yerel geliştirme sunucusu (serve.mjs, PORT=3002)
├── test/                   # Node.js birim testleri (122 test)
├── docs/                   # Veri modeli ve sınırlar (score-format.md)
├── package.json            # Bağımlılıklar ve test/biçimlendirme betikleri
├── BASLAT.bat & start.ps1  # Tek tık otomatik yeniden başlatıcı
├── AGENTS.md               # Mühendislik kuralları
└── README.md
```

## Kurulum ve Çalıştırma

- **Windows Tek Tık Başlatıcı (Önerilen):** `BASLAT.bat` dosyasına çift tıklayın (`3002` portundaki eski süreci temizler, gerekirse `npm install` çalıştırır ve tarayıcıyı açar).
- **Terminal (Node.js 22+):**

```sh
npm install
npm start
```

Tarayıcıda `http://127.0.0.1:3002` adresini açın. Mikrofon erişimi için `localhost` veya HTTPS gerekir.

## Testler ve Doğrulama

```sh
npm test
npm run format:check
```

---

## Kullanım Notları

Bu proje henüz ilkel bir ilk sürümdür; öğrenme ve deneme amacıyla geliştirilmektedir. Tab editörü, gitar örnekleriyle oynatma ve akort cihazı temel prototiplerdir. Gerçek mikrofon ve tarayıcıyla uçtan uca kullanım henüz tam doğrulanmamıştır; tab ile performansı nota nota eşleştirme desteklenmez.

Ana sayfa akort, kayıt ve analiz araçlarını içerir. Tab editörü üst menüdeki bağlantıdan açılan ayrı `editor.html` sayfasındadır. Dil ve görünüm, etiketli seçim menülerinden değiştirilir.

Üst çubuktan Türkçe veya İngilizce arayüzü seçebilir, açık ve karanlık tema arasında geçiş yapabilirsin. Tercihler bu tarayıcıda saklanır. İlk açılışta tema sistem ayarına uyar; varsayılan dil Türkçedir.

## Kullanım

### Tab editörü ve oynatma

Editör sürümlü nota belgesini kullanır. Çalma, tempo ve ses seçimi üstte; tab hemen altındadır. Nota teknikleri ile dosya işlemleri kapalı açılır bölümlerdedir.

Hızlı girişte bir tel ve süre seçip `0 3 5 7 - 5` yaz, “Diziyi ekle”ye veya Enter'a bas. `-` ve `r` sus ekler. Dizi seçili adımdan sonra, seçim yoksa sona eklenir ve tek işlemde geri alınır. Yanlış girişte kısmi ekleme yapılmaz.

Hücreye tıklamak yalnızca imleci taşır. Perde numarası yazmak o tele nota ekler veya var olan notayı değiştirir; aynı sütundaki diğer teller korunur. Enter/sağ ok sonraki adıma, yukarı/aşağı ok diğer tellere geçer. Son sütundaki `+` hücresini seçip perde yazmak yeni adım oluşturur. Boşluk çalar/durdurur. “Sus ekle” sona sessiz adım ekler.

- Her sütun bir adım, içindeki teller eşzamanlı çalan seslerdir. Süre değişikliği bütün akoru etkiler.
- Vibrato derinliği/hızı, bend miktarı, slide, hammer-on ve pull-off hedef perdesi seçilebilir. Palm mute ve ölü nota da desteklenir.
- Tab işaretleri: `~` vibrato, `↑` bend, `/` veya `\\` slide, `h` hammer-on, `p` pull-off, `PM` palm mute, `×` ölü nota.
- Bend için yarım ses sayısını gir: 1 = yarım ton, 2 = tam ton. Hammer-on hedefi başlangıçtan yüksek; pull-off hedefi düşük olmalı.
- Slide/hammer-on/pull-off, hedef perdeye aynı adımın süresi içinde geçer; ikinci bir adım oluşturmaz.
- 4/4, 3/4, 6/8 ve diğer ölçüler desteklenir. Ölçüyü aşan nota `↝` ile devam eder; oynatmada tekrar tetiklenmez.
- Noktalı süreler ve üçlemeler seçilebilir. Bir dörtlük 960 tick'tir; tekniklerde süreler ortak ses saatine planlanır.
- En fazla 128 adım ve 512 ölçü desteklenir. Tek gitar, altı tel ve 0–24 perde kullanılır.

Tab odaktayken rakamlar perde girer; 10–24 için iki rakamı hızlı yaz. Sol/sağ adımlar, yukarı/aşağı teller arasında gezinir. Delete/Backspace seçili telin notasını, Shift+Delete tüm adımı siler. Son ses silindiğinde adım sus olarak kalır. Ctrl/⌘ Z geri alır, Ctrl/⌘ Shift Z yineler. BPM, ölçü, teknik ve akor değişiklikleri de geri alınabilir.

“Çal”, yerel gitar ses örnekleriyle akorları ve teknikleri önizler. Varsayılan Distortion, alternatif Akustik'tir. Yaklaşık 708 KiB'lık iki küçük örnek bankası uygulamayla birlikte gelir; oynatma dışarıdan ses indirmez. Bend, slide, vibrato ve hammer-on/pull-off bu kayıtların perdesi değiştirilerek yaklaşık uygulanır; uzun notalar örneğin doğal ses uzunluğuyla sınırlıdır. Kaynak ve lisans: [ses atıfları](dist/sounds/CREDITS.md).

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

This is an early, rudimentary prototype built for learning and experimentation. The tab editor, sample-based playback, and tuner provide basic functionality. End-to-end use with a real microphone and browser has not been fully verified, and note-by-note alignment between the tab and performance is not supported.

The main page contains the tuner, recording, and analysis tools. The tab editor lives on a separate `editor.html` page linked from the header. Labeled language and appearance menus are available on both pages.

### Getting started

Install Node.js 22 or newer, then run these commands in the project directory:

```sh
npm install
npm start
```

Open http://127.0.0.1:3002 in your browser. Microphone access requires localhost or HTTPS. Opening the HTML file directly will not work.

Use the header controls to switch between Turkish and English, or between light and dark mode. Your preferences are saved in this browser. On first use, the theme follows your system setting and the language defaults to Turkish. Changing language or theme preserves the selected audio and displayed analysis.

### How to use

#### Tab editor and playback

The editor uses the versioned score document. Playback, tempo and guitar sound sit above the tab; techniques and file tools are in closed disclosure panels.

For quick entry, choose a string and duration, type `0 3 5 7 - 5`, then press “Insert sequence” or Enter. `-` and `r` are rests. The sequence is inserted after the selected step, or appended when nothing is selected. The entire insertion is one undo action; invalid input leaves the score intact.

Clicking a cell only moves the cursor. Type a fret to add or edit its note while preserving other strings in the chord. Enter/right advances; up/down changes strings. Select a final `+` cell and type a fret to append a step. Space plays/stops; “Add rest” appends a silent step.

- Each column is one event with simultaneous notes. Changing its duration affects the whole chord.
- Edit vibrato depth/rate, bend amount, slide, hammer-on and pull-off target frets, palm mute, and dead notes.
- Notation: `~` vibrato, `↑` bend, `/` or `\\` slide, `h` hammer-on, `p` pull-off, `PM` palm mute, `×` dead note.
- Bend amounts are semitones: 1 = a half step, 2 = a whole step. Hammer-on targets must be higher; pull-off targets lower.
- Slide/hammer-on/pull-off transitions reach the target within the current event's duration; they do not create a second event.
- Time signatures include 4/4, 3/4 and 6/8. Notes crossing bars continue with `↝` and are not re-triggered in audio.
- Dotted durations and triplets are supported with a shared audio clock and 960 ticks per quarter note.
- Limits: 128 events, 512 measures, one six-string guitar, frets 0–24.

With the tab focused, type fret digits (two digits quickly for 10–24). Left/right arrows navigate steps; up/down navigate strings. Delete/Backspace removes one string's note, Shift+Delete the entire step. Removing the last voice leaves a rest. Ctrl/⌘ Z undoes and Ctrl/⌘ Shift Z redoes. Tempo, meter, techniques and chords are included in undo/redo.

Playback uses bundled guitar soundfont samples, with Distortion selected by default and Acoustic available. Both small sample banks together take about 708 KiB and need no third-party requests during playback. Bend, slide, vibrato and hammer-on/pull-off are approximate pitch changes on these recordings; long notes are limited by each sample's natural length. See [sample credits and license](dist/sounds/CREDITS.md).

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

Planned improvements include multiple instruments and note-by-note performance alignment.

### Genişletilmiş gitar teknikleri / Extended guitar techniques

Teknikler menüsünde let ring, doğal/yapay harmonik, tapping, tremolo picking ve pena yönü bulunur.
Bend için hazır yükselt/tut/bırak eğrileri veya düzenlenebilir süre:yarım ses noktaları kullanılabilir.
Shift ile aynı telde yan yana iki nota seçip Slide, Hammer-on veya Pull-off ile bağlayabilirsin.
Bağlı notalar aynı ses kaynağında devam eder. Let ring sonraki aynı teldeki notaya kadar,
son adımda en çok iki saniye uzar. Ses örneğinin doğal uzunluğu duyulan çınlamayı sınırlar.
Harmonik ve tapping tınıları yaklaşık önizlemelerdir. Pena yönü görsel bir işarettir.

The Techniques menu supports let ring, natural/artificial harmonics, tapping, tremolo picking and pick direction.
Bends offer hold/release/pre-bend presets and editable time-fraction:semitone points.
Shift-select two adjacent notes on one string to connect them with slide, hammer-on or pull-off.
Linked notes share one sound source. Let ring lasts until the next note on the same string, with a two-second
tail after the last step, limited by natural sample length. Harmonic and tapping timbres are approximate.
Pick direction is notation only. Natural harmonics use frets 5, 7, 12, 19 or 24.

### Tab dosyası içe aktarma ve alternatif akortlar / Tab file import and alternate tunings

Editörün üstündeki **Dosya içe aktar** menüsünden Guitar Pro (.gp3, .gp4, .gp5, .gpx, .gp) veya MusicXML (.xml, .musicxml, .mxl) seç. Parti/ses ve ölçü aralığını belirle, **Önizle**, sonra **Tabı içe aktar**. Onaylayana kadar mevcut taslak değişmez; aktarımı tek adımda geri alabilirsin. Dosyalar tarayıcıda okunur, sunucuya yüklenmez. Okuyucu [alphaTab 1.9.0](https://github.com/CoderLine/alphaTab/tree/v1.9.0) kullanır; lisans ve kaynak bilgisi `dist/vendor/alphatab/` altındadır.

İlk sürüm sınırları: en fazla 10 MB, 128 adım, altı tel, 0–24 perde ve seçilen tek ses. Tempo/ölçü değişen aralıklarda, eksik ölçülerde veya farklı sürelerle bağlanmış akorlarda daha dar/sade bir aralık istenir. Tekrarlar açılmaz; süsleme notaları atlanır ve temsil edilemeyen teknikler önizlemede bildirilir. Özgün örnek MusicXML ve Guitar Pro 7 gidiş-dönüş testleri mevcuttur; her üreticinin tüm dosya varyasyonları doğrulanmış değildir.

**Gitar akordu** menüsünde Standart E, Drop D, yarım ses pes, D standard, Drop C, DADGAD, Open G ve Open D bulunur. Özel akordu ince telden kalın tele oktavlarla yaz (ör. E4 B3 G3 D3 A2 D2), ardından uygula. Perdeler değişmez; tel etiketleri ve oynatma yeni akorda göre güncellenir. Akort taslak/JSON ile korunur ve geri alınabilir. Ana sayfadaki mikrofon akort cihazı hâlâ standart E hedeflerini kullanır.

Use **Import file** above the editor to choose Guitar Pro (.gp3, .gp4, .gp5, .gpx, .gp) or MusicXML (.xml, .musicxml, .mxl). Select a part/voice and measure range, **Preview**, then **Import tab**. The existing draft changes only when applied; the whole import is undoable. Files are parsed locally with alphaTab 1.9.0 and never uploaded. License and source notices are in `dist/vendor/alphatab/`.

Initial limits: 10 MB, 128 steps, six strings, frets 0–24, and one selected voice. Variable tempo/meter, pickup measures, and chords with independently tied notes require a narrower or simpler range. Repeats are not expanded; grace notes are skipped and unsupported techniques produce preview warnings. Original MusicXML and Guitar Pro 7 round-trip fixtures are tested; not every producer’s format variation has been verified.

**Guitar tuning** offers Standard E, Drop D, half step down, D standard, Drop C, DADGAD, Open G and Open D, plus custom six-note tuning with octaves from highest string to lowest. Apply to update string labels and playback while preserving frets. Tuning is saved in drafts/JSON and can be undone. The microphone tuner on the practice page still targets standard E.

### Ses kartı girişi / Audio interface input

Ana sayfada **Ses kartı ve giriş** alanından aygıtı ve gitarın bağlı olduğu kanalı seç. **Girişi test et** ile tarayıcı iznini ver; tarayıcı bu izne ses kartında da “mikrofon” diyebilir. İzin sonrası aygıt adları yenilenir. Sol/Mono (kanal 1), Sağ (kanal 2) veya mono karışım kullanılabilir. Fiziksel soketlerin tarayıcı kanallarıyla eşleşmesi sürücüye bağlıdır; görünmeyen kanallar için ses kartının yönlendirme ayarlarını kontrol et. Tarayıcı tek kanal sunuyorsa veya kanal sayısını bildirmiyorsa sağ giriş reddedilir. Eksik bir seçili aygıt yerine sessizce başka aygıta geçilmez.

Seviye göstergesi seçili mono sinyalin RMS değerini dBFS olarak gösterir: −60 dBFS altında sinyal beklenir, −40 dBFS altında düşük seviye uyarısı verilir. Mutlak örnek tepesi 0,98 veya üzerindeyse kırpılma uyarısı bir saniye tutulur. Bunlar giriş hazırlığı eşikleridir; çalım puanı veya analog donanımdaki kırpılmanın garantili ölçümü değildir. Testte ses kaydedilmez, sunucuya yüklenmez ve hoparlöre verilmez.

Kayıt ve akort cihazı aynı aygıt/kanal seçimini kullanır. Kayıt, seçili sinyali mono olarak kaydeder; seviye ölçümü de aynı yoldadır. Kayıt, akort veya giriş testi açıkken giriş seçimi kilitlenir. Durdurma, sayfadan ayrılma, izin iptali ve bağlantı kopmasında ses kaynakları bırakılır. Yankı giderme, gürültü bastırma ve otomatik gain kapalı istenir; uygulama tarayıcının bildirdiği gerçek durumu gösterir. Giriş tercihi bu tarayıcıda saklanır. Bu aşama ASIO denetimi veya gecikme kalibrasyonu içermez.

On the practice page, choose an **Input device** and **Input channel** under **Audio interface and input**. Use **Test input** to grant browser permission, which may be called “microphone” permission even for an audio interface. Device labels refresh after permission. Left/Mono (channel 1), Right (channel 2), or a mono mix are available. Physical socket mapping depends on the driver; only channels exposed to the browser are accessible. Right is rejected for mono or unknown channel counts. A missing selected device does not silently fall back to another input.

The meter shows the selected mono signal’s RMS level in dBFS. Below −60 dBFS it waits for signal; below −40 dBFS it warns about low input. An absolute sample peak of at least 0.98 holds a clipping warning for one second. These are preparation thresholds, not a performance score or a guaranteed detector of analog clipping. Input testing does not record, upload, or play audio through speakers.

Recording and the tuner share the selected input and channel. Recording captures the routed mono signal used by the meter. Input choices are locked during recording, tuning or testing. Stop, page exit, cancellation and disconnection release audio resources. Echo cancellation, noise suppression and automatic gain are requested off; the interface shows what the browser actually reports. Device and channel preferences are saved locally. ASIO control and latency calibration are not part of this step.

Browser capture reference: [MDN constraints and settings](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints).
