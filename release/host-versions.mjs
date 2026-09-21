import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isReleaseVersion } from "../scripts/release-channel.mjs";
import { HOST_PRODUCTS, releaseProducts } from "./products.mjs";

const mirrors = {
  codex: ["plugin/.codex-plugin/plugin.json"],
  deepseek: [],
  claude: [".claude-plugin/plugin.json"],
  zcode: [".zcode-plugin/plugin.json", "marketplace.json"],
};

export function hostVersionPaths(product) {
  if (!HOST_PRODUCTS.includes(product)) throw new Error("invalid Host release product");
  return ["package.json", ...mirrors[product]].map(path => `packages/${product}/${path}`);
}

async function readVersionRecords(root, product) {
  const records = await Promise.all(hostVersionPaths(product).map(async path => {
    const document = JSON.parse(await readFile(join(root, path), "utf8"));
    let member = document;
    if (product === "zcode" && path.endsWith("/marketplace.json")) {
      if (document.name !== "dev-flow-zcode-local" || document.plugins?.length !== 1) {
        throw new Error("ZCode marketplace must contain its single owned plugin");
      }
      member = document.plugins[0];
    }
    if (member?.name !== releaseProducts[product].packageName || !isReleaseVersion(member.version)) {
      throw new Error(`${path} package identity or release version is invalid`);
    }
    return { path, document, member };
  }));
  if (records.some(record => record.member.version !== records[0].member.version)) {
    throw new Error(`${product} package, plugin and marketplace versions must agree`);
  }
  return records;
}

export async function readHostVersion(root, product) {
  return (await readVersionRecords(root, product))[0].member.version;
}

export async function writeHostVersion(root, product, expectedVersion, targetVersion) {
  if (!isReleaseVersion(targetVersion)) throw new Error("invalid target release version");
  const records = await readVersionRecords(root, product);
  if (records[0].member.version !== expectedVersion) throw new Error(`${product} version changed during release preparation`);
  for (const { path, document, member } of records) {
    member.version = targetVersion;
    await writeFile(join(root, path), `${JSON.stringify(document, null, 2)}\n`);
  }
  return records.map(record => record.path);
}
