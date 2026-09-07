import { lstat, realpath } from "node:fs/promises";
import { join } from "node:path";

export const runtime = Object.freeze({ platform: "win32", arch: "x64", runtimeKey: "win32-x64", runtimeDirectory: "win32-x64", runtimeExecutable: "dev-flow.exe" });

export const dataPaths = Object.freeze({
  productRoot(anchor) { return existingDirectory(join(anchor, "dev-flow")); },
  applicationData({ homeDirectory, environment }) {
    const configured = environment?.LOCALAPPDATA;
    if (typeof configured === "string" && configured !== "") {
      return Object.freeze({ path: configured, inspectionRoot: configured, canonicalizeRoot: true, label: "LOCALAPPDATA" });
    }
    return Object.freeze({ path: join(homeDirectory, "AppData", "Local"), inspectionRoot: homeDirectory, canonicalizeRoot: false, label: "local application data directory" });
  },
});

export const permissions = Object.freeze({ enforcePrivateModes: false, requireExecutableMode: false });


// Packaged Windows hosts can expose an AppData directory through a filesystem alias.
async function existingDirectory(path) {
  let info;
  try { info = await lstat(path); } catch (error) { if (error.code === "ENOENT") return path; throw error; }
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("application data must be a regular directory");
  return realpath(path);
}
