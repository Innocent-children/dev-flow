import { execFile as callback } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
const execFile = promisify(callback);
const names = { codex: "dev-flow-codex", deepseek: "dev-flow-deepseek" };
export function releaseOutputNames(product, version, coreVersion) { return [`dev-flow-core-${coreVersion}-darwin-arm64`, `dev-flow-core-${coreVersion}-windows-amd64.exe`, `${names[product]}-${version}.tgz`, "release-manifest.json", "SHA256SUMS"].sort(); }
export async function prepareRelease({ product, repositoryRoot, sourceCommit, sourceTree, firstTarball, secondTarball, outputDirectory }) {
  if (!names[product]) throw Error("invalid release product");
  const version=JSON.parse(await readFile(join(repositoryRoot,`packages/${product}/package.json`),"utf8")).version;
  const coreVersion=(await readFile(join(repositoryRoot,"CORE_VERSION"),"utf8")).trim();
  const firstSHA=await sha(firstTarball),secondSHA=await sha(secondTarball);if(firstSHA!==secondSHA)throw Error("release builds are not deterministic");
  const tarballName=`${names[product]}-${version}.tgz`,coreName=`dev-flow-core-${coreVersion}-darwin-arm64`,windowsCoreName=`dev-flow-core-${coreVersion}-windows-amd64.exe`;
  await copyFile(firstTarball,join(outputDirectory,tarballName));
  const {stdout}=await execFile("tar",["-xOf",firstTarball,"package/runtime/darwin-arm64/dev-flow"],{encoding:null,maxBuffer:64*1024*1024,shell:false});
  await writeFile(join(outputDirectory,coreName),stdout,{mode:0o755});await chmod(join(outputDirectory,coreName),0o755);
  const {stdout:windowsCore}=await execFile("tar",["-xOf",firstTarball,"package/runtime/win32-x64/dev-flow.exe"],{encoding:null,maxBuffer:64*1024*1024,shell:false});
  await writeFile(join(outputDirectory,windowsCoreName),windowsCore,{mode:0o755});
  const artifacts=[];for(const [kind,name] of [["npm_tarball",tarballName],["core_binary",coreName],["core_binary",windowsCoreName]])artifacts.push({kind,relative_path:name,sha256:await sha(join(outputDirectory,name))});
  const manifest={release:{product,version,core_version:coreVersion,source_commit:sourceCommit,source_tree:sourceTree},artifacts};
  await writeFile(join(outputDirectory,"release-manifest.json"),`${JSON.stringify(manifest,null,2)}\n`);
  const checksumNames=[tarballName,coreName,windowsCoreName,"release-manifest.json"];
  await writeFile(join(outputDirectory,"SHA256SUMS"),(await Promise.all(checksumNames.map(async name=>`${await sha(join(outputDirectory,name))}  ${name}`))).join("\n")+"\n");
  return {product,version,core_version:coreVersion,source_commit:sourceCommit,output_files:releaseOutputNames(product,version,coreVersion)};
}
async function sha(path){return createHash("sha256").update(await readFile(path)).digest("hex");}
