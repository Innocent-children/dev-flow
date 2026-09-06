/// Targeted checks for the procedural artwork source and the bake contract.
///
/// These run in CI without baking the full 264-frame set: the catalog rules are
/// checked over the generated manifest, loop closure and the shared frame 0 are
/// checked over poses, ground contact is checked over a sample of rendered
/// frames, and the asset checker is exercised against a one-frame-per-clip
/// root built in a temporary directory.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  alphaBounds,
  compositeOver,
  createCanvas,
  encodePNG,
  inspectPNG,
  invertTransform,
  applyTransform,
  multiplyTransform,
  sdCircle,
  solidCanvas,
  translationTransform,
} from "./raster.mjs";
import { createScratch, neutralPose, renderAppIcon, renderCharacter, renderMenuBarIcon } from "./character.mjs";
import { CLIPS, CLIP_ORDER, buildCatalog, poseFor } from "./clips.mjs";
import { bakeAssets, checkAssetRoot, runBake } from "./bake.mjs";

/// Phase parameters are periodic inputs, not pose positions, so continuity is
/// measured without them.
const CYCLIC = new Set(["tailPhase", "ribbonPhase", "ribbonDot"]);

function poseDistance(left, right) {
  let sum = 0;
  for (const field of Object.keys(left)) {
    if (CYCLIC.has(field)) continue;
    const delta = left[field] - right[field];
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

test("the png encoder round-trips the canvas geometry and stays deterministic", () => {
  const canvas = createCanvas(9, 7);
  for (let index = 0; index < canvas.pixels.length; index += 4) {
    canvas.pixels[index] = 0.2;
    canvas.pixels[index + 1] = 0.4;
    canvas.pixels[index + 2] = 0.9;
    canvas.pixels[index + 3] = 0.75;
  }
  const first = Buffer.from(encodePNG(canvas));
  const second = Buffer.from(encodePNG(canvas));
  assert.equal(first.equals(second), true);
  const header = inspectPNG(first);
  assert.deepEqual(header, { width: 9, height: 7, bitDepth: 8, colorType: 6 });
});

test("signed distances and affine transforms round-trip", () => {
  assert.equal(sdCircle(5, 5, 2, 5, 3), 0);
  const forward = multiplyTransform(translationTransform(4, -6), translationTransform(1, 2));
  const point = applyTransform(forward, 10, 10, new Float64Array(2));
  assert.deepEqual([point[0], point[1]], [15, 6]);
  const back = applyTransform(invertTransform(forward), point[0], point[1], new Float64Array(2));
  assert.ok(Math.abs(back[0] - 10) < 1e-9);
  assert.ok(Math.abs(back[1] - 10) < 1e-9);
});

test("compositing clips a source that overhangs an opaque target", () => {
  const target = solidCanvas(4, 4, [0.5, 0.5, 0.5]);
  const source = createCanvas(3, 3);
  for (let index = 0; index < source.pixels.length; index += 4) source.pixels[index + 3] = 1;
  compositeOver(target, source, 2, 2);
  const corner = (4 * 4 - 1) * 4;
  assert.equal(target.pixels[corner + 3], 1);
  const untouched = 0;
  assert.equal(target.pixels[untouched], 0.5);
});

test("the catalog describes the five delivered clips with legal loops", () => {
  const catalog = buildCatalog((clip, index) => `${clip}/${String(index).padStart(2, "0")}.png`);
  assert.deepEqual(catalog.canvas, { width: 512, height: 512 });
  assert.deepEqual(catalog.anchor, { x: 256, y: 456 });
  assert.deepEqual(Object.keys(catalog.clips).sort(), [...CLIP_ORDER].sort());
  for (const clip of CLIP_ORDER) {
    const description = catalog.clips[clip];
    assert.equal(description.fps, 24);
    assert.equal(description.frames.length, CLIPS[clip].frames);
    assert.ok(description.rest_frame >= 0 && description.rest_frame < description.frames.length);
    for (const frame of description.frames) {
      assert.match(frame, new RegExp(`^${clip}/\\d{2}\\.png$`));
      assert.equal(frame.split("/").includes(".."), false);
    }
    if (clip === "complete") {
      assert.equal(description.loop_range, null);
    } else {
      const [start, end] = description.loop_range;
      assert.ok(start > 0, `${clip} keeps an attention segment for the hover reaction`);
      assert.ok(start <= end && end < description.frames.length);
    }
  }
});

test("every loop closes on its first frame and every action shares frame 0", () => {
  const reference = poseFor("idle", 0);
  for (const clip of CLIP_ORDER) {
    assert.equal(poseDistance(reference, poseFor(clip, 0)), 0, `${clip} frame 0 is the shared neutral pose`);
    const description = CLIPS[clip];
    if (description.loopRange === null) continue;
    const [start, end] = description.loopRange;
    const seam = poseDistance(poseFor(clip, end), poseFor(clip, start));
    let worst = 0;
    for (let index = start + 1; index <= end; index += 1) {
      worst = Math.max(worst, poseDistance(poseFor(clip, index - 1), poseFor(clip, index)));
    }
    assert.ok(seam <= worst, `${clip} loop seam ${seam} must not exceed its largest inner step ${worst}`);
  }
});

test("the ground contact and horizontal centre hold across each loop", () => {
  const scratch = createScratch();
  for (const clip of CLIP_ORDER) {
    const description = CLIPS[clip];
    // The celebration leaves the ground on purpose, so its planted reference is
    // the settle at the end of the one-shot.
    const [start, end] = description.loopRange === null
      ? [description.frames - 8, description.frames - 1]
      : description.loopRange;
    const span = end - start;
    let lowest = -1;
    let highest = 1e9;
    let centreLow = 1e9;
    let centreHigh = -1;
    for (let offset = 0; offset <= 4; offset += 1) {
      const index = start + Math.round((span * offset) / 4);
      const frame = renderCharacter(poseFor(clip, index), scratch);
      const bounds = alphaBounds(frame);
      lowest = Math.max(lowest, bounds.maxY);
      highest = Math.min(highest, bounds.maxY);
      // The ribbon and the tail are meant to sway, so the stable reference is
      // the contact band at the feet, not the whole silhouette.
      const band = contactCentre(frame, bounds.maxY);
      centreLow = Math.min(centreLow, band);
      centreHigh = Math.max(centreHigh, band);
    }
    assert.ok(lowest - highest <= 2, `${clip} ground contact drifts ${lowest - highest}px`);
    assert.ok(centreHigh - centreLow <= 6, `${clip} contact centre drifts ${centreHigh - centreLow}px`);
    assert.ok(lowest < 512, `${clip} must stay inside the canvas`);
  }
});

/// The alpha-weighted horizontal centre of the eight bottom pixel rows, which
/// is the feet and contact shadow the anchor has to hold.
function contactCentre(canvas, maxY) {
  let weight = 0;
  let sum = 0;
  for (let y = Math.max(0, maxY - 7); y <= maxY; y += 1) {
    const row = y * canvas.width * 4;
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = canvas.pixels[row + x * 4 + 3];
      weight += alpha;
      sum += alpha * x;
    }
  }
  return weight > 0 ? sum / weight : 0;
}

test("the menu bar mark carries alpha only and the app icon keeps its corner", () => {
  const mark = renderMenuBarIcon(44);
  let inked = 0;
  for (let index = 0; index < mark.pixels.length; index += 4) {
    assert.deepEqual([mark.pixels[index], mark.pixels[index + 1], mark.pixels[index + 2]], [0, 0, 0]);
    if (mark.pixels[index + 3] > 0.5) inked += 1;
  }
  assert.ok(inked > 100, "the template mark needs a visible silhouette");
  const icon = renderAppIcon(128);
  assert.equal(icon.pixels[3], 0, "the rounded corner stays transparent");
  const centre = (64 * 128 + 64) * 4;
  assert.equal(icon.pixels[centre + 3], 1);
});

test("the asset check accepts a baked root and names broken frames", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-pet-check-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  // A one-frame-per-clip root keeps the check fast while still exercising every
  // rule the build applies to the delivered 264-frame set.
  const scratch = createScratch();
  const png = Buffer.from(encodePNG(renderCharacter(neutralPose(), scratch)));
  const clips = {};
  for (const clip of CLIP_ORDER) {
    const target = join(root, "Assets", clip, "00.png");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, png);
    clips[clip] = {
      frames: [`${clip}/00.png`],
      fps: 24,
      loop_range: clip === "complete" ? null : [0, 0],
      rest_frame: 0,
    };
  }
  await writeFile(
    join(root, "animations.json"),
    `${JSON.stringify({ canvas: { width: 512, height: 512 }, anchor: { x: 256, y: 456 }, clips })}\n`,
  );
  const good = await checkAssetRoot(root);
  assert.deepEqual(good.problems, []);
  assert.equal(good.ok, true);
  assert.equal(good.frames, CLIP_ORDER.length);

  await writeFile(join(root, "Assets", "idle", "00.png"), Buffer.from(encodePNG(createCanvas(64, 64))));
  const wrongSize = await checkAssetRoot(root);
  assert.equal(wrongSize.ok, false);
  assert.ok(wrongSize.problems.some((problem) => problem.includes("idle frame idle/00.png is 64x64")));

  await rm(join(root, "Assets", "working", "00.png"));
  const missing = await checkAssetRoot(root);
  assert.ok(missing.problems.some((problem) => problem.includes("working frame missing")));
});

test("the bake cli reports an absent resource root as failed", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-pet-cli-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const code = await runBake(["--check", join(root, "missing")]);
  assert.equal(code, 1);
  assert.equal(typeof bakeAssets, "function");
});
