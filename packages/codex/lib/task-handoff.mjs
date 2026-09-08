import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import { assertNoDuplicateJSONMembers } from "./json.mjs";

const sections = Object.freeze([
  ["terminology", "Terminology and examples"],
  ["scope_and_constraints", "Scope, exclusions, and constraints"],
  ["investigation", "Code investigation"],
  ["work_requirements", "Working instructions and authorizations"],
  ["unconfirmed_suggestions", "Suggestions not accepted by the user"],
  ["assumptions", "Assumptions, not confirmed requirements"],
  ["open_questions", "Unresolved questions"],
]);
const inlinePromptBytes = 24 * 1024;

export function validateTaskHandoff(value) {
  assertKeys(value, ["request", "goal", "confirmed_requirements", ...sections.map(([key]) => key), "discussion"], "task handoff");
  assertText(value.request, "handoff request");
  assertText(value.goal, "handoff goal");
  if (!Array.isArray(value.discussion) || value.discussion.length === 0) {
    throw new Error("handoff discussion must retain the relevant original messages");
  }
  const messages = new Map();
  const discussion = value.discussion.map((message) => {
    assertKeys(message, ["id", "role", "text"], "handoff discussion message");
    if (typeof message.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(message.id) || messages.has(message.id)) {
      throw new Error("handoff discussion message IDs must be valid and unique");
    }
    if (!["user", "assistant"].includes(message.role)) throw new Error("handoff discussion role must be user or assistant");
    assertText(message.text, "handoff discussion text");
    messages.set(message.id, message);
    return { id: message.id, role: message.role, text: message.text };
  });
  if (!Array.isArray(value.confirmed_requirements) || value.confirmed_requirements.length === 0) {
    throw new Error("handoff confirmed_requirements must contain the current user requirements");
  }
  const confirmed = value.confirmed_requirements.map((requirement) => {
    assertKeys(requirement, ["text", "source_ids"], "handoff confirmed requirement");
    assertText(requirement.text, "handoff requirement text");
    assertStrings(requirement.source_ids, "handoff requirement source_ids");
    if (requirement.source_ids.some((id) => !messages.has(id))) throw new Error("handoff requirement references an unknown discussion message");
    if (!requirement.source_ids.some((id) => messages.get(id).role === "user")) {
      throw new Error("handoff confirmed requirement must reference a user message");
    }
    return { text: requirement.text, source_ids: [...requirement.source_ids] };
  });
  const result = { request: value.request, goal: value.goal, confirmed_requirements: confirmed };
  for (const [key] of sections) {
    assertStrings(value[key], `handoff ${key}`);
    result[key] = [...value[key]];
  }
  return { ...result, discussion };
}

export async function readTaskHandoffDraft(path, request) {
  if (typeof path !== "string" || path.includes("\0") || !isAbsolute(path) || resolve(path) !== path) {
    throw new Error("handoff_file must be a normalized absolute path");
  }
  const material = parseMaterial(await readRegularFile(path));
  if (material.request !== request) throw new Error("handoff request does not match the assessed request");
  return material;
}

export function taskHandoffDigest(material) {
  return createHash("sha256").update(serializeMaterial(material), "utf8").digest("hex");
}

export function taskHandoffPaths(receiptPath) {
  const directory = join(dirname(receiptPath), "handoffs");
  const name = basename(receiptPath, ".json");
  return { json_path: join(directory, `${name}.json`), markdown_path: join(directory, `${name}.md`) };
}

