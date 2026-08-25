import { spawnSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed with status ${result.status}`);
  }
  return result;
}

export function runSilentCommand(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf-8', ...options });
  return {
    stdout: result.stdout ? result.stdout.trim() : '',
    stderr: result.stderr ? result.stderr.trim() : '',
    status: result.status
  };
}

export function safeRemove(targetPath) {
  if (existsSync(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
  }
}
