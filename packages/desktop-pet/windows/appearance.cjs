const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { SaxesParser } = require("saxes");
const { imageSize } = require("image-size");
const { safePath, readBounded, writeJSON } = require("./storage.cjs");
const required = ["idle", "working", "blocked", "complete", "disconnected"];
const optional = ["running-right", "running-left", "waving", "review"];
const MiB = 1024 * 1024;
const elements = new Set(
  "svg g defs path rect circle ellipse line polyline polygon linearGradient radialGradient stop clipPath use title desc".split(
    " ",
  ),
);
const attributes = new Set(
  "xmlns xmlns:xlink version width height viewBox preserveAspectRatio id x y x1 y1 x2 y2 cx cy r rx ry fx fy fr d points transform fill fill-rule fill-opacity opacity color stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-dasharray stroke-dashoffset clip-path clip-rule clipPathUnits gradientUnits gradientTransform spreadMethod offset stop-color stop-opacity href xlink:href".split(
    " ",
  ),
);
function svgSize(bytes) {
  if (bytes.length > MiB) throw new Error("SVG exceeds 1 MiB");
  const parser = new SaxesParser();
  let count = 0,
    depth = 0,
    dimensions;
  parser.on("error", (error) => {
    throw error;
  });
  for (const event of ["doctype", "processinginstruction"])
    parser.on(event, () => {
      throw new Error("SVG external declarations are unsupported");
    });
  parser.on("opentag", (node) => {
    if (++count > 4096 || ++depth > 64 || !elements.has(node.name))
      throw new Error("SVG must contain bounded static vector shapes");
    for (const [name, value] of Object.entries(node.attributes)) {
      if (
        !attributes.has(name) ||
        (name === "xmlns" && value !== "http://www.w3.org/2000/svg") ||
        (name === "xmlns:xlink" && value !== "http://www.w3.org/1999/xlink")
      )
        throw new Error(`Unsupported SVG attribute ${name}`);
      if (
        ["href", "xlink:href"].includes(name) &&
        !/^#[A-Za-z_][A-Za-z0-9_.-]*$/.test(value)
      )
        throw new Error("SVG references must be internal");
      if (
        ["fill", "stroke", "color", "stop-color", "clip-path"].includes(name) &&
        !/^(?:[A-Za-z]+|#[0-9A-Fa-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9.,% +\-]+\)|url\(#[A-Za-z_][A-Za-z0-9_.-]*\))$/.test(
          value,
        )
      )
        throw new Error("Invalid SVG paint");
    }
    if (depth === 1) {
      const width = Number(node.attributes.width),
        height = Number(node.attributes.height);
      if (
        node.name !== "svg" ||
        node.attributes.xmlns !== "http://www.w3.org/2000/svg" ||
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width < 1 ||
        height < 1 ||
        width > 4096 ||
        height > 4096
      )
        throw new Error("Invalid SVG canvas");
      if (
        node.attributes.viewBox &&
        JSON.stringify(
          node.attributes.viewBox
            .trim()
            .split(/[\s,]+/)
            .map(Number),
        ) !== JSON.stringify([0, 0, width, height])
      )
        throw new Error("SVG viewBox must match canvas");
      dimensions = { width, height };
    } else if (node.name === "svg")
      throw new Error("Nested SVG is unsupported");
  });
  parser.on("closetag", () => depth--);
  parser.write(bytes.toString("utf8")).close();
  if (!dimensions) throw new Error("SVG canvas is missing");
  return dimensions;
}
function dimensions(bytes, name, max = 128 * MiB) {
  const ext = path.extname(name).toLowerCase();
  const size = ext === ".svg" ? svgSize(bytes) : imageSize(bytes);
  if (
    (ext !== ".svg" && !["png", "webp"].includes(size.type)) ||
    !size.width ||
    !size.height ||
    size.width * size.height * 4 > max
  )
    throw new Error("Invalid image or decoded image size");
  return { width: size.width, height: size.height };
}
function metadata(value) {
  if (
    !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value.id) ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    [...value.name].length > 100
  )
    throw new Error("Invalid appearance identity");
  return { id: value.id, name: value.name };
}
function validateCatalog(value) {
  const { canvas, anchor, clips } = value;
  if (
    !canvas ||
    !Number.isInteger(canvas.width) ||
    !Number.isInteger(canvas.height) ||
    canvas.width < 1 ||
    canvas.height < 1 ||
    !anchor ||
    !Number.isFinite(anchor.x) ||
    !Number.isFinite(anchor.y) ||
    !clips ||
    required.some((k) => !clips[k])
  )
    throw new Error("Incomplete animation catalog");
  for (const [name, clip] of Object.entries(clips)) {
    if (
      ![...required, ...optional].includes(name) ||
      !Array.isArray(clip.frames) ||
      !clip.frames.length ||
      !Number.isFinite(clip.fps) ||
      clip.fps <= 0 ||
      !Number.isInteger(clip.rest_frame) ||
      clip.rest_frame < 0 ||
      clip.rest_frame >= clip.frames.length
    )
      throw new Error("Invalid animation clip");
    if (canvas.width * canvas.height * 4 * clip.frames.length > 128 * MiB)
      throw new Error("Decoded animation exceeds 128 MiB");
    if (
      clip.frame_durations_ms &&
      (clip.frame_durations_ms.length !== clip.frames.length ||
        clip.frame_durations_ms.some(
          (t) => !Number.isInteger(t) || t <= 0 || t > 60000,
        ))
    )
      throw new Error("Invalid frame durations");
    const loop = clip.loop_range;
    if (
      name === "complete"
        ? loop !== null
        : !Array.isArray(loop) ||
          loop.length !== 2 ||
          !loop.every(Number.isInteger) ||
          loop[0] < 0 ||
          loop[1] < loop[0] ||
          loop[1] >= clip.frames.length
    )
      throw new Error("Invalid animation loop");
    if (
      clip.frames.some((f) => typeof f !== "string" || !/\.(png|svg)$/i.test(f))
    )
      throw new Error("Animation frames must be PNG or SVG");
  }
  return value;
}
const rows = [
  ["idle", [280, 110, 110, 140, 140, 320]],
  ["running-right", [120, 120, 120, 120, 120, 120, 120, 220]],
  ["running-left", [120, 120, 120, 120, 120, 120, 120, 220]],
  ["waving", [140, 140, 140, 280]],
  ["complete", [140, 140, 140, 140, 280]],
  ["disconnected", [140, 140, 140, 140, 140, 140, 140, 240]],
  ["blocked", [150, 150, 150, 150, 150, 260]],
  ["working", [120, 120, 120, 120, 120, 220]],
  ["review", [150, 150, 150, 150, 150, 280]],
];
class AppearanceStore {
  constructor(root, bundled, decodeAtlas, validateRaster) {
    this.root = root;
    this.bundled = bundled;
    this.decodeAtlas = decodeAtlas;
    this.validateRaster = validateRaster;
  }
  async load(directory, includeFrames = true) {
    const info = metadata(JSON.parse(await readBounded(directory, "pet.json")));
    const catalog = validateCatalog(
      JSON.parse(await readBounded(directory, "animations.json")),
    );
    const frames = {};
    let bytes = 0;
    for (const file of new Set(
      Object.values(catalog.clips).flatMap((c) => c.frames),
    )) {
      const data = await readBounded(directory, `Assets/${file}`, 128 * MiB);
      bytes += data.length;
      const size = dimensions(data, file);
      if (
        bytes > 128 * MiB ||
        size.width !== catalog.canvas.width ||
        size.height !== catalog.canvas.height
      )
        throw new Error("Artwork dimensions or total size invalid");
      if (path.extname(file).toLowerCase() === ".png" && this.validateRaster) {
        await this.validateRaster(data, catalog.canvas);
      }
      if (includeFrames)
        frames[file] =
          `data:image/${file.toLowerCase().endsWith(".svg") ? "svg+xml" : "png"};base64,${data.toString("base64")}`;
    }
    return { ...info, catalog, frames };
  }
  async list() {
    await fs.mkdir(this.root, { recursive: true });
    const result = [];
    for (const entry of await fs.readdir(this.root, { withFileTypes: true })) {
      if (
        !entry.isDirectory() ||
        !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(entry.name)
      )
        continue;
      try {
        const dir = await safePath(this.root, entry.name);
        result.push(metadata(JSON.parse(await readBounded(dir, "pet.json"))));
      } catch {}
    }
    return result;
  }
  async selected(id) {
    return this.load(id ? await safePath(this.root, id) : this.bundled);
  }
  async import(source) {
    const sourceInfo = await fs.lstat(source);
    if (!sourceInfo.isDirectory() || sourceInfo.isSymbolicLink())
      throw new Error("Select a regular appearance directory");
    await fs.mkdir(this.root, { recursive: true });
    const stage = path.join(this.root, `.import-${randomUUID()}`);
    await fs.mkdir(stage);
    try {
      const manifest = JSON.parse(await readBounded(source, "pet.json"));
      let info;
      if (manifest.spritesheetPath) {
        if (
          ![1, 2].includes(manifest.spriteVersionNumber ?? 1) ||
          typeof manifest.id !== "string" ||
          !manifest.id ||
          manifest.id.length > 256 ||
          typeof manifest.displayName !== "string" ||
          !manifest.displayName.trim() ||
          [...manifest.displayName].length > 100
        )
          throw new Error("Invalid Codex pet");
        info = {
          id:
            "codex-" +
            createHash("sha256").update(manifest.id).digest("hex").slice(0, 32),
          name: manifest.displayName,
        };
        const bytes = await readBounded(
          source,
          manifest.spritesheetPath,
          512 * MiB,
        );
        const size = dimensions(bytes, manifest.spritesheetPath, 1024 * MiB);
        const width = size.width / 8,
          height = (width * 208) / 192;
        if (
          !Number.isInteger(width) ||
          !Number.isInteger(height) ||
          size.height < height * 9
        )
          throw new Error(
            "Codex atlas must contain eight columns and nine 192:208 rows",
          );
        const catalog = {
          canvas: { width, height },
          anchor: { x: width / 2, y: height },
          clips: {},
        };
        for (const [index, [key, durations]] of rows.entries())
          catalog.clips[key] = {
            frames: durations.map((_, i) => `${key}/${i}.png`),
            fps: 8,
            loop_range: key === "complete" ? null : [0, durations.length - 1],
            rest_frame: key === "complete" ? durations.length - 1 : 0,
            frame_durations_ms: durations,
          };
        validateCatalog(catalog);
        const outputs = await this.decodeAtlas(
          bytes,
          size,
          { width, height },
          rows,
        );
        for (const [file, data] of Object.entries(outputs)) {
          const target = await safePath(stage, `Assets/${file}`);
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, data);
        }
        await writeJSON(path.join(stage, "animations.json"), catalog);
      } else {
        info = metadata(manifest);
        if (manifest.image) {
          if (!/\.(png|svg)$/i.test(manifest.image))
            throw new Error("Static artwork must be PNG or SVG");
          const data = await readBounded(source, manifest.image, 128 * MiB),
            canvas = dimensions(data, manifest.image);
          const frame = `static${path.extname(manifest.image).toLowerCase()}`;
          await fs.mkdir(path.join(stage, "Assets"));
          await fs.writeFile(path.join(stage, "Assets", frame), data);
          await writeJSON(path.join(stage, "animations.json"), {
            canvas,
            anchor: { x: canvas.width / 2, y: canvas.height },
            clips: Object.fromEntries(
              required.map((k) => [
                k,
                {
                  frames: [frame],
                  fps: 1,
                  loop_range: k === "complete" ? null : [0, 0],
                  rest_frame: 0,
                },
              ]),
            ),
          });
        } else {
          const validated = await this.load(source, false);
          await writeJSON(
            path.join(stage, "animations.json"),
            validated.catalog,
          );
          for (const file of new Set(
            Object.values(validated.catalog.clips).flatMap((c) => c.frames),
          )) {
            const target = await safePath(stage, `Assets/${file}`);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(
              target,
              await readBounded(source, `Assets/${file}`, 128 * MiB),
            );
          }
        }
      }
      await writeJSON(path.join(stage, "pet.json"), info);
      const loaded = await this.load(stage);
      const target = await safePath(this.root, info.id),
        backup = path.join(this.root, `.replaced-${randomUUID()}`);
      let replaced = false;
      try {
        await fs.rename(target, backup);
        replaced = true;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      try {
        await fs.rename(stage, target);
      } catch (error) {
        if (replaced) await fs.rename(backup, target);
        throw error;
      }
      if (replaced) await fs.rm(backup, { recursive: true, force: true });
      return loaded;
    } finally {
      await fs.rm(stage, { recursive: true, force: true });
    }
  }
}
module.exports = {
  AppearanceStore,
  validateCatalog,
  svgSize,
  dimensions,
  rows,
};
