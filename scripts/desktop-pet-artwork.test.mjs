import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { stageDefaultArtwork, verifyDefaultArtwork } from "./desktop-pet-artwork.mjs";

test("default artwork is a standalone nine-action PNG pack", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "default-png-artwork-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await stageDefaultArtwork(root);
  const result = await verifyDefaultArtwork(root);
  const catalog = JSON.parse(await readFile(join(root, "animations.json"), "utf8"));
  assert.deepEqual(Object.keys(catalog.clips).sort(), [
    "blocked", "complete", "disconnected", "idle", "review", "running-left", "running-right", "waving", "working",
  ]);
  assert.equal(result.frames, 57);
  assert.deepEqual(catalog.canvas, { width: 192, height: 208 });
  for (const clip of Object.values(catalog.clips)) {
    assert.equal(clip.frame_durations_ms.length, clip.frames.length);
  }
  assert.equal(catalog.clips.complete.loop_range, null);
  assert.ok(result.asset_bytes < 3 * 1024 * 1024);
  const paths = await readdir(root, { recursive: true });
  assert.ok(paths.every((path) => !path.endsWith(".svg") && !path.endsWith(".mjs")));
  const images = paths.filter((path) => path.endsWith(".png"));
  assert.equal(images.length, 57);
  for (const path of images) {
    const png = await readFile(join(root, path));
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(png.readUInt32BE(16), catalog.canvas.width);
    assert.equal(png.readUInt32BE(20), catalog.canvas.height);
  }
});

test("verification refuses altered delivered artwork", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "altered-png-artwork-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await stageDefaultArtwork(root);
  const catalog = JSON.parse(await readFile(join(root, "animations.json"), "utf8"));
  await writeFile(join(root, "Assets", catalog.clips.idle.frames[0]), "altered");
  await assert.rejects(verifyDefaultArtwork(root), /default artwork differs from source/u);
});
