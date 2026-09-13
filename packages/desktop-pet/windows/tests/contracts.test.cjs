const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { presentation, origin } = require("../observation.cjs");
const {
  AppearanceStore,
  svgSize,
  rows,
  validateCatalog,
} = require("../appearance.cjs");
const { Preferences } = require("../storage.cjs");
const bundled = path.resolve(__dirname, "../../default-appearance");

test("empty bubble layout preserves the character anchor at every supported scale", async () => {
  const source = await fs.readFile(path.join(__dirname, "../main.cjs"), "utf8");
  const start = source.indexOf("  function layout(offset = 0) {");
  const end = source.indexOf("  let deliveredAppearance", start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({
    appearance: { catalog: { canvas: { width: 100, height: 100 }, anchor: { x: 50, y: 90 } } },
    prefs: { value: { scale: 1 } }, anchor: { x: 500, y: 600 },
    tasks: { cards: [{}] }, requestedBubbleHeight: 200, bubbleHeight: 200,
    screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1600, height: 1200 } }) },
    win: { setBounds() {} },
  });
  vm.runInContext(source.slice(start, end), context);
  for (const scale of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
    context.prefs.value.scale = scale;
    context.tasks.cards = [{}];
    const shown = context.layout();
    const shownHeight = context.bubbleHeight;
    context.tasks.cards = [];
    const hidden = context.layout();
    assert.equal(context.bubbleHeight, 0);
    assert.equal(hidden.height, Math.ceil(144 * scale + 16));
    assert.equal(hidden.x, shown.x);
    assert.equal(hidden.y, shown.y + shownHeight, "removing the bubble preserves the character screen position");
    context.tasks.cards = [{}];
    assert.deepEqual(context.layout(), shown);
  }
});

test("the bubble starts hidden and author styles respect hidden controls", async () => {
  const html = await fs.readFile(path.join(__dirname, "../view.html"), "utf8");
  const css = await fs.readFile(path.join(__dirname, "../view.css"), "utf8");
  assert.match(html, /id="bubble" hidden/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});

test("presentation follows Core lifecycle and never replays completion after a discontinuity", () => {
  const task = {
    task_id: "task-a",
    lifecycle: "active",
    current_node: "IMPLEMENT",
    archived: false,
  };
  const active = presentation(task, null);
  const done = presentation({ ...task, lifecycle: "done" }, active);
  assert.equal(done.clip, "complete");
  assert.equal(done.prompt, true);
  assert.equal(
    presentation({ ...task, lifecycle: "done" }, done).prompt,
    false,
  );
  assert.equal(
    presentation({ ...task, lifecycle: "done" }, active, true, true, false)
      .prompt,
    false,
  );
  const disconnected = presentation(null, active, false);
  assert.equal(disconnected.clip, "disconnected");
  assert.equal(disconnected.summary, task);
  assert.equal(disconnected.stale, true);
  assert.equal(
    presentation({ ...task, lifecycle: "done" }, disconnected).prompt,
    false,
  );
  assert.equal(
    presentation({ ...task, current_node: "COMPREHENSION_REVIEW" }, active)
      .clip,
    "review",
  );
  assert.equal(
    presentation({ ...task, lifecycle: "blocked", blocker: "review" }, active)
      .clip,
    "blocked",
  );
  assert.equal(presentation(null, active, true, true).phase, "missing");
  assert.equal(presentation({ ...task, archived: true }, active).rest, true);
  assert.equal(origin("http://127.0.0.1:45678"), true);
  assert.equal(origin("http://localhost:45678"), false);
  assert.equal(origin("https://example.com"), false);
});
test("default native artwork retains nine clips and 312 frames", async () => {
  const store = new AppearanceStore("", bundled);
  const value = await store.load(bundled);
  assert.equal(Object.keys(value.catalog.clips).length, 9);
  assert.equal(
    Object.values(value.catalog.clips).reduce((n, c) => n + c.frames.length, 0),
    312,
  );
  assert.equal(
    rows.reduce((n, [, d]) => n + d.length, 0),
    57,
  );
  assert.throws(
    () =>
      validateCatalog({
        ...value.catalog,
        clips: {
          ...value.catalog.clips,
          complete: { ...value.catalog.clips.complete, loop_range: [0, 1] },
        },
      }),
    /loop/,
  );
});
test("SVG external content, unsafe paths and failed reimport preserve installed artwork", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dev-flow-pet-import-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "中文 source");
  await fs.mkdir(source);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#ff9900"/></svg>';
  await fs.writeFile(
    path.join(source, "pet.json"),
    JSON.stringify({ id: "orange", name: "橙色", image: "pet.svg" }),
  );
  await fs.writeFile(path.join(source, "pet.svg"), svg);
  const store = new AppearanceStore(path.join(root, "installed"), bundled);
  const result = await store.import(source);
  assert.equal(result.id, "orange");
  assert.equal(result.catalog.clips.complete.loop_range, null);
  await fs.writeFile(
    path.join(source, "pet.svg"),
    svg.replace("<rect", "<script"),
  );
  await assert.rejects(store.import(source));
  assert.equal(
    (await store.selected("orange")).frames["static.svg"],
    result.frames["static.svg"],
  );
  await fs.writeFile(
    path.join(source, "pet.json"),
    JSON.stringify({ id: "orange", name: "Orange", image: "../outside.png" }),
  );
  await assert.rejects(store.import(source), /relative/);
  assert.throws(() =>
    svgSize(Buffer.from('<!DOCTYPE svg SYSTEM "https://example.com/a"><svg/>')),
  );
  assert.throws(() =>
    svgSize(Buffer.from(svg.replace("<rect", '<use href="file:///C:/x"'))),
  );
});
test("concurrent preference updates keep independent selections and exact scale", async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "dev-flow-pet-settings-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const prefs = new Preferences(root);
  await prefs.load();
  await Promise.all([
    prefs.update((p) => {
      p.scale = 1.5;
    }),
    prefs.update((p) => {
      p.pinned_tasks.a = "task-a";
    }),
    prefs.update((p) => {
      p.selected_appearance = "orange";
    }),
  ]);
  const reopened = new Preferences(root);
  await reopened.load();
  assert.equal(reopened.value.scale, 1.5);
  assert.equal(reopened.value.pinned_tasks.a, "task-a");
  assert.equal(reopened.value.selected_appearance, "orange");
});
