import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, realpath, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Writable } from 'node:stream'
import test from 'node:test'

import {
  ALLOWED_CORE_ENVIRONMENT,
  createCoreEnvironment,
  defaultDataRoot,
  resolveCorePath,
  resolveDataRoot,
  resolveWorkingDirectory,
} from '../src/runtime.mjs'
import { launchCore } from '../src/launch-core.mjs'

async function tempRoot(label) {
  return mkdtemp(join(tmpdir(), `${label}-`))
}

async function stageExecutable(packageRoot, source) {
  const path = join(packageRoot, 'runtime', 'darwin-arm64', 'dev-flow')
  await mkdir(join(packageRoot, '.git'), { recursive: true })
  await mkdir(join(packageRoot, 'runtime', 'darwin-arm64'), { recursive: true })
  await writeFile(path, source, { mode: 0o700 })
  await chmod(path, 0o700)
  return path
}

test('runtime selects only the package-relative executable on macOS arm64', async () => {
  const packageRoot = await tempRoot('dev flow 包')
  const expected = await stageExecutable(packageRoot, '#!/bin/sh\nexit 0\n')
  assert.equal(await resolveCorePath({ packageRoot, platform: 'darwin', arch: 'arm64' }), await realpath(expected))

  await assert.rejects(
    resolveCorePath({ packageRoot, platform: 'linux', arch: 'arm64' }),
    error => error?.code === 'UNSUPPORTED_PLATFORM',
  )
  await assert.rejects(
    resolveCorePath({ packageRoot, platform: 'darwin', arch: 'x64' }),
    error => error?.code === 'UNSUPPORTED_PLATFORM',
  )
})

test('explicit data root must be absolute, canonical, existing, and usable', async () => {
  const root = await tempRoot('dev-flow-data')
  const worktree = await tempRoot('dev-flow-explicit-worktree')
  await mkdir(join(worktree, '.git'))
  const worktreeRoot = await resolveWorkingDirectory(worktree, 'darwin')
  assert.equal(await resolveDataRoot({
    env: { DEV_FLOW_DATA_DIR: root }, platform: 'darwin', worktreeRoot,
  }), await realpath(root))
  await assert.rejects(
    resolveDataRoot({
      env: { DEV_FLOW_DATA_DIR: 'relative-data' }, platform: 'darwin', worktreeRoot,
    }),
    error => error?.code === 'INVALID_DATA_ROOT',
  )

  const link = `${root}-link`
  await symlink(root, link)
  await assert.rejects(
    resolveDataRoot({ env: { DEV_FLOW_DATA_DIR: link }, platform: 'darwin', worktreeRoot }),
    error => error?.code === 'INVALID_DATA_ROOT',
  )

  const nested = join(root, 'nested')
  await mkdir(nested)
  const parentLink = `${root}-parent-link`
  await symlink(root, parentLink)
  await assert.rejects(
    resolveDataRoot({
      env: { DEV_FLOW_DATA_DIR: join(parentLink, 'nested') }, platform: 'darwin', worktreeRoot,
    }),
    error => error?.code === 'INVALID_DATA_ROOT',
  )
})

test('data root must be disjoint from the canonical target worktree', async () => {
  const sandbox = await tempRoot('dev-flow-root-separation')
  const worktree = join(sandbox, 'repository')
  const inside = join(worktree, 'runtime-data')
  await mkdir(join(worktree, '.git'), { recursive: true })
  await mkdir(inside)
  const canonicalWorktree = await resolveWorkingDirectory(worktree, 'darwin')

  for (const dataRoot of [sandbox, worktree, inside]) {
    await assert.rejects(
      resolveDataRoot({
        env: { DEV_FLOW_DATA_DIR: dataRoot }, platform: 'darwin', worktreeRoot: canonicalWorktree,
      }),
      error => error?.code === 'INVALID_DATA_ROOT',
    )
  }
})

test('default data root refuses a symlinked ancestor that redirects into the worktree', async () => {
  const sandbox = await tempRoot('dev-flow-default-symlink')
  const home = join(sandbox, 'home')
  const worktree = join(sandbox, 'repository')
  await mkdir(home)
  await mkdir(join(worktree, '.git'), { recursive: true })
  await symlink(worktree, join(home, 'Library'))
  const canonicalWorktree = await resolveWorkingDirectory(worktree, 'darwin')
  await assert.rejects(
    resolveDataRoot({ env: { HOME: home }, platform: 'darwin', worktreeRoot: canonicalWorktree }),
    error => error?.code === 'INVALID_DATA_ROOT',
  )
})

