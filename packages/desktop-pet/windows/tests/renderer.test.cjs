const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Exercise the shipped renderer with a simulated DOM, IPC and clock on either OS.
// Native window movement belongs to the Windows Electron check in native.cjs.
test("resizing a walking pet cancels its activity and schedules the next idle activity", () => {
  const renderer = createRenderer();
  const state = stateFor("idle");
  renderer.publish(state);
  renderer.tick(0);
  renderer.tick(6000);
  assert.equal(renderer.image.src, "running-right-0");
  assert.deepEqual(renderer.commands.at(-1), ["walk", 1]);

  renderer.commands.length = 0;
  renderer.publish(state);
  assert.equal(renderer.image.src, "running-right-0");
  assert.equal(renderer.commands.length, 0, "ordinary polls preserve walking");

  state.preferences.scale = 1.5;
  renderer.publish(state);
  assert.equal(renderer.image.src, "idle-0");
  assert.equal(renderer.image.style.width, "216px");
  assert.deepEqual(renderer.commands.at(-1), ["walk", 0]);
  renderer.nextFrame();
  assert.equal(renderer.image.src, "idle-1", "the previous walking timer is cancelled");

  renderer.tick(6001);
  renderer.tick(12001);
  assert.equal(renderer.image.src, "running-left-0");
  assert.deepEqual(renderer.commands.at(-1), ["walk", -1]);
});

test("resizing preserves work and completion playback already in progress", () => {
  const renderer = createRenderer();
  const state = stateFor("active");
  renderer.publish(state);
  renderer.nextFrame();
  assert.equal(renderer.image.src, "working-1");
  state.preferences.scale = 1.5;
  renderer.publish(state);
  assert.equal(renderer.image.src, "working-1");

  state.display = { phase: "done", clip: "complete", prompt: true, rest: false };
  renderer.publish(state);
  renderer.nextFrame();
  assert.equal(renderer.image.src, "complete-1");
  state.display.prompt = false;
  state.preferences.scale = 2;
  renderer.publish(state);
  assert.equal(renderer.image.src, "complete-1");
  renderer.nextFrame();
  assert.equal(renderer.image.src, "complete-2");
});

function stateFor(phase) {
  const clips = {}, frames = {};
  for (const name of ["idle", "working", "complete", "running-right", "running-left"]) {
    const names = [0, 1, 2].map(index => `${name}-${index}`);
    clips[name] = { frames: names, fps: 10, loop_range: name === "complete" ? null : [0, 2], rest_frame: 0 };
    for (const frame of names) frames[frame] = frame;
  }
  return {
    appearance: { id: "fixture", serial: 1, catalog: { canvas: { width: 100, height: 100 }, clips }, frames },
    preferences: { scale: 1, animations_enabled: true, idle_activities_enabled: true },
    display: { phase, clip: phase === "active" ? "working" : "idle", prompt: false, rest: false },
    visible: true, labels: {}, picker: null,
  };
}

function createRenderer() {
  const commands = [], elements = new Map(), timers = new Map();
  let publish, interval, now = 0, nextID = 0;
  const element = () => ({ style: {}, addEventListener() {}, classList: { add() {}, remove() {} } });
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    body: element(),
    addEventListener() {},
  };
  const context = vm.createContext({
    document,
    window: { pet: {
      command: async (...args) => { commands.push(args); },
      onState(callback) { publish = callback; },
      onWalkComplete() {},
      ready() {},
    } },
    matchMedia: () => ({ matches: false }),
    Date: class extends Date { static now() { return now; } },
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    setInterval(callback) { interval = callback; },
    setTimeout(callback, delay) { timers.set(++nextID, { callback, delay }); return nextID; },
    clearTimeout(id) { timers.delete(id); },
  });
  vm.runInContext(readFileSync(join(__dirname, "../view.js"), "utf8"), context);
  return {
    commands,
    image: document.querySelector("#character"),
    publish(state) { publish(structuredClone(state)); },
    tick(time) { now = time; interval(); },
    nextFrame() {
      const [id, timer] = [...timers].find(([, value]) => value.delay === 100);
      timers.delete(id);
      timer.callback();
    },
  };
}
