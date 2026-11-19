import { importFileLimit } from "./score-file-import.js";
export class ScoreImportClient {
  worker = null;
  request = null;
  serial = 0;
  generation = 0;
  close(message = "Dosya işlemi iptal edildi.") {
    this.generation++;
    this.worker?.terminate();
    this.worker = null;
    if (this.request) {
      clearTimeout(this.request.timer);
      this.request.reject(new Error(message));
      this.request = null;
    }
  }
  send(data, transfer = []) {
    return new Promise((resolve, reject) => {
      const id = ++this.serial;
      const timer = setTimeout(
        () =>
          this.close("Dosya işlemi çok uzun sürdü. Daha küçük bir dosya seç."),
        15000,
      );
      this.request = { id, resolve, reject, timer };
      try {
        this.worker.postMessage({ ...data, id }, transfer);
      } catch {
        this.close(
          "Dosya okuyucusu başlatılamadı. Sayfayı yenileyip tekrar dene.",
        );
      }
    });
  }
  async open(file) {
    this.close();
    const generation = this.generation;
    if (!file.size || file.size > importFileLimit)
      throw new Error("Boş olmayan ve en fazla 10 MB bir tab dosyası seç.");
    if (!/\.(gp[345]?|gpx|musicxml|xml|mxl)$/i.test(file.name))
      throw new Error("Guitar Pro veya MusicXML dosyası seç.");
    const bytes = await file.arrayBuffer();
    if (generation !== this.generation)
      throw new Error("Dosya işlemi iptal edildi.");
    const worker = new Worker(
      new URL("./score-import-worker.js", import.meta.url),
      { type: "module" },
    );
    this.worker = worker;
    worker.onmessage = ({ data }) => {
      const request = this.request;
      if (this.worker !== worker || !request || request.id !== data.id) return;
      clearTimeout(request.timer);
      this.request = null;
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data);
    };
    worker.onerror = () => {
      if (this.worker === worker)
        this.close(
          "Dosya okuyucusu başlatılamadı. Sayfayı yenileyip tekrar dene.",
        );
    };
    return this.send({ type: "open", bytes }, [bytes]);
  }
  convert(part, first, last) {
    if (!this.worker || this.request)
      return Promise.reject(
        new Error("Önce dosyayı aç ve işlemin bitmesini bekle."),
      );
    return this.send({ type: "convert", part, first, last });
  }
}
