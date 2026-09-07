import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { stageDefaultArtwork, verifyDefaultArtwork } from "./desktop-pet-artwork.mjs";

test("default artwork is a standalone nine-action vector pack", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "default-vector-artwork-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await stageDefaultArtwork(root);
  const result = await verifyDefaultArtwork(root);
  const catalog = JSON.parse(await readFile(join(root, "animations.json"), "utf8"));
  assert.deepEqual(Object.keys(catalog.clips).sort(), [
    "blocked", "complete", "disconnected", "idle", "review", "running-left", "running-right", "waving", "working",
  ]);
  assert.equal(result.frames, 312);
  assert.ok(result.asset_bytes < 3 * 1024 * 1024);
  const paths = await readdir(root, { recursive: true });
  assert.ok(paths.every((path) => !path.endsWith(".png") && !path.endsWith(".mjs")));
  for (const path of paths.filter((path) => path.endsWith(".svg"))) {
    const svg = await readFile(join(root, path), "utf8");
    assert.doesNotMatch(svg, /<(?:image|script|animate|foreignObject)\b|data:image|base64/iu);
  }
});

test("verification refuses altered delivered artwork", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "altered-vector-artwork-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await stageDefaultArtwork(root);
  const catalog = JSON.parse(await readFile(join(root, "animations.json"), "utf8"));
  await writeFile(join(root, "Assets", catalog.clips.idle.frames[0]), "altered");
  await assert.rejects(verifyDefaultArtwork(root), /default artwork differs from source/u);
});
