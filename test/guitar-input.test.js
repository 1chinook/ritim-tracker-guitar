import test from "node:test";
import assert from "node:assert/strict";
import {
  GuitarInput,
  routeInput,
  measureInput,
  inputError,
} from "../dist/guitar-input.js";
import { GuitarRecorder } from "../dist/audio.js";

function environment(
  t,
  {
    pending = false,
    channels = 2,
    resumeError = false,
    recorderError = false,
  } = {},
) {
  const saved = Object.fromEntries(
    [
      "navigator",
      "AudioContext",
      "MediaRecorder",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const inputTrack = {
    label: "Test audio interface",
    readyState: "live",
    stop() {
      this.stopped = true;
    },
    getSettings: () => ({
      channelCount: channels,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }),
  };
  const rawStream = {
    getTracks: () => [inputTrack],
    getAudioTracks: () => [inputTrack],
  };
  const contexts = [];
  const recorders = [];
  const requests = [];
  let grant;
  const permission = new Promise((resolve) => {
    grant = () => resolve(rawStream);
  });
  function render(node) {
    if (node.kind === "source")
      return channels === 1
        ? [[0.2, 0.4]]
        : [
            [0.2, 0.4],
            [0.8, 0.6],
          ];
    let signal = [];
    for (const { from, output } of node.edges) {
      const all = render(from);
      signal = from.kind === "splitter" ? [all[output] ?? [0, 0]] : all;
    }
    if (node.kind === "gain" && node.channelCount === 1 && signal.length > 1)
      return [
        signal[0].map(
          (_, i) => signal.reduce((sum, ch) => sum + ch[i], 0) / signal.length,
        ),
      ];
    return signal;
  }
  function makeNode(kind) {
    return {
      kind,
      edges: [],
      connect(target, output = 0) {
        target.edges.push({ from: this, output });
        return target;
      },
      disconnect() {
        this.disconnected = true;
      },
    };
  }
  class Context {
    state = "running";
    sampleRate = 48000;
    nodes = [];
    constructor() {
      contexts.push(this);
      this.destination = makeNode("speaker");
    }
    async resume() {
      if (resumeError) throw new Error("resume failed");
    }
    async close() {
      this.state = "closed";
    }
    createMediaStreamSource() {
      const n = makeNode("source");
      this.nodes.push(n);
      return n;
    }
    createGain() {
      const n = makeNode("gain");
      this.nodes.push(n);
      return n;
    }
    createChannelSplitter() {
      const n = makeNode("splitter");
      this.nodes.push(n);
      return n;
    }
    createAnalyser() {
      const n = makeNode("analyser");
      n.getFloatTimeDomainData = (samples) =>
        samples.fill(render(n)[0]?.[0] ?? 0);
      n.getByteTimeDomainData = (samples) => samples.fill(128);
      this.nodes.push(n);
      return n;
    }
    createMediaStreamDestination() {
      const n = makeNode("destination");
      const track = {
        stop() {
          this.stopped = true;
        },
      };
      n.stream = {
        getTracks: () => [track],
        getAudioTracks: () => [track],
        pcm: () => render(n),
      };
      this.nodes.push(n);
      return n;
    }
  }
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (options) => {
          requests.push(options);
          return pending ? permission : rawStream;
        },
      },
    },
  });
  globalThis.AudioContext = Context;
  globalThis.MediaRecorder = class {
    static isTypeSupported() {
      return true;
    }
    state = "inactive";
    mimeType = "audio/webm;codecs=opus";
    constructor(stream) {
      if (recorderError) throw new Error("encoder failed");
      this.stream = stream;
      recorders.push(this);
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(["test capture"]) });
        this.onstop?.();
      });
    }
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  t.after(() => {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    inputTrack,
    rawStream,
    contexts,
    recorders,
    requests,
    grant,
    Context,
  };
}
const canvas = {
  width: 10,
  height: 10,
  getContext: () => ({
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  }),
};

