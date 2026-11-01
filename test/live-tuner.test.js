import test from "node:test";
import assert from "node:assert/strict";
import { LiveTuner } from "../dist/live-tuner.js";

function mockMicrophone(context) {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const oldContext = globalThis.AudioContext;
  let stopped = false;
  const track = {
    onended: null,
    stop() {
      stopped = true;
    },
  };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  let grant;
  const permission = new Promise((resolve) => {
    grant = resolve;
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia: () => permission } },
  });
  globalThis.AudioContext = class {
    constructor() {
      this.state = "running";
      this.sampleRate = 48000;
    }
    async resume() {}
    createAnalyser() {
      return { getFloatTimeDomainData() {} };
    }
    createMediaStreamSource() {
      return { connect() {} };
    }
    async close() {
      this.state = "closed";
    }
  };
  const tuner = new LiveTuner({ onPitch() {}, onEnded() {} });
  context.after(() => {
    tuner.stop();
    if (oldNavigator)
      Object.defineProperty(globalThis, "navigator", oldNavigator);
    else delete globalThis.navigator;
    if (oldContext) globalThis.AudioContext = oldContext;
    else delete globalThis.AudioContext;
  });
  return { tuner, track, grant: () => grant(stream), isStopped: () => stopped };
}

test("İzin beklerken durdurulursa sonradan gelen mikrofon kapatılır", async (context) => {
  const microphone = mockMicrophone(context);
  const starting = microphone.tuner.start();
  microphone.tuner.stop();
  microphone.grant();
  await starting;
  assert.equal(microphone.tuner.running, false);
  assert.equal(microphone.isStopped(), true);
  assert.equal(microphone.tuner.context, null);
});

test("Durdurma mikrofonu ve ses bağlamını serbest bırakır", async (context) => {
  const microphone = mockMicrophone(context);
  const starting = microphone.tuner.start();
  microphone.grant();
  await starting;
  const audioContext = microphone.tuner.context;
  assert.equal(microphone.tuner.running, true);
  microphone.tuner.stop();
  assert.equal(microphone.isStopped(), true);
  assert.equal(audioContext.state, "closed");
  assert.equal(microphone.track.onended, null);
  assert.equal(microphone.tuner.running, false);
});

test("Ses bağlamı başlatılamazsa mikrofon açık kalmaz", async (context) => {
  const microphone = mockMicrophone(context);
  globalThis.AudioContext.prototype.resume = async () => {
    throw new Error("Audio unavailable");
  };
  const starting = microphone.tuner.start();
  microphone.grant();
  await assert.rejects(starting, /Audio unavailable/);
  assert.equal(microphone.tuner.running, false);
  assert.equal(microphone.isStopped(), true);
});
