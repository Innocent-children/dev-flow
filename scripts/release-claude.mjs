#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { parseHostReleaseArguments, runHostReleaseCommand, runHostReleaseCLI } from "../release/host-command.mjs";

export const parseReleaseArguments = args => parseHostReleaseArguments("claude", args);
export const runReleaseCommand = options => runHostReleaseCommand({ ...options, product: "claude" });

if (process.argv[1] === fileURLToPath(import.meta.url)) await runHostReleaseCLI("claude");
