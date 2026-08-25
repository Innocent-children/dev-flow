#!/usr/bin/env node

import { parseArgs } from 'node:util';
import * as commands from '../lib/commands.mjs';
import { startTUI } from '../lib/interactive.mjs';

const options = {
  profile: {
    type: 'string',
    short: 'p',
    default: 'web',
  },
  force: {
    type: 'boolean',
    short: 'f',
    default: false,
  }
};

const args = process.argv.slice(2);

// If no arguments provided, start interactive mode
if (args.length === 0) {
  startTUI().catch(err => {
    console.error(err);
    process.exit(1);
  });
} else {
  try {
    const { values, positionals } = parseArgs({ args, options, allowPositionals: true });
    const command = positionals[0];
    const target = positionals[1]; // 'codex' or 'deepseek'

    switch (command) {
      case 'status':
        commands.showStatus();
        break;
      case 'install':
        if (target === 'codex') commands.installCodex();
        else if (target === 'deepseek') commands.installDeepSeek(values.profile);
        else console.error('Unknown target. Use "codex" or "deepseek".');
        break;
      case 'uninstall':
        if (target === 'codex') commands.uninstallCodex();
        else if (target === 'deepseek') commands.uninstallDeepSeek(values.profile);
        else console.error('Unknown target. Use "codex" or "deepseek".');
        break;
      case 'upgrade':
        if (target === 'codex' || target === 'deepseek') {
          commands.upgradeAdapter(target, values.profile);
        } else {
          console.error('Unknown target. Use "codex" or "deepseek".');
        }
        break;
      case 'clean':
        commands.cleanData(values.force);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Available commands: status, install <codex|deepseek>, uninstall <codex|deepseek>, upgrade <codex|deepseek>, clean');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error parsing arguments: ${error.message}`);
    process.exit(1);
  }
}