test('default data root rejects worktree overlap before creating paths or changing modes', async () => {
  const sandbox = await tempRoot('dev-flow-default-overlap')

  const nestedHome = join(sandbox, 'nested-home')
  const containingWorktree = join(nestedHome, 'Library')
  await mkdir(join(containingWorktree, '.git'), { recursive: true })
  const nestedCandidate = defaultDataRoot(nestedHome, 'darwin')
  await assert.rejects(
    resolveDataRoot({
      env: { HOME: nestedHome },
      platform: 'darwin',
      worktreeRoot: await resolveWorkingDirectory(containingWorktree, 'darwin'),
    }),
    error => error?.code === 'INVALID_DATA_ROOT',
  )
  await assert.rejects(stat(nestedCandidate), error => error?.code === 'ENOENT')

  const ancestorHome = join(sandbox, 'ancestor-home')
  const ancestorCandidate = defaultDataRoot(ancestorHome, 'darwin')
  const nestedWorktree = join(ancestorCandidate, 'repository')
  await mkdir(join(nestedWorktree, '.git'), { recursive: true })
  await chmod(ancestorCandidate, 0o755)
  await assert.rejects(
    resolveDataRoot({
      env: { HOME: ancestorHome },
      platform: 'darwin',
      worktreeRoot: await resolveWorkingDirectory(nestedWorktree, 'darwin'),
    }),
    error => error?.code === 'INVALID_DATA_ROOT',
  )
  assert.equal((await stat(ancestorCandidate)).mode & 0o777, 0o755)
})

test('working directory must be a canonical existing Git worktree root', async () => {
  const root = await tempRoot('dev-flow-working-directory')
  await assert.rejects(
    resolveWorkingDirectory(root, 'darwin'),
    error => error?.code === 'INVALID_WORKING_DIRECTORY',
  )
  await mkdir(join(root, '.git'))
  assert.equal(await resolveWorkingDirectory(root, 'darwin'), await realpath(root))
  const link = `${root}-link`
  await symlink(root, link)
  await assert.rejects(
    resolveWorkingDirectory(link, 'darwin'),
    error => error?.code === 'INVALID_WORKING_DIRECTORY',
  )
})

test('default data root is shared with Codex and created privately', async () => {
  const home = await tempRoot('dev-flow-home')
  const worktree = await tempRoot('dev-flow-default-worktree')
  await mkdir(join(worktree, '.git'))
  const worktreeRoot = await resolveWorkingDirectory(worktree, 'darwin')
  const expected = join(home, 'Library', 'Application Support', 'dev-flow', 'data')
  assert.equal(defaultDataRoot(home, 'darwin'), expected)
  assert.equal(await resolveDataRoot({ env: { HOME: home }, platform: 'darwin', worktreeRoot }), await realpath(expected))
  assert.equal((await stat(expected)).mode & 0o777, 0o700)
})

test('Core receives a newly constructed six-key environment and no ambient secret', () => {
  const source = {
    DEV_FLOW_DATA_DIR: '/data',
    HOME: '/home/test',
    PATH: '/usr/bin',
    LANG: 'en_US.UTF-8',
    LC_ALL: 'C',
    TMPDIR: '/tmp',
    SECRET_TOKEN: 'do-not-forward',
    DSH_HOME: '/dsh',
  }
  const environment = createCoreEnvironment(source, '/canonical-data')
  assert.deepEqual(Object.keys(environment).sort(), [...ALLOWED_CORE_ENVIRONMENT].sort())
  assert.equal(environment.DEV_FLOW_DATA_DIR, '/canonical-data')
  assert.equal(Object.hasOwn(environment, 'SECRET_TOKEN'), false)
  assert.equal(Object.hasOwn(environment, 'DSH_HOME'), false)
})

test('launcher forwards raw STDIO, reports bounded diagnostics, and reaps once', async () => {
  const packageRoot = await tempRoot('dev flow launcher 空格')
  await stageExecutable(packageRoot, [
    '#!/bin/sh',
    '/bin/cat',
    "printf '%s\\n' 'fake-core-diagnostic' >&2",
  ].join('\n'))
  const dataRoot = await tempRoot('dev-flow-launch-data')
  let output = ''
  let diagnostic = ''
  const stdout = new Writable({ write(chunk, _encoding, callback) { output += chunk; callback() } })
  const stderr = new Writable({ write(chunk, _encoding, callback) { diagnostic += chunk; callback() } })
  const code = await launchCore({
    packageRoot,
    platform: 'darwin',
    arch: 'arm64',
    cwd: packageRoot,
    env: { HOME: packageRoot, DEV_FLOW_DATA_DIR: dataRoot, SECRET: 'hidden' },
    stdin: Readable.from(['raw-json-rpc\n']),
    stdout,
    stderr,
  })
  assert.equal(code, 0)
  assert.equal(output, 'raw-json-rpc\n')
  assert.match(diagnostic, /^dev-flow-deepseek: Core diagnostic:/)
  assert.equal(diagnostic.includes('hidden'), false)
})

