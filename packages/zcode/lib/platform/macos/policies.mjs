import { join } from "node:path";

export const runtimeKey = "darwin-arm64";
export const runtimeExecutable = "taskbelay";
export const forwardedSignals = ["SIGINT", "SIGTERM", "SIGHUP"];
export const homeDirectory = (environment, fallback) => environment.HOME || fallback;
export const productRoot = (_environment, home) => join(home, ".taskbelay");
export const nativeGitPath = value => value;
