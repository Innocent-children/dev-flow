import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { runCommand, runSilentCommand, safeRemove } from './util.mjs';

const DATA_DIR = join(homedir(), 'Library', 'Application Support', 'dev-flow');

export function installCodex() {
  console.log('Installing Codex Adapter...');
  runCommand('npm', ['install', '-g', 'dev-flow-codex@latest']);
  runCommand('dev-flow-codex', ['setup']);
  console.log('Codex Adapter installed successfully.');
}

export function installDeepSeek(profile = 'web') {
  console.log(`Installing DeepSeek Adapter to profile: ${profile}...`);
  // Check for dsh
  const check = runSilentCommand('dsh', ['--version']);
  if (check.status !== 0) {
    console.error('Error: dsh CLI not found. Please install it with "npm install -g @deepseek-ai/dsh@latest"');
    process.exit(1);
  }

  const tmp = tmpdir();
  console.log(`Creating tarball in ${tmp}...`);
  const packResult = runSilentCommand('npm', ['pack', 'dev-flow-deepseek@latest', '--silent'], { cwd: tmp });
  if (packResult.status !== 0) {
    console.error('Failed to download dev-flow-deepseek:', packResult.stderr);
    process.exit(1);
  }
  
  const tarballName = packResult.stdout.split('\n').pop().trim();
  const tarballPath = join(tmp, tarballName);
  
  try {
    console.log(`Adding plugin to DSH profile '${profile}'...`);
    runCommand('dsh', ['plugin', '--profile', profile, 'add', tarballPath]);
    console.log(`DeepSeek Adapter installed to DSH profile '${profile}' successfully.`);
  } finally {
    safeRemove(tarballPath);
  }
}

export function uninstallCodex() {
  console.log('Uninstalling Codex Adapter...');
  try {
    runCommand('dev-flow-codex', ['remove']);
  } catch (e) {
    console.log('Warning: dev-flow-codex remove failed, it might not be installed or already removed.');
  }
  runCommand('npm', ['uninstall', '-g', 'dev-flow-codex']);
  console.log('Codex Adapter uninstalled.');
}

export function uninstallDeepSeek(profile = 'web') {
  console.log(`Uninstalling DeepSeek Adapter from profile: ${profile}...`);
  runCommand('dsh', ['plugin', '--profile', profile, 'remove', 'dev-flow-deepseek']);
  console.log(`DeepSeek Adapter removed from profile '${profile}'.`);
}

export function cleanData(force = false) {
  if (!force) {
    console.error('Error: You must provide --force to clean data directories.');
    process.exit(1);
  }
  console.log(`Cleaning Dev Flow data directory: ${DATA_DIR}...`);
  safeRemove(DATA_DIR);
  console.log('Data directory cleaned successfully.');
}

export function showStatus() {
  console.log('--- Dev Flow Environment Status ---');
  
  // Codex
  const codexCheck = runSilentCommand('dev-flow-codex', ['--version']);
  if (codexCheck.status === 0) {
    console.log('Codex Adapter: Installed');
    console.log(`  Version: ${codexCheck.stdout}`);
  } else {
    console.log('Codex Adapter: Not installed');
  }

  // DeepSeek
  const dshCheck = runSilentCommand('dsh', ['--version']);
  if (dshCheck.status === 0) {
    console.log('DeepSeek (DSH): Installed');
    console.log(`  DSH Version: ${dshCheck.stdout}`);
    // Check web profile config
    const configCheck = runSilentCommand('dsh', ['--profile', 'web', '--dump-config']);
    if (configCheck.status === 0 && configCheck.stdout.includes('dev-flow-deepseek')) {
      console.log('  Adapter Status in "web" profile: Installed');
    } else {
      console.log('  Adapter Status in "web" profile: Not installed');
    }
  } else {
    console.log('DeepSeek (DSH): Not installed');
  }
}

export function upgradeAdapter(target, profile = 'web') {
  if (target === 'codex') {
    uninstallCodex();
    installCodex();
  } else if (target === 'deepseek') {
    uninstallDeepSeek(profile);
    installDeepSeek(profile);
  } else {
    console.error('Unknown target:', target);
    process.exit(1);
  }
}