test('missing and non-executable Core fail with fixed non-secret diagnostics', async () => {
  const packageRoot = await tempRoot('missing-core')
  const dataRoot = await tempRoot('missing-core-data')
  let diagnostic = ''
  const stderr = new Writable({ write(chunk, _encoding, callback) { diagnostic += chunk; callback() } })
  await assert.rejects(launchCore({
    packageRoot,
    platform: 'darwin',
    arch: 'arm64',
    cwd: packageRoot,
    env: { HOME: packageRoot, DEV_FLOW_DATA_DIR: dataRoot, TOP_SECRET: 'never-print' },
    stdin: Readable.from([]),
    stdout: new Writable({ write(_chunk, _encoding, callback) { callback() } }),
    stderr,
  }))
  assert.equal(diagnostic.includes('never-print'), false)
  assert.ok(Buffer.byteLength(diagnostic) <= 2048)

  await stageExecutable(packageRoot, '#!/bin/sh\nexit 0\n')
  await chmod(join(packageRoot, 'runtime', 'darwin-arm64', 'dev-flow'), 0o600)
  await assert.rejects(
    resolveCorePath({ packageRoot, platform: 'darwin', arch: 'arm64' }),
    error => error?.code === 'CORE_RUNTIME_UNAVAILABLE',
  )
})

test('runtime rejects a package-relative symlink even when its target is executable', async () => {
  const packageRoot = await tempRoot('symlink-core')
  const targetRoot = await tempRoot('external-core')
  const target = join(targetRoot, 'dev-flow')
  await writeFile(target, '#!/bin/sh\nexit 0\n', { mode: 0o700 })
  await mkdir(join(packageRoot, 'runtime', 'darwin-arm64'), { recursive: true })
  await symlink(target, join(packageRoot, 'runtime', 'darwin-arm64', 'dev-flow'))
  await assert.rejects(
    resolveCorePath({ packageRoot, platform: 'darwin', arch: 'arm64' }),
    error => error?.code === 'INVALID_CORE_RUNTIME',
  )
})

test('nonzero exit keeps stdout pure and withholds child stderr content', async () => {
  const packageRoot = await tempRoot('early-exit-core')
  await stageExecutable(packageRoot, [
    '#!/bin/sh',
    "printf '%s' 'protocol-bytes'",
    "printf '%s' 'credential=do-not-render' >&2",
    'exit 23',
  ].join('\n'))
  const dataRoot = await tempRoot('early-exit-data')
  let output = ''
  let diagnostic = ''
  await assert.rejects(launchCore({
    packageRoot,
    platform: 'darwin',
    arch: 'arm64',
    cwd: packageRoot,
    env: { HOME: packageRoot, DEV_FLOW_DATA_DIR: dataRoot, SECRET: 'do-not-render' },
    stdin: Readable.from([]),
    stdout: new Writable({ write(chunk, _encoding, callback) { output += chunk; callback() } }),
    stderr: new Writable({ write(chunk, _encoding, callback) { diagnostic += chunk; callback() } }),
  }), error => error?.code === 'CORE_EXITED')
  assert.equal(output, 'protocol-bytes')
  assert.equal(diagnostic.includes('credential=do-not-render'), false)
  assert.equal(diagnostic.includes('do-not-render'), false)
  assert.ok(Buffer.byteLength(diagnostic) <= 2048)
})

test('abort terminates the child and reports cancellation without workflow side effects', async () => {
  const packageRoot = await tempRoot('cancel-core')
  await stageExecutable(packageRoot, [
    '#!/bin/sh',
    "trap 'exit 0' TERM INT",
    'while :; do /bin/sleep 1; done',
  ].join('\n'))
  const dataRoot = await tempRoot('cancel-data')
  const controller = new AbortController()
  const launched = launchCore({
    packageRoot,
    platform: 'darwin',
    arch: 'arm64',
    cwd: packageRoot,
    env: { HOME: packageRoot, DEV_FLOW_DATA_DIR: dataRoot },
    stdin: Readable.from([]),
    stdout: new Writable({ write(_chunk, _encoding, callback) { callback() } }),
    stderr: new Writable({ write(_chunk, _encoding, callback) { callback() } }),
    signal: controller.signal,
  })
  controller.abort()
  await assert.rejects(launched, error => error?.code === 'CORE_CANCELLED')
})

