const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

async function safePath(root, relative) {
  if (
    typeof relative !== "string" ||
    !relative ||
    relative.includes("\\") ||
    relative.includes(":") ||
    relative.includes("\0") ||
    path.isAbsolute(relative) ||
    relative.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new Error("Invalid relative artwork path");
  let target = root;
  for (const part of relative.split("/")) {
    target = path.join(target, part);
    const info = await fs.lstat(target).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    if (info?.isSymbolicLink())
      throw new Error("Symbolic links and junctions are not permitted");
  }
  return target;
}
async function readBounded(root, relative, limit = 256 * 1024) {
  const target = await safePath(root, relative);
  const handle = await fs.open(target, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit)
      throw new Error("File exceeds its size limit");
    const data = await handle.readFile();
    if (data.length > limit) throw new Error("File exceeds its size limit");
    return data;
  } finally {
    await handle.close();
  }
}
async function writeJSON(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
      flag: "wx",
    });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
class Preferences {
  constructor(root) {
    this.root = root;
    this.file = path.join(root, "settings.json");
    this.value = {
      position: null,
      scale: 1,
      animations_enabled: true,
      idle_activities_enabled: true,
      pinned_tasks: {},
      selected_appearance: null,
    };
    this.pending = Promise.resolve();
  }
  async load() {
    try {
      const value = JSON.parse(await readBounded(this.root, "settings.json"));
      if (
        !Number.isFinite(value.scale) ||
        value.scale < 0.5 ||
        value.scale > 2 ||
        typeof value.animations_enabled !== "boolean" ||
        typeof value.idle_activities_enabled !== "boolean" ||
        (value.pinned_tasks !== undefined && (
        !value.pinned_tasks ||
        typeof value.pinned_tasks !== "object" ||
        Array.isArray(value.pinned_tasks)))
      )
        throw new Error("Invalid settings");
      if (
        value.position &&
        (!Number.isFinite(value.position.x) ||
          !Number.isFinite(value.position.y))
      )
        throw new Error("Invalid position");
      this.value = { ...this.value, position: value.position, scale: value.scale,
        animations_enabled: value.animations_enabled, idle_activities_enabled: value.idle_activities_enabled,
        pinned_tasks: value.pinned_tasks ?? {}, selected_appearance: value.selected_appearance };
    } catch (error) {
      if (error.code !== "ENOENT") this.warning = error.message;
    }
    return this.value;
  }
  update(change) {
    const update = this.pending.then(async () => {
      const next = structuredClone(this.value);
      change(next);
      await safePath(this.root, "settings.json");
      await writeJSON(this.file, next);
      this.value = next;
      return next;
    });
    this.pending = update.catch(() => {});
    return update;
  }
}
module.exports = { safePath, readBounded, writeJSON, Preferences };
