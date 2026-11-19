import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("Dosya işçisi geçerli dosyayı önizler, bozuk dosyadan sonra eski veriyi kullanmaz", async () => {
  const previous = globalThis.self;
  const replies = [];
  globalThis.self = { postMessage: (data) => replies.push(data) };
  try {
    await import("../dist/score-import-worker.js");
    const bytes = readFileSync(
      new URL("./fixtures/import-guitar.musicxml", import.meta.url),
    );
    self.onmessage({ data: { type: "open", id: 1, bytes } });
    assert.equal(replies.at(-1).parts.length, 1);
    self.onmessage({
      data: { type: "convert", id: 2, part: "0/0/0", first: 1, last: 2 },
    });
    assert.equal(replies.at(-1).score.events.length, 7);
    self.onmessage({
      data: {
        type: "open",
        id: 3,
        bytes: new TextEncoder().encode("invalid guitar pro"),
      },
    });
    assert.match(replies.at(-1).error, /Geçerli bir Guitar Pro/);
    self.onmessage({
      data: { type: "convert", id: 4, part: "0/0/0", first: 1, last: 2 },
    });
    assert.match(replies.at(-1).error, /Önce bir dosya/);
  } finally {
    if (previous === undefined) delete globalThis.self;
    else globalThis.self = previous;
  }
});
