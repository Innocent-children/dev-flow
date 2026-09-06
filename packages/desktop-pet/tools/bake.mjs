/// Bakes the delivered desktop-pet artwork from the procedural source in
/// `character.mjs` and `clips.mjs`.
///
/// The baked resource root mirrors what `AssetLibrary` reads at runtime:
/// `<root>/animations.json` plus `<root>/Assets/<clip>/<frame>.png`. Inspection
/// output (background previews, key-frame contact sheets, the 1024 character
/// sheet, the interface icons) is delivery evidence and never enters the
/// application bundle.
///
/// Usage:
///   node bake.mjs                 bake resources and inspection output
///   node bake.mjs --out DIR       bake only the resource root
///   node bake.mjs --inspect DIR   bake only inspection output
///   node bake.mjs --check DIR     validate an existing resource root
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  createScratch,
  neutralPose,
  renderAppIcon,
  renderCharacter,
  renderMenuBarIcon,
} from "./character.mjs";
import { CLIPS, CLIP_ORDER, buildCatalog, poseFor } from "./clips.mjs";
import {
  checkerboard,
  complexBackground,
  compositeOver,
  createCanvas,
  encodePNG,
  inspectPNG,
  resized,
  solidCanvas,
} from "./raster.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, "..");
const DEFAULT_RESOURCE_ROOT = join(PACKAGE_ROOT, "macos", "Resources");
const DEFAULT_INSPECT_ROOT = join(PACKAGE_ROOT, "inspection");

const PREVIEW_SIZE = 256;
const SHEET_CELL = 128;

function framePath(clip, index) {
  return `${clip}/${String(index).padStart(2, "0")}.png`;
}

// MARK: - resource root

