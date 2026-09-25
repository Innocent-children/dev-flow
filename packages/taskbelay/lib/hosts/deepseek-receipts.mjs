import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { ensureManagerDirectories, OwnershipError, readOwnedJSON, writeOwnedJSON } from "../ownership.mjs";

function profileDirectory(paths) {
  return join(paths.managerRoot, "profiles");
}

function receiptPath(paths, profile) {
  return join(profileDirectory(paths), `${createHash("sha256").update(profile).digest("hex")}.json`);
}

async function inspectDirectory(paths) {
  try {
    const info = await lstat(profileDirectory(paths));
    if (!info.isDirectory() || info.isSymbolicLink()) throw new OwnershipError("Profile receipt directory must be a regular directory");
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export async function writeProfileReceipt(paths, receipt) {
  validateProfileReceipt(receipt);
  await ensureManagerDirectories(paths);
  if (!await inspectDirectory(paths)) await mkdir(profileDirectory(paths), { mode: 0o700 });
  if (paths.enforcePrivateModes) await chmod(profileDirectory(paths), 0o700);
  await writeOwnedJSON(receiptPath(paths, receipt.profile), receipt, {
    root: paths.managerRoot, enforcePrivateModes: paths.enforcePrivateModes,
  });
}

export async function removeProfileReceipt(paths, profile) {
  if (!await inspectDirectory(paths)) return;
  await unlink(receiptPath(paths, profile)).catch(error => { if (error.code !== "ENOENT") throw error; });
}

export async function listProfileReceipts(paths) {
  if (!await inspectDirectory(paths)) return [];
  const receipts = [];
  for (const name of (await readdir(profileDirectory(paths))).sort()) {
    if (!name.endsWith(".json")) throw new OwnershipError("profiles directory contains an unknown file");
    const receipt = await readOwnedJSON(join(profileDirectory(paths), name), {
      root: paths.managerRoot, validate: validateProfileReceipt,
    });
    receipts.push(receipt);
  }
  return receipts;
}

export function validateProfileReceipt(value) {
  const fields = ["profile", "package_name", "installed_version", "origin", "dsh_version", "created_at", "updated_at"];
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(fields.sort())) throw new OwnershipError("Profile receipt fields are invalid");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(value.profile) || value.package_name !== "taskbelay-deepseek") {
    throw new OwnershipError("Profile receipt identity is invalid");
  }
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value.installed_version)) throw new OwnershipError("Profile receipt version is invalid");
  if (!["installed", "adopted_by_reinstall"].includes(value.origin) || typeof value.dsh_version !== "string" || value.dsh_version === "") {
    throw new OwnershipError("Profile receipt owner facts are invalid");
  }
  for (const field of ["created_at", "updated_at"]) if (!Number.isFinite(Date.parse(value[field]))) throw new OwnershipError(`Profile receipt ${field} is invalid`);
  return structuredClone(value);
}
