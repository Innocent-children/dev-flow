/**
 * macOS allows replacing a running executable without stopping Core.
 */
export async function prepareReplacement() {}
export async function prepareInstallation() { return false; }
export { stopStdioCores, assertManagedCoresStopped } from "./core-processes.mjs";
