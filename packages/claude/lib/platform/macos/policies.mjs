import { join } from "node:path";
export const runtimeKey = "darwin-arm64";
export const runtimeExecutable = "dev-flow";
export const forwardedSignals = ["SIGINT", "SIGTERM", "SIGHUP"];
export const homeDirectory = (environment, fallback) => environment.HOME || fallback;
export function productRoot(environment, home) { return join(home, ".dev-flow"); }
export const nativeGitPath = value => value;