test("Sol, sağ ve karışım farklı giriş örneklerini aynı mono kayıt ve ölçüm yoluna taşır", (t) => {
  const env = environment(t);
  for (const [channel, expected] of [
    ["left", [0.2, 0.4]],
    ["right", [0.8, 0.6]],
    ["mix", [0.5, 0.5]],
  ]) {
    const ctx = new env.Context();
    const route = routeInput(ctx, env.rawStream, channel, 2);
    assert.deepEqual(route.stream.pcm(), [expected]);
    const measured = new Float32Array(2);
    route.analyser.getFloatTimeDomainData(measured);
    assert.ok(Math.abs(measured[0] - expected[0]) < 0.00001);
    assert.equal(
      ctx.destination.edges.length,
      0,
      "test sinyali hoparlöre gönderilmez",
    );
  }
  assert.throws(
    () => routeInput(new env.Context(), env.rawStream, "right", 1),
    /iki giriş kanalı/,
  );
});
test("Seçili ses kartı kesin cihaz kimliğiyle açılır, otomatik işleme kapatılır ve kapanışta tüm kaynaklar bırakılır", async (t) => {
  const env = environment(t);
  const input = new GuitarInput();
  t.after(() => input.close());
  const info = await input.open({ deviceId: "interface-1", channel: "right" });
  assert.deepEqual(env.requests[0], {
    audio: {
      deviceId: { exact: "interface-1" },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 },
    },
  });
  assert.equal(info.channels, 2);
  const output = input.stream.getTracks()[0];
  input.close();
  assert.ok(env.inputTrack.stopped && output.stopped);
  assert.equal(env.contexts[0].state, "closed");
  assert.ok(env.contexts[0].nodes.every((node) => node.disconnected));
});
test("İzin beklerken giriş kapatılırsa geç gelen akış açık kalmaz", async (t) => {
  const env = environment(t, { pending: true });
  const input = new GuitarInput();
  const opening = input.open();
  input.close();
  env.grant();
  assert.equal(await opening, null);
  assert.ok(env.inputTrack.stopped);
  assert.equal(env.contexts.length, 0);
});
test("Ses bağlamı veya kodlayıcı açılamazsa ses kartı serbest bırakılır", async (t) => {
  const env = environment(t, { resumeError: true });
  const input = new GuitarInput();
  await assert.rejects(input.open(), /resume failed/);
  assert.ok(env.inputTrack.stopped);
  assert.equal(env.contexts[0].state, "closed");
});
test("Mono girişte sağ kanal sessiz kayıt üretmek yerine açık hata verir", async (t) => {
  const env = environment(t, { channels: 1 });
  const input = new GuitarInput();
  await assert.rejects(input.open({ channel: "right" }), /iki giriş kanalı/);
  assert.ok(env.inputTrack.stopped);
});
test("Kayıt ham stereo yerine seçili kanalı alır ve durunca tek kayıt tamamlar", async (t) => {
  const env = environment(t);
  const completed = [];
  const recorder = new GuitarRecorder({
    canvas,
    onTime() {},
    onError() {
      assert.fail("unexpected error");
    },
    onComplete: (...args) => completed.push(args),
  });
  t.after(() => recorder.dispose());
  await recorder.prepare({ deviceId: "card", channel: "right" });
  recorder.start();
  assert.notEqual(env.recorders[0].stream, env.rawStream);
  assert.deepEqual(env.recorders[0].stream.pcm(), [[0.8, 0.6]]);
  recorder.stop();
  await Promise.resolve();
  assert.equal(completed.length, 1);
  assert.equal(completed[0][1], "webm");
  assert.ok(env.inputTrack.stopped);
  assert.equal(env.contexts[0].state, "closed");
});
test("Ses kartı kayıt sırasında çıkarılırsa başarısız kayıt tamamlanmış gibi gösterilmez", async (t) => {
  const env = environment(t);
  let errors = 0,
    complete = 0;
  const recorder = new GuitarRecorder({
    canvas,
    onTime() {},
    onError() {
      errors++;
    },
    onComplete() {
      complete++;
    },
  });
  t.after(() => recorder.dispose());
  await recorder.prepare();
  recorder.start();
  env.inputTrack.onended();
  await Promise.resolve();
  assert.equal(errors, 1);
  assert.equal(complete, 0);
  assert.equal(recorder.isRecording, false);
  assert.equal(env.contexts[0].state, "closed");
});
test("Kayıt hazırlığı sırasında çıkış yapılınca sonradan kayıt oluşturulmaz", async (t) => {
  const env = environment(t, { pending: true });
  const recorder = new GuitarRecorder({ onLevel() {} });
  const opening = recorder.prepare();
  recorder.dispose();
  env.grant();
  assert.equal(await opening, null);
  assert.equal(env.recorders.length, 0);
  assert.ok(env.inputTrack.stopped);
});
test("Kodlayıcı hatasında giriş ve ses bağlamı kapatılır", async (t) => {
  const env = environment(t, { recorderError: true });
  const recorder = new GuitarRecorder({});
  await assert.rejects(recorder.prepare(), /encoder failed/);
  assert.ok(env.inputTrack.stopped);
  assert.equal(env.contexts[0].state, "closed");
});
test("Seviye ölçümü sessizlikte sonlu kalır, RMS ve kırpılma tepesini ayırır", () => {
  assert.deepEqual(measureInput(new Float32Array(10)), { peak: 0, db: -72 });
  const level = measureInput(new Float32Array([0.5, -0.5]));
  assert.equal(level.peak, 0.5);
  assert.ok(Math.abs(level.db + 6.0206) < 0.001);
  assert.equal(measureInput(new Float32Array([1, -1])).peak, 1);
  assert.match(inputError({ name: "NotAllowedError" }), /izin/);
  assert.match(inputError({ name: "OverconstrainedError" }), /bulunamadı/);
  assert.match(inputError({ name: "NotReadableError" }), /Başka bir uygulama/);
});
