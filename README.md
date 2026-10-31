# Ritim İzi

[Türkçe](#başlatma) · [English](#english)

Gitar egzersizlerini mikrofon veya ses dosyası üzerinden inceleyen tarayıcı uygulaması.

Üst çubuktan Türkçe veya İngilizce arayüzü seçebilir, açık ve karanlık tema arasında geçiş yapabilirsin. Tercihler bu tarayıcıda saklanır. İlk açılışta tema sistem ayarına uyar; varsayılan dil Türkçedir.

## Başlatma

Node.js 22 veya üzeri kurulu olmalı. Proje klasöründe:

```sh
npm install
npm start
```

Tarayıcıda http://127.0.0.1:4173 adresini aç. Mikrofon için localhost veya HTTPS gerekir; HTML dosyasını çift tıklayarak açmak yeterli değildir.

## Kullanım

1. Hedef BPM ve vuruş başına nota sayısını seç.
2. İstersen metronomla alıştırma yap. Metronom kayıt başlarken susar.
3. Mikrofonla en az 5 notayı eşit aralıklarla çal veya ses dosyası seç.
4. Analiz sonucunda tahmini tempo, ritim tutarlılığı ve nota aralığı dalgalanmasını incele.
5. Kaydı saklamak için “Kaydı indir” bağlantısını kullan.

Kayıt sınırı 3 saniye–3 dakika, dosya boyutu sınırı 30 MB'dir. Tarayıcının çözebildiği WAV, MP3, M4A, OGG, WebM ve FLAC dosyaları kullanılabilir. Ses dosyaları sunucuya gönderilmez; sayfa kapandığında indirilmeyen kayıt kaybolur.

## Analizin sınırları

Bu sürüm eşit nota aralıkları olan tek sesli egzersizler için yaklaşık ritim analizi yapar. Düz metin tab, çalışma notudur; sesle nota nota karşılaştırılmaz. Değişen nota süreleri, suslar, distortion, akorlar ve arka plan sesleri tahmini etkiler.

Tempo, tipik nota başlangıcı aralığı ve seçilen nota sıklığı üzerinden hesaplanır. Tutarlılık puanı, aralıkların değişimine dayanır; hedef BPM'den bağımsızdır. Milisaniye değeri nota aralıklarının tipik aralıktan RMS sapmasıdır; nota bazında erken/geç ölçümü değildir.

Örnek sonuç yalnızca “Örnek sonucu gör” düğmesinden açılır ve açıkça etiketlenir. Sessiz, çok kısa veya okunamayan kayıtlara sonuç uydurulmaz.

## Kod düzeni

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

### Getting started

Install Node.js 22 or newer, then run these commands in the project directory:

```sh
npm install
npm start
```

Open http://127.0.0.1:4173 in your browser. Microphone access requires localhost or HTTPS. Opening the HTML file directly will not work.

Use the header controls to switch between Turkish and English, or between light and dark mode. Your preferences are saved in this browser. On first use, the theme follows your system setting and the language defaults to Turkish. Changing language or theme preserves the selected audio and displayed analysis.

### How to use

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

Example results are explicitly labeled and can only be opened with the example button. Silent, short, or unreadable recordings produce an error instead of fabricated results.

### Project structure

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
