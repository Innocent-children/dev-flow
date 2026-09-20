import { validateConfigurationFile } from "./configuration.mjs";

/**
 * Lifecycle diagnostics describe installation health without changing user files.
 */
export async function diagnoseInstallation(observed, { host, paths, environment, validateConfiguration = validateConfigurationFile } = {}) {
  const checks = [];
  const hasReadyAdapter = [observed.codex, ...observed.deepseek, observed.claude].some(target => target?.state === "ready");
  for (const target of [observed.codex, ...observed.deepseek, observed.claude].filter(Boolean)) {
    const name = `${target.host}${target.profile ? `/${target.profile}` : ""}`;
    checks.push({ name, status: target.state === "ready" ? "passed" : host === "all" && hasReadyAdapter && target.state === "absent" ? "not_installed" : "failed",
      message: target.state === "ready" ? `Adapter ${target.packageVersion}, Core ${target.coreVersion ?? "unknown"}`
        : target.issues?.map(issue => issue.message).join("; ") || target.state });
  }
  const configuration = observed.resources.configuration;
  if (configuration.exists) {
    try {
      await validateConfiguration(configuration.path, { host, paths, environment });
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
