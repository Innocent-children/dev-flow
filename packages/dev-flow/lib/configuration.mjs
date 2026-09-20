import { execFile } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { resolveCoreRuntime } from "./runtime.mjs";

export async function validateConfigurationFile(path, {
  environment = process.env,
  host,
  paths,
  resolveRuntime = resolveCoreRuntime,
  run = runCore,
} = {}) {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error("configuration must be a regular non-symbolic-link file");
  if ((paths?.enforcePrivateModes ?? process.platform !== "win32") && (info.mode & 0o077) !== 0) {
    throw new Error("configuration permissions are unsafe");
  }
  const raw = await readFile(path);
  let runtime;
  try {
    runtime = await resolveRuntime({ environment, host, homeDirectory: paths?.homeDirectory, platform: paths?.platform, arch: paths?.arch, requireData: false });
  } catch (error) {
    throw new Error(`Core configuration validation unavailable: ${error.message}`, { cause: error });
  }
  let response;
  try {
    response = await run(runtime.runtimePath, ["config", "validate"], {
      env: environment, input: raw, encoding: "utf8", timeout: 10000, maxBuffer: 64 * 1024, windowsHide: true,
    });
  } catch (error) {
    if (!error.stdout) throw new Error("Core configuration validation unavailable", { cause: error });
    response = error;
  }
  let report;
  try { report = JSON.parse(response.stdout); }
  catch (error) { throw new Error("invalid Core configuration validation response", { cause: error }); }
  if (report?.ok === false && typeof report.error?.message === "string") throw new Error(report.error.message);
  if (response instanceof Error || report?.ok !== true || report.result === null || typeof report.result !== "object" || Array.isArray(report.result)) {
    throw new Error("invalid Core configuration validation response");
  }
  return report.result;
}

function runCore(executable, args, { input, ...options }) {
  return new Promise((resolve, reject) => {
    const child = execFile(executable, args, options, (error, stdout, stderr) => {
      if (error) { error.stdout = stdout; reject(error); }
      else resolve({ stdout, stderr });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
