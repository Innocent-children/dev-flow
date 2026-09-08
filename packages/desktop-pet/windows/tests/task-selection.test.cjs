const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { presentation } = require("../observation.cjs");

const summary = (id, lifecycle = "active") => ({ task_id: id, lifecycle, current_node: "IMPLEMENT", archived: false });

test("idle polls discover a later task and preserve the automatic selection", async () => {
  const h = await desktopHarness();
  assert.equal(h.desktop.display.phase, "idle");
  assert.equal(h.writes(), 0);
  await h.tick();
  assert.equal(h.requests.filter(r => r.startsWith("list:")).length, 4);
  h.lists.active = [summary("later")];
  await h.tick();
  assert.equal(h.desktop.display.summary.task_id, "later");
  assert.equal(h.desktop.prefs.value.selected_tasks.root, "later");
  h.lists.blocked = [summary("blocked", "blocked")];
  const lists = h.requests.filter(r => r.startsWith("list:")).length;
  await h.tick();
  assert.equal(h.desktop.display.summary.task_id, "later");
  assert.equal(h.requests.filter(r => r.startsWith("list:")).length, lists);
});

test("saved selection stays watched and clearing it resumes blocked-first discovery", async () => {
  const h = await desktopHarness("saved");
  h.lists.blocked = [summary("blocked", "blocked")];
  h.lists.active = [summary("active")];
  await h.tick();
  assert.equal(h.desktop.display.summary.task_id, "saved");
  assert.equal(h.requests.filter(r => r.startsWith("list:")).length, 0);
  await h.desktop.command("select", null);
  assert.equal(h.desktop.display.summary.task_id, "blocked");
  assert.equal(h.desktop.prefs.value.selected_tasks.root, "blocked");
});

test("failed discovery disconnects and the next poll can discover a task", async () => {
  const h = await desktopHarness();
  h.lists.blocked = () => { throw new Error("offline"); };
  await h.tick();
  assert.equal(h.desktop.display.phase, "disconnected");
  h.lists.blocked = [summary("recovered", "blocked")];
  await h.tick();
  assert.equal(h.desktop.display.summary.task_id, "recovered");
});

test("a late discovery response preserves a task chosen from the panel", async () => {
  const h = await desktopHarness();
  h.lists[""] = [summary("chosen")];
  await h.desktop.showPicker(1);
  let release, started;
  const pending = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  h.lists.blocked = () => { started(); return pending; };
  const polling = h.tick();
  await entered;
  await h.desktop.command("select", "chosen");
  release([summary("late", "blocked")]);
  await polling;
  await h.tick();
  assert.equal(h.desktop.display.summary.task_id, "chosen");
  assert.equal(h.desktop.prefs.value.selected_tasks.root, "chosen");
});

// Run the shipped main-process polling with simulated Electron, storage and HTTP.
// No native Windows window or live Core is started by these checks.
async function desktopHarness(selected = null) {
  const lists = { blocked: [], active: [], "": [] }, requests = [];
  const timers = new Map();
  let nextTimer = 0, writes = 0;
  const noop = () => {};
  class Preferences {
    constructor() {
      this.value = { selected_tasks: selected ? { root: selected } : {}, scale: 1 };
    }
    async load() {}
    async update(fn) { fn(this.value); writes++; }
  }
  class Observer {
    cancel() {}
    async connect() { requests.push("status"); }
    async list(page, lifecycle = "") {
      requests.push(`list:${lifecycle}`);
      const value = lists[lifecycle];
      return { items: typeof value === "function" ? await value() : value, has_next: false };
    }
    async detail(id) { requests.push(`detail:${id}`); return { summary: summary(id), readiness: "ready" }; }
  }
  class BrowserWindow {
    constructor() {
      this.webContents = {
        setWindowOpenHandler: noop, on: noop,
        session: { setPermissionRequestHandler: noop },
        executeJavaScript: async () => "data:image/png;base64,", send: noop,
      };
    }
    async loadFile() {}
    setAlwaysOnTop() {}
    setBounds() {}
    showInactive() {}
    isDestroyed() { return false; }
    on() {}
  }
  class AppearanceStore {
    async selected() { return { serial: 1, catalog: { canvas: { width: 128, height: 128 }, anchor: { x: 64, y: 128 } } }; }
    async list() { return []; }
  }
  const area = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  const mocks = {
    electron: {
      app: { getLocale: () => "en", on: noop }, BrowserWindow,
      Menu: { setApplicationMenu: noop, buildFromTemplate: () => ({}) },
      Tray: class { setToolTip() {} on() {} setContextMenu() {} },
      nativeImage: { createFromDataURL: noop },
      ipcMain: { handle: noop, on: noop }, powerMonitor: { on: noop },
      screen: { getPrimaryDisplay: () => area, getDisplayMatching: () => area, on: noop },
    },
    "node:fs/promises": { mkdir: async () => {} },
    "./storage.cjs": { Preferences }, "./appearance.cjs": { AppearanceStore },
    "./observation.cjs": { Observer, presentation },
  };
  const filename = path.join(__dirname, "../main.cjs");
  const context = vm.createContext({
    require: name => mocks[name] ?? require(name), module: { exports: {} },
    __dirname: path.dirname(filename), AbortController,
    setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id), clearInterval: noop,
  });
  vm.runInContext(readFileSync(filename, "utf8"), context, { filename });
  const desktop = await context.module.exports.createDesktop({ productRoot: "/simulated", dataRootDigest: "root" });
  return {
    desktop, lists, requests, writes: () => writes,
    async tick() {
      assert.equal(timers.size, 1);
      const [id, fn] = timers.entries().next().value;
      timers.delete(id);
      await fn();
    },
  };
}
