import test from 'node:test';
import assert from 'node:assert';
import { runSilentCommand } from '../lib/util.mjs';

test('runSilentCommand executes successfully', (t) => {
  const result = runSilentCommand('echo', ['"hello"']);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /hello/);
});
