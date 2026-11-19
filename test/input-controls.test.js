import test from "node:test";
import assert from "node:assert/strict";
import { initializeInputControls } from "../dist/input-controls.js";

test("Giriş seçimi saklanır, aygıt listesi geç gelse de korunur ve izin beklerken test durdurulabilir", async () => {
  const keys = ["navigator", "document", "localStorage"];
  const previous = Object.fromEntries(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  class Element {
    dataset = {};
    children = [];
    listeners = {};
    attributes = {};
    value = "";
    isConnected = true;
    style = { setProperty() {} };
    addEventListener(name, listener) {
      this.listeners[name] = listener;
    }
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
    replaceChildren() {
      this.children = [];
    }
    append(child) {
      this.children.push(child);
    }
    get options() {
      return this.children;
    }
    fire(name) {
      return this.listeners[name]?.();
    }
  }
  const ids = [
    "inputDevice",
    "inputChannel",
    "inputTest",
    "inputRefresh",
    "inputLevel",
    "inputLevelValue",
    "inputLevelStatus",
    "inputConnection",
    "inputProcessing",
    "inputStatus",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  elements.inputChannel.value = "left";
  let saved = JSON.stringify({ deviceId: "saved-card", channel: "right" });
  let list;
  let grant;
  let stopped = 0;
  let removed = 0;
  const track = {
    stop() {
      stopped++;
    },
  };
  const enumeration = new Promise((resolve) => {
    list = resolve;
  });
  const permission = new Promise((resolve) => {
    grant = () => resolve({ getTracks: () => [track] });
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      querySelector: (selector) => elements[selector.slice(1)],
      createElement: () => new Element(),
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => saved,
      setItem: (key, value) => {
        saved = value;
      },
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        enumerateDevices: () => enumeration,
        getUserMedia: () => permission,
        addEventListener() {},
        removeEventListener() {
          removed++;
        },
      },
    },
  });
  let controls;
  try {
    controls = initializeInputControls({
      onStart: () => controls.setDisabled(true),
      onStop: () => controls.setDisabled(false),
    });
    assert.deepEqual(controls.options(), {
      deviceId: "saved-card",
      channel: "right",
    });
    elements.inputChannel.value = "left";
    elements.inputChannel.fire("change");
    assert.equal(JSON.parse(saved).deviceId, "saved-card");
    list([
      { kind: "audioinput", deviceId: "saved-card", label: "Audio interface" },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(elements.inputDevice.value, "saved-card");
    elements.inputDevice.value = "new-card";
    elements.inputDevice.fire("change");
    assert.equal(JSON.parse(saved).deviceId, "new-card");
    elements.inputRefresh.fire("click");
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(
      elements.inputDevice.value,
      "new-card",
      "kayıp aygıt varsayılana çevrilmez",
    );
    const opening = elements.inputTest.fire("click");
    assert.equal(elements.inputDevice.disabled, true);
    assert.equal(
      elements.inputTest.disabled,
      false,
      "izin beklerken durdurma kullanılabilir",
    );
    await elements.inputTest.fire("click");
    assert.equal(elements.inputDevice.disabled, false);
    grant();
    await opening;
    assert.equal(stopped, 1);
    controls.setLevel({ db: -6, peak: 1, clipped: true });
    assert.equal(elements.inputLevel.dataset.level, "clip");
    assert.match(elements.inputLevelStatus.textContent, /kırpılıyor/);
    controls.setLevel(null);
    assert.equal(elements.inputLevel.dataset.level, "idle");
  } finally {
    controls?.dispose();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
  assert.equal(removed, 1);
});
