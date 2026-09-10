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

test("stacked cards expand and each action retains its task ID", async () => {
  const renderer = createRenderer();
  const state = stateFor("active");
  state.labels = { tasks: "unfinished", blocked: "blocked", pin: "Pin", noSelection: "Auto", dismiss: "Dismiss" };
  state.cards = ["a", "b", "c", "d"].map(id => ({ taskID: id, unread: id === "d",
    result: { phase: "active", summary: { task_id: id, request_summary: "Task " + id, lifecycle: "active" } } }));
  renderer.publish(state);
  const cards = renderer.document.querySelector("#cards");
  assert.equal(cards.children.length, 3);
  assert.match(renderer.document.querySelector("#activityToggle").textContent, /\+1/);
  cards.children[1].children[0].onclick();
  assert.deepEqual(renderer.commands.at(-1), ["open", "b"]);
  renderer.document.body.onmouseenter();
  assert.equal(cards.children.length, 4);
  cards.children[2].children[2].onclick();
  assert.deepEqual(renderer.commands.at(-1), ["select", "c"]);
  cards.children[3].children[3].onclick();
  assert.deepEqual(renderer.commands.at(-1), ["dismiss", "d"]);
});

test("empty cards hide the bubble through hover and restore after a task arrives", () => {
  const renderer = createRenderer();
  const state = stateFor("idle");
  renderer.publish(state);
  const bubble = renderer.document.querySelector("#bubble");
  const toggle = renderer.document.querySelector("#activityToggle");
  assert.equal(bubble.hidden, true);
  assert.equal(toggle.hidden, true);
  assert.ok(renderer.commands.some(([name, value]) => name === "bubble-height" && value === 0));
  renderer.document.body.onmouseenter();
  assert.equal(bubble.hidden, true);
  assert.equal(toggle.hidden, true);

  state.cards = [{ taskID: "a", result: { phase: "active", summary: { request_summary: "Task a", lifecycle: "active" } } }];
  renderer.publish(state);
  assert.equal(bubble.hidden, false);
  assert.equal(renderer.document.querySelector("#cards").children.length, 1);
  state.cards = [];
  renderer.publish(state);
  assert.equal(bubble.hidden, true);
  assert.equal(toggle.hidden, true);
  assert.equal(renderer.document.querySelector("#cards").children.length, 0);
  assert.deepEqual(renderer.commands.at(-1), ["bubble-height", 0]);

  renderer.image.onpointerdown({ button: 0, screenX: 100, screenY: 100, pointerId: 1 });
  renderer.image.onpointerup();
  assert.deepEqual(renderer.commands.at(-1), ["open", undefined], "the character still opens navigation without cards");
});

test("removing the bubble releases a stationary pointer and character hover restores input", () => {
  const renderer = createRenderer();
  const state = stateFor("active");
  state.cards = [{ taskID: "a", result: { phase: "active", summary: { lifecycle: "active" } } }];
  renderer.publish(state);
  const bubble = renderer.document.querySelector("#bubble");
  renderer.document.elementFromPoint = () => ({ closest: () => bubble.hidden ? null : bubble });
  renderer.document.listeners.mousemove({ clientX: 100, clientY: 20 });
  state.cards = [];
  renderer.publish(state);
  assert.deepEqual(renderer.commands.at(-1), ["hit", false]);
  renderer.document.elementFromPoint = () => ({ closest: () => renderer.image });
  renderer.document.listeners.mousemove({ clientX: 100, clientY: 100 });
  assert.deepEqual(renderer.commands.at(-1), ["hit", true]);
});

function createRenderer() {
  const commands = [], elements = new Map(), timers = new Map();
  let publish, interval, now = 0, nextID = 0;
  const element = () => ({ style: {}, children: [], append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; }, addEventListener() {}, setPointerCapture() {}, classList: { add() {}, remove() {}, toggle() {} } });
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    createElement: element,
    body: element(),
    listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
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
    commands, document,
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
