import test from "node:test";
import assert from "node:assert/strict";
import { ScoreImportClient } from "../dist/score-import-client.js";
test("Dosya okunurken iptal edilirse geç kalan okuma yeni işçi açmaz", async () => {
  const client = new ScoreImportClient();
  let finish;
  const pending = client.open({
    name: "test.gp",
    size: 10,
    arrayBuffer: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  client.close();
  finish(new ArrayBuffer(10));
  await assert.rejects(pending, /iptal/);
  assert.equal(client.worker, null);
});
test("İki dosya art arda seçilince yalnızca sonuncusu okunur ve hatada işçi kapanır", async () => {
  const original = globalThis.Worker;
  const workers = [];
  class Worker {
    constructor() {
      workers.push(this);
    }
    postMessage(message) {
      this.last = message;
    }
    terminate() {
      this.closed = true;
    }
  }
  globalThis.Worker = Worker;
  const client = new ScoreImportClient();
  try {
    let finish;
    const first = client.open({
      name: "a.xml",
      size: 1,
      arrayBuffer: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const second = client.open({
      name: "b.gp",
      size: 2,
      arrayBuffer: async () => new ArrayBuffer(2),
    });
    await Promise.resolve();
    finish(new ArrayBuffer(1));
    await assert.rejects(first, /iptal/);
    assert.equal(workers.length, 1);
    workers[0].onmessage({
      data: { id: workers[0].last.id, parts: [{ key: "0/0/0" }] },
    });
    assert.equal((await second).parts.length, 1);
    const conversion = client.convert("0/0/0", 1, 2);
    workers[0].onerror();
    await assert.rejects(conversion, /başlatılamadı/);
    assert.equal(workers[0].closed, true);
    assert.equal(client.worker, null);
  } finally {
    client.close();
    if (original === undefined) delete globalThis.Worker;
    else globalThis.Worker = original;
  }
});
test("Boş, aşırı büyük veya yanlış türde dosya okuyucu açılmadan reddedilir", async () => {
  const client = new ScoreImportClient();
  await assert.rejects(client.open({ name: "a.gp", size: 0 }), /10 MB/);
  await assert.rejects(
    client.open({ name: "a.gp", size: 11 * 1024 * 1024 }),
    /10 MB/,
  );
  await assert.rejects(client.open({ name: "a.pdf", size: 10 }), /Guitar Pro/);
  assert.equal(client.worker, null);
});
