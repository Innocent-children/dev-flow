#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;

export const PUBLIC_RELEASE_DOCUMENT_PATHS = Object.freeze([
  "README.md",
  "README_de.md",
  "README_en.md",
  "README_es.md",
  "README_fr.md",
  "README_ja.md",
  "README_ko.md",
  "README_pt-BR.md",
  "README_zh-TW.md",
  "docs/CODEX_en.md",
  "docs/DEEPSEEK_en.md",
  "docs/PRODUCT.md",
  "docs/PRODUCT_en.md",
  "docs/ROADMAP.md",
  "docs/ROADMAP_en.md",
  "docs/SUPPORT-MATRIX.md",
  "docs/SUPPORT-MATRIX_en.md",
  "packages/codex/README.md",
  "packages/deepseek/README.md",
]);

const PRODUCT_DOCUMENTS = Object.freeze({
  codex: new Set(["docs/CODEX_en.md", "packages/codex/README.md"]),
  deepseek: new Set(["docs/DEEPSEEK_en.md", "packages/deepseek/README.md"]),
});

export async function syncPublicReleaseDocs(root, { product, version, coreVersion }) {
  validateSelection({ product, version, coreVersion });
  const metadataPath = join(root, "release", "public-versions.json");
  const current = JSON.parse(await readFile(metadataPath, "utf8"));
  validateMetadata(current);
  const previous = structuredClone(current);
  const next = structuredClone(current);
  next.core_version = coreVersion;
  next[product] = { version, core_version: coreVersion };

  const updates = [];
  for (const relativePath of PUBLIC_RELEASE_DOCUMENT_PATHS) {
    const path = join(root, relativePath);
    const before = await readFile(path, "utf8");
    const after = transformDocument(relativePath, before, previous, next, product);
    if (after !== before) updates.push({ path, relativePath, contents: after });
  }
  const metadata = `${JSON.stringify(next, null, 2)}\n`;
  if (metadata !== `${JSON.stringify(current, null, 2)}\n`) {
    updates.push({ path: metadataPath, relativePath: "release/public-versions.json", contents: metadata });
  }
  const changedPaths = updates.map((update) => update.relativePath);
  if (changedPaths.length === 0) throw new Error("public release documentation already matches the requested version identity");
  await Promise.all(updates.map((update) => writeFile(update.path, update.contents)));
  return Object.freeze({ previous, current: next, changedPaths: Object.freeze(changedPaths.sort()) });
}

export async function verifyPublicReleaseDocs(root) {
  const metadata = JSON.parse(await readFile(join(root, "release", "public-versions.json"), "utf8"));
  validateMetadata(metadata);
  for (const relativePath of PUBLIC_RELEASE_DOCUMENT_PATHS) {
    const text = await readFile(join(root, relativePath), "utf8");
    transformDocument(relativePath, text, metadata, metadata, "codex");
    transformDocument(relativePath, text, metadata, metadata, "deepseek");
  }
  return metadata;
}

function transformDocument(relativePath, text, previous, next, product) {
  const otherProduct = product === "codex" ? "deepseek" : "codex";
  if (PRODUCT_DOCUMENTS[otherProduct].has(relativePath)) return text;
  const productDocument = PRODUCT_DOCUMENTS[product].has(relativePath);
  let productMatches = 0;
  let coreMatches = 0;
  const lines = text.split("\n").map((line) => {
    const codex = productDocument && product === "codex" || /dev-flow-codex|codex-v|\bCodex\b/u.test(line);
    const deepseek = productDocument && product === "deepseek" || /dev-flow-deepseek|deepseek-v|\bDeepSeek\b/u.test(line);
    const selected = product === "codex" ? codex && !deepseek : deepseek && !codex;
    let result = line;
    if (selected) {
      const replacement = replaceAllCounted(result, previous[product].version, next[product].version);
      result = replacement.text;
      productMatches += replacement.count || countOccurrences(result, next[product].version);
      if (/\bCore\b|dev-flow-(?:codex|deepseek)/u.test(result)) {
        const coreReplacement = replaceAllCounted(result, previous[product].core_version, next[product].core_version);
        result = coreReplacement.text;
        coreMatches += coreReplacement.count || countOccurrences(result, next[product].core_version);
      }
    }
    if (/\bCore\b/u.test(result) && !codex && !deepseek) {
      const replacement = replaceAllCounted(result, previous.core_version, next.core_version);
      result = replacement.text;
      coreMatches += replacement.count || countOccurrences(result, next.core_version);
    }
    return result;
  });
  if (productMatches === 0) throw new Error(`${relativePath} has no ${product} release identity to update`);
  if (previous[product].core_version !== next[product].core_version && coreMatches === 0) {
    throw new Error(`${relativePath} has no bundled Core release identity to update`);
  }
  return lines.join("\n");
}

function replaceAllCounted(text, before, after) {
  if (before === after) return { text, count: 0 };
  const parts = text.split(before);
  return { text: parts.join(after), count: parts.length - 1 };
}

function countOccurrences(text, value) {
  return text.split(value).length - 1;
}

function validateSelection({ product, version, coreVersion }) {
  if (!["codex", "deepseek"].includes(product)) throw new Error("product must equal codex or deepseek");
  if (!SEMVER_PATTERN.test(version ?? "") || !SEMVER_PATTERN.test(coreVersion ?? "")) {
    throw new Error("product and Core versions must be strict MAJOR.MINOR.PATCH");
  }
}

function validateMetadata(value) {
  if (!SEMVER_PATTERN.test(value?.core_version ?? "")) throw new Error("public Core version metadata is invalid");
  for (const product of ["codex", "deepseek"]) {
    if (!SEMVER_PATTERN.test(value?.[product]?.version ?? "") || !SEMVER_PATTERN.test(value?.[product]?.core_version ?? "")) {
      throw new Error(`public ${product} version metadata is invalid`);
    }
  }
}

function parseArguments(arguments_) {
  const values = new Map();
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    if (!["--product", "--version", "--core-version"].includes(flag) || index + 1 >= arguments_.length) {
      throw new Error("usage: sync-public-release-docs.mjs --product codex|deepseek --version VERSION --core-version CORE_VERSION");
    }
    values.set(flag, arguments_[index + 1]);
  }
  return { product: values.get("--product"), version: values.get("--version"), coreVersion: values.get("--core-version") };
}

function repositoryRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await syncPublicReleaseDocs(repositoryRoot(), parseArguments(process.argv.slice(2)));
    process.stdout.write(`${result.changedPaths.join("\n")}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
