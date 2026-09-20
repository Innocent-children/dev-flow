import { join } from "node:path";

export const runtimeKey = "darwin-arm64";
export const runtimeExecutable = "dev-flow";
export const forwardedSignals = ["SIGINT", "SIGTERM", "SIGHUP"];
export const homeDirectory = (environment, fallback) => environment.HOME || fallback;
export const productRoot = (_environment, home) => join(home, ".dev-flow");
export const nativeGitPath = value => value;