// The launch coordinator owns the receipt lock and its verified parent directory.
export async function writeTaskHandoff(receiptPath, material, { enforcePrivateModes = true } = {}) {
  const paths = taskHandoffPaths(receiptPath);
  const directory = dirname(paths.json_path);
  try {
    await mkdir(directory, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  await assertMaterialDirectory(directory);
  if (enforcePrivateModes) await chmod(directory, 0o700);
  const normalized = validateTaskHandoff(material);
  await writeMaterial(paths.json_path, serializeMaterial(normalized), enforcePrivateModes);
  await writeMaterial(paths.markdown_path, renderDocument(normalized), enforcePrivateModes);
  return paths;
}

// Sender dispatch reads the saved material while holding the same receipt lock.
export async function readTaskHandoff(receiptPath, digest) {
  const paths = taskHandoffPaths(receiptPath);
  await assertMaterialDirectory(dirname(paths.json_path));
  const material = parseMaterial(await readRegularFile(paths.json_path));
  if (taskHandoffDigest(material) !== digest) throw new Error("saved task handoff does not match the provisioning receipt");
  const markdown = decode(await readRegularFile(paths.markdown_path));
  if (markdown !== renderDocument(material)) throw new Error("saved task handoff document has changed");
  return { material, ...paths };
}

export function buildManagedBootstrapPrompt({ launchId, repositoryKey, handoff } = {}) {
  assertText(launchId, "launchId");
  assertText(repositoryKey, "repositoryKey");
  const material = validateTaskHandoff(handoff.material);
  const identity = [
    "$dev-flow-codex:dev-flow",
    `Resume the confirmed Dev Flow launch ${launchId} for repository ${repositoryKey}.`,
    "Before any Core call, consume the provisioning receipt, verify the fetched commit and task worktree, create the confirmed target branch when needed, and prove the worktree is clean.",
  ];
  const locations = [
    `Complete handoff and original discussion: ${JSON.stringify(handoff.markdown_path)}`,
    `Structured material with original message text: ${JSON.stringify(handoff.json_path)}`,
    "The saved handoff contains the full development request. Its labeled sections separate confirmed requirements from suggestions, assumptions, and historical discussion.",
  ];
  const navigation = [...identity, `Request overview: ${material.request}`, ...locations].join("\n\n");
  const inline = `${navigation}\n\n${renderBody(material)}`;
  if (Buffer.byteLength(inline, "utf8") <= inlinePromptBytes) return inline;
  const reference = [...identity, ...locations].join("\n\n");
  return `${reference}\n\nRead the complete handoff at the path above for all requirement details; this prompt is only navigation.`;
}

function renderBody(material) {
  const parts = [
    "## Goal and expected result", material.goal,
    "## Confirmed requirements",
    ...material.confirmed_requirements.map((entry, index) => `${index + 1}. ${entry.text}\n\n   Discussion: ${entry.source_ids.join(", ")}`),
  ];
  for (const [key, title] of sections) {
    parts.push(`## ${title}`, material[key].length === 0 ? "None recorded." : material[key].map((text) => `- ${text}`).join("\n\n"));
  }
  return parts.join("\n\n");
}

function renderDocument(material) {
  const messages = material.discussion.map((message) => (
    `### ${message.id} (${message.role})\n\n${message.text.split("\n").map((line) => `> ${line}`).join("\n")}`
  ));
  return [
    "# Dev Flow task handoff", `Request overview: ${material.request}`, renderBody(material),
    "## Original discussion in message order",
    "These messages retain the discussion, including superseded requests and unaccepted suggestions. Current requirements are listed above.",
    ...messages,
    "",
  ].join("\n\n");
}

function serializeMaterial(material) {
  return `${JSON.stringify(validateTaskHandoff(material), null, 2)}\n`;
}

function parseMaterial(bytes) {
  const text = decode(bytes);
  let value;
  try {
    assertNoDuplicateJSONMembers(text);
    value = JSON.parse(text);
  } catch (cause) {
    throw new Error("invalid task handoff JSON", { cause });
  }
  return validateTaskHandoff(value);
}

function decode(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new Error("task handoff must be valid UTF-8", { cause });
  }
}

async function assertMaterialDirectory(path) {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isDirectory() || await realpath(path) !== path) {
    throw new Error("task handoff directory must be a canonical non-symbolic-link directory");
  }
}

async function readRegularFile(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("task handoff must be a regular non-symbolic-link file");
  return await readFile(path);
}

async function writeMaterial(path, text, enforcePrivateModes) {
  try {
    if (!(await readRegularFile(path)).equals(Buffer.from(text, "utf8"))) throw new Error("saved task handoff conflicts with this launch");
    if (enforcePrivateModes) await chmod(path, 0o600);
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const temporaryPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, text, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporaryPath, path);
    if (enforcePrivateModes) await chmod(path, 0o600);
  } finally {
    await unlink(temporaryPath).catch(() => {});
  }
}

function assertKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(`${label} has an invalid closed shape`);
  }
}

function assertText(value, label) {
  if (typeof value !== "string" || value.trim() === "" || value.includes("\0")) throw new Error(`${label} must be non-empty text`);
}

function assertStrings(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  for (const text of value) assertText(text, label);
}