test('abort forwards the received SIGINT or SIGTERM identity to the child', { timeout: 4000 }, async () => {
  for (const receivedSignal of ['SIGINT', 'SIGTERM']) {
    const packageRoot = await tempRoot(`signal-identity-${receivedSignal.toLowerCase()}`)
    await stageExecutable(packageRoot, [
      '#!/bin/sh',
      "trap 'printf \"%s\\n\" \"received:SIGINT\"; exit 0' INT",
      "trap 'printf \"%s\\n\" \"received:SIGTERM\"; exit 0' TERM",
      "printf '%s\\n' 'ready'",
      'while :; do :; done',
    ].join('\n'))
    const dataRoot = await tempRoot(`signal-data-${receivedSignal.toLowerCase()}`)
    const controller = new AbortController()
    let output = ''
    let abortRequested = false
    const launched = launchCore({
      packageRoot,
      platform: 'darwin',
      arch: 'arm64',
      cwd: packageRoot,
      env: { HOME: packageRoot, DEV_FLOW_DATA_DIR: dataRoot },
      stdin: Readable.from([]),
      stdout: new Writable({
        write(chunk, _encoding, callback) {
          output += chunk
          if (!abortRequested && output.includes('ready')) {
            abortRequested = true
            controller.abort(receivedSignal)
          }
          callback()
        },
      }),
      stderr: new Writable({ write(_chunk, _encoding, callback) { callback() } }),
      signal: controller.signal,
    })
    await assert.rejects(launched, error => error?.code === 'CORE_CANCELLED')
    assert.match(output, new RegExp(`received:${receivedSignal}(?:\\n|$)`))
    const otherSignal = receivedSignal === 'SIGINT' ? 'SIGTERM' : 'SIGINT'
    assert.doesNotMatch(output, new RegExp(`received:${otherSignal}(?:\\n|$)`))
  }
})

test('abort escalates when the child ignores TERM and still reaps within a fixed bound', { timeout: 2000 }, async () => {
  const packageRoot = await tempRoot('stubborn-core')
  await stageExecutable(packageRoot, [
    '#!/bin/sh',
    "trap '' TERM",
    "printf '%s' 'ready'",
    'while :; do :; done',
  ].join('\n'))
  const dataRoot = await tempRoot('stubborn-data')
  const controller = new AbortController()
  const started = Date.now()
  let ready = false
  const launched = launchCore({
    packageRoot,
    platform: 'darwin',
    arch: 'arm64',
    cwd: packageRoot,
    env: { HOME: packageRoot, DEV_FLOW_DATA_DIR: dataRoot },
    stdin: Readable.from([]),
    stdout: new Writable({
      write(chunk, _encoding, callback) {
        if (chunk.toString().includes('ready')) {
          ready = true
          controller.abort()
        }
        callback()
      },
    }),
    stderr: new Writable({ write(_chunk, _encoding, callback) { callback() } }),
    signal: controller.signal,
  })
  await assert.rejects(launched, error => error?.code === 'CORE_CANCELLED')
  assert.equal(ready, true)
  assert.ok(Date.now() - started < 750, 'cancelled Core must be killed and reaped within the fixed bound')
})

test('invalid working directory uses the same bounded non-secret diagnostic path', async () => {
  const packageRoot = await tempRoot('invalid-cwd-core')
  await stageExecutable(packageRoot, '#!/bin/sh\nexit 0\n')
  const dataRoot = await tempRoot('invalid-cwd-data')
  let diagnostic = ''
  await assert.rejects(launchCore({
    packageRoot,
    platform: 'darwin',
    arch: 'arm64',
    cwd: 'relative-worktree',
    env: { HOME: packageRoot, DEV_FLOW_DATA_DIR: dataRoot },
    stdin: Readable.from([]),
    stdout: new Writable({ write(_chunk, _encoding, callback) { callback() } }),
    stderr: new Writable({ write(chunk, _encoding, callback) { diagnostic += chunk; callback() } }),
  }), error => error?.code === 'INVALID_WORKING_DIRECTORY')
  assert.match(diagnostic, /^dev-flow-deepseek: Core diagnostic: INVALID_WORKING_DIRECTORY/)
  assert.ok(Buffer.byteLength(diagnostic) <= 2048)
})

test('launcher source has one shell-free subprocess and no listener, network, or result parser', async () => {
  const source = await readFile(new URL('../src/launch-core.mjs', import.meta.url), 'utf8')
  assert.match(source, /shell: false/)
  assert.equal((source.match(/\bspawn\(/g) ?? []).length, 1)
  for (const forbidden of [
    /node:http/,
    /node:https/,
    /node:net/,
    /createServer/,
    /listen\(/,
    /fetch\(/,
    /JSON\.parse/,
    /dev_flow_apply_action/,
    /\brm\(/,
    /\bunlink/,
    /\brmdir/,
  ]) assert.doesNotMatch(source, forbidden)
})
