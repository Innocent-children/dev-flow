import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../packages/desktop-pet/default-appearance/", import.meta.url));

// Stages the default artwork as data; drawing and pose generation live outside the application.
async function artworkFiles() {
  const catalog = JSON.parse(await readFile(join(sourceRoot, "animations.json"), "utf8"));
  const frames = Object.values(catalog.clips).flatMap((clip) => clip.frames);
  for (const frame of frames) {
    if (typeof frame !== "string" || !/^[a-z-]+\/[0-9]+\.svg$/u.test(frame)) {
      throw new Error(`invalid default SVG frame path: ${frame}`);
    }
  }
  if (frames.length === 0 || frames.length > 512) throw new Error("default artwork requires 1–512 frame references");
  return { frames: frames.length, files: ["pet.json", "animations.json", ...new Set(frames.map((frame) => `Assets/${frame}`))] };
}

export async function stageDefaultArtwork(resources) {
  const { files } = await artworkFiles();
  for (const relative of files) {
    await mkdir(dirname(join(resources, relative)), { recursive: true });
    await copyFile(join(sourceRoot, relative), join(resources, relative));
  }
}

export async function verifyDefaultArtwork(resources) {
  const { frames, files } = await artworkFiles();
  let bytes = 0;
  for (const relative of files) {
    const source = await readFile(join(sourceRoot, relative));
    const delivered = await readFile(join(resources, relative));
    if (!source.equals(delivered)) throw new Error(`default artwork differs from source: ${relative}`);
    if (relative.startsWith("Assets/")) bytes += delivered.length;
  }
  return { frames, asset_bytes: bytes };
}