/// Renders and writes every delivered frame plus `animations.json`.
export async function bakeAssets(outDirectory) {
  const scratch = createScratch();
  let frames = 0;
  let bytes = 0;
  for (const clip of CLIP_ORDER) {
    const description = CLIPS[clip];
    for (let index = 0; index < description.frames; index += 1) {
      const canvas = renderCharacter(poseFor(clip, index), scratch);
      const png = Buffer.from(encodePNG(canvas));
      const target = join(outDirectory, "Assets", framePath(clip, index));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, png);
      frames += 1;
      bytes += png.length;
    }
  }
  const catalog = buildCatalog(framePath);
  await mkdir(outDirectory, { recursive: true });
  await writeFile(join(outDirectory, "animations.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  // The menu bar template mark lives beside the frames so the build can copy the
  // resource root into the bundle verbatim.
  await mkdir(join(outDirectory, "Assets"), { recursive: true });
  await writeFile(join(outDirectory, "Assets", "MenuBarIcon.png"), Buffer.from(encodePNG(renderMenuBarIcon(44))));
  return { frames, bytes, catalog };
}

// MARK: - inspection output

function keyIndices(clip) {
  const description = CLIPS[clip];
  if (description.loopRange === null) return [0, 9, 16, 24, 34, 41, 52, description.frames - 1];
  const [start, end] = description.loopRange;
  const span = end - start;
  return [
    0,
    Math.round(start / 2),
    start,
    start + Math.round(span / 4),
    start + Math.round(span / 2),
    start + Math.round((3 * span) / 4),
    end,
    description.restFrame,
  ].filter((value, position, all) => all.indexOf(value) === position);
}

function strip(canvases, background) {
  const sheet = background(canvases.length * PREVIEW_SIZE, PREVIEW_SIZE);
  let x = 0;
  for (const canvas of canvases) {
    compositeOver(sheet, resized(canvas, PREVIEW_SIZE, PREVIEW_SIZE), x, 0);
    x += PREVIEW_SIZE;
  }
  return sheet;
}

function contactSheet(clip) {
  const indices = keyIndices(clip);
  const scratch = createScratch();
  const sheet = checkerboard(indices.length * SHEET_CELL, SHEET_CELL, 16, [0.86, 0.86, 0.86], [0.62, 0.62, 0.62]);
  indices.forEach((index, position) => {
    const frame = renderCharacter(poseFor(clip, index), scratch);
    compositeOver(sheet, resized(frame, SHEET_CELL, SHEET_CELL), position * SHEET_CELL, 0);
  });
  return sheet;
}

/// The background previews, contact sheets, character sheet, and icons.
export async function bakeInspection(outDirectory) {
  const scratch = createScratch();
  const rests = CLIP_ORDER.map((clip) => renderCharacter(poseFor(clip, CLIPS[clip].restFrame), scratch));
  const backgrounds = [
    ["checkerboard", (w, h) => checkerboard(w, h, 32, [0.86, 0.86, 0.86], [0.62, 0.62, 0.62])],
    ["light", (w, h) => solidCanvas(w, h, [0.96, 0.97, 1])],
    ["dark", (w, h) => solidCanvas(w, h, [0.09, 0.1, 0.14])],
    ["complex", (w, h) => complexBackground(w, h)],
  ];
  await mkdir(outDirectory, { recursive: true });
  const written = [];
  for (const [name, background] of backgrounds) {
    const target = join(outDirectory, `background-${name}.png`);
    await writeFile(target, Buffer.from(encodePNG(strip(rests, background))));
    written.push(target);
  }
  for (const clip of CLIP_ORDER) {
    const target = join(outDirectory, `contact-${clip}.png`);
    await writeFile(target, Buffer.from(encodePNG(contactSheet(clip))));
    written.push(target);
  }
  const sheet = renderCharacter(neutralPose(), createScratch(1024), 1024);
  const sheetTarget = join(outDirectory, "character-sheet-1024.png");
  await writeFile(sheetTarget, Buffer.from(encodePNG(sheet)));
  written.push(sheetTarget);
  const iconTarget = join(outDirectory, "AppIcon-1024.png");
  await writeFile(iconTarget, Buffer.from(encodePNG(renderAppIcon(1024))));
  written.push(iconTarget);
  const menuTarget = join(outDirectory, "MenuBarIcon-44.png");
  await writeFile(menuTarget, Buffer.from(encodePNG(renderMenuBarIcon(44))));
  written.push(menuTarget);
  return written;
}

// MARK: - check

/// Validates a baked resource root against the catalog contract and the
/// delivered-frame rules: five clips, legal indices, every frame present at the
/// catalog canvas size with an 8-bit RGBA colour type.
export async function checkAssetRoot(rootDirectory) {
  const problems = [];
  const catalogPath = join(rootDirectory, "animations.json");
  let catalog;
  try {
    catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  } catch (error) {
    return { ok: false, problems: [`animations.json unreadable: ${error.message}`], frames: 0, bytes: 0 };
  }
  if (catalog.canvas?.width !== CANVAS_WIDTH || catalog.canvas?.height !== CANVAS_HEIGHT) {
    problems.push(`canvas must be ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`);
  }
  let frames = 0;
  let bytes = 0;
  for (const clip of CLIP_ORDER) {
    const description = catalog.clips?.[clip];
    if (!description) {
      problems.push(`clip ${clip} missing`);
      continue;
    }
    if (!Array.isArray(description.frames) || description.frames.length === 0) {
      problems.push(`clip ${clip} has no frames`);
      continue;
    }
    if (!(description.fps > 0)) problems.push(`clip ${clip} fps must be positive`);
    if (!Number.isInteger(description.rest_frame) || description.rest_frame < 0 || description.rest_frame >= description.frames.length) {
      problems.push(`clip ${clip} rest_frame out of range`);
    }
    const loop = description.loop_range;
    if (loop === null || loop === undefined) {
      if (clip !== "complete") problems.push(`clip ${clip} must loop`);
    } else if (!Array.isArray(loop) || loop.length !== 2 || loop[0] < 0 || loop[0] > loop[1] || loop[1] >= description.frames.length) {
      problems.push(`clip ${clip} loop_range out of range`);
    } else if (clip === "complete") {
      problems.push("clip complete must not loop");
    }
    for (const frame of description.frames) {
      if (typeof frame !== "string" || frame.length === 0 || frame.startsWith("/") || frame.split("/").includes("..")) {
        problems.push(`clip ${clip} unsafe frame path ${frame}`);
        continue;
      }
      const target = join(rootDirectory, "Assets", frame);
      let buffer;
      try {
        buffer = await readFile(target);
      } catch {
        problems.push(`clip ${clip} frame missing: ${frame}`);
        continue;
      }
      let header;
      try {
        header = inspectPNG(buffer);
      } catch (error) {
        problems.push(`clip ${clip} frame ${frame}: ${error.message}`);
        continue;
      }
      if (header.width !== CANVAS_WIDTH || header.height !== CANVAS_HEIGHT) {
        problems.push(`clip ${clip} frame ${frame} is ${header.width}x${header.height}, expected ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`);
      }
      if (header.bitDepth !== 8 || header.colorType !== 6) {
        problems.push(`clip ${clip} frame ${frame} must be 8-bit RGBA (colour type 6)`);
      }
      frames += 1;
      bytes += buffer.length;
    }
  }
  return { ok: problems.length === 0, problems, frames, bytes };
}

// MARK: - cli

function argumentValue(argv, flag, fallback) {
  const position = argv.indexOf(flag);
  if (position === -1) return fallback;
  const value = argv[position + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a directory`);
  return resolve(value);
}

export async function runBake(argv) {
  const check = argumentValue(argv, "--check", null);
  if (check !== null) {
    const report = await checkAssetRoot(check);
    for (const problem of report.problems) process.stderr.write(`bake: ${problem}\n`);
    process.stdout.write(`bake: ${report.frames} frames, ${(report.bytes / 1048576).toFixed(2)} MiB, ${report.ok ? "ok" : "FAILED"}\n`);
    return report.ok ? 0 : 1;
  }
  const hasOut = argv.includes("--out");
  const hasInspect = argv.includes("--inspect");
  const bakeBoth = !hasOut && !hasInspect;
  if (hasOut || bakeBoth) {
    const out = argumentValue(argv, "--out", DEFAULT_RESOURCE_ROOT);
    const started = Date.now();
    const summary = await bakeAssets(out);
    process.stdout.write(`bake: ${summary.frames} frames, ${(summary.bytes / 1048576).toFixed(2)} MiB in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${out}\n`);
    const report = await checkAssetRoot(out);
    for (const problem of report.problems) process.stderr.write(`bake: ${problem}\n`);
    if (!report.ok) return 1;
  }
  if (hasInspect || bakeBoth) {
    const out = argumentValue(argv, "--inspect", DEFAULT_INSPECT_ROOT);
    const written = await bakeInspection(out);
    process.stdout.write(`bake: ${written.length} inspection files -> ${out}\n`);
  }
  return 0;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  runBake(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`bake: ${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
