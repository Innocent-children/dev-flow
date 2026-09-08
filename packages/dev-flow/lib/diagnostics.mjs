import { readFile } from "node:fs/promises";

// Lifecycle diagnostics describe installation health without changing user files.
export async function diagnoseInstallation(observed, { host } = {}) {
  const checks = [];
  const hasReadyAdapter = [observed.codex, ...observed.deepseek].some(target => target?.state === "ready");
  for (const target of [observed.codex, ...observed.deepseek].filter(Boolean)) {
    const name = `${target.host}${target.profile ? `/${target.profile}` : ""}`;
    checks.push({ name, status: target.state === "ready" ? "passed" : host === "all" && hasReadyAdapter && target.state === "absent" ? "not_installed" : "failed",
      message: target.state === "ready" ? `Adapter ${target.packageVersion}, Core ${target.coreVersion ?? "unknown"}`
        : target.issues?.map(issue => issue.message).join("; ") || target.state });
  }
  const configuration = observed.resources.configuration;
  if (configuration.exists) {
    try {
      const value = JSON.parse(await readFile(configuration.path, "utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value) ||
          Object.keys(value).some(key => !["codex", "deepseek"].includes(key)) ||
          ["codex", "deepseek"].some(key => value[key] !== undefined &&
            (!value[key] || typeof value[key] !== "object" || Array.isArray(value[key]) ||
             Object.keys(value[key]).some(field => field !== "codebase_memory") ||
             typeof value[key].codebase_memory !== "boolean"))) throw new Error("invalid Host preference fields");
      checks.push({ name: "configuration", status: "passed", message: configuration.path });
    } catch (error) {
      checks.push({ name: "configuration", status: "failed", message: `${configuration.path}: ${error.message}` });
    }
  } else checks.push({ name: "configuration", status: "passed", message: "Default preferences apply; configuration is absent." });
  for (const resource of [observed.resources.defaultData, observed.resources.explicitData].filter(Boolean)) {
    checks.push({ name: resource.label, status: "passed", message: `${resource.path}: ${resource.exists ? "present" : "not created"}` });
  }
  return checks;
}
