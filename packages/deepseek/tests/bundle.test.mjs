import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = join(packageRoot, 'package.json')
const rawToolNames = [
  'dev_flow_server_info',
  'dev_flow_open_task',
  'dev_flow_get_task',
  'dev_flow_get_next_action',
  'dev_flow_apply_action',
  'dev_flow_cancel_task',
]

async function readManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'))
}

async function walk(root) {
  const files = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else files.push(relative(packageRoot, path))
  }
  return files.sort()
}

test('manifest declares one private Harness bundle with a reviewed allowlist', async () => {
  const manifest = await readManifest()
  assert.equal(manifest.name, 'dev-flow-deepseek')
  assert.equal(manifest.version, '0.1.0')
  assert.equal(manifest.private, true)
  assert.equal(manifest.type, 'module')
  assert.equal(manifest.engines?.node, '>=24')
  assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml')
  assert.equal(manifest.main, './src/index.mjs')
  assert.deepEqual(manifest.dependencies, {
    '@deepseek-ai/dsh-mcp-client': '^0.1.0-rc.6',
  })

  for (const forbidden of ['bin', 'scripts', 'publishConfig', 'optionalDependencies', 'peerDependencies']) {
    assert.equal(Object.hasOwn(manifest, forbidden), false, `manifest must not contain ${forbidden}`)
  }

  assert.deepEqual(manifest.files, [
    'README.md',
    'cordis.patch.yml',
    'src/*.mjs',
    'skills/dev-flow/SKILL.md',
    'runtime/darwin-arm64/dev-flow',
  ])
})

test('bundle patch contributes one provider and one bounded native STDIO MCP integration', async () => {
  const patch = await readFile(join(packageRoot, 'cordis.patch.yml'), 'utf8')
  assert.equal((patch.match(/name: \.\/src\/index\.mjs/g) ?? []).length, 1)
  assert.equal((patch.match(/name: '@deepseek-ai\/dsh-mcp-client'/g) ?? []).length, 1)
  assert.match(patch, /serverName: dev_flow/)
  assert.match(patch, /transport: stdio/)
  assert.match(patch, /failOnStartupError: false/)
  assert.match(patch, /enabled: false/)
  assert.match(patch, /ctx\.devFlowRuntime\.command/)
  assert.match(patch, /ctx\.devFlowRuntime\.args/)

  for (const forbidden of ['streamable-http', 'http://', 'https://', 'proxy', 'listener', 'telemetry']) {
    assert.equal(patch.includes(forbidden), false, `patch must not contain ${forbidden}`)
  }
})

test('source tree contains one Skill and no proxy, hook, credential, or generated artifact', async () => {
  const files = await walk(packageRoot)
  assert.deepEqual(files.filter(path => path.endsWith('/SKILL.md')), ['skills/dev-flow/SKILL.md'])
  assert.deepEqual(files.filter(path => /proxy/i.test(path)), [])
  assert.deepEqual(files.filter(path => /\.(?:tgz|db|sqlite|pem|key)$/i.test(path)), [])

  const allText = await Promise.all(
    files
      .filter(path => !path.startsWith('tests/') && /\.(?:json|md|mjs|yml)$/.test(path))
      .map(path => readFile(join(packageRoot, path), 'utf8')),
  )
  const joined = allText.join('\n')
  assert.doesNotMatch(joined, /(?:preinstall|postinstall|prepack|postpack|npm publish)/)
  for (const tool of rawToolNames) assert.match(joined, new RegExp(tool))
})

test('npm dry-pack is bounded to product files and never includes tests or fakes', () => {
  const packed = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: { ...process.env, npm_config_loglevel: 'silent' },
  })
  assert.equal(packed.status, 0, packed.stderr)
  const report = JSON.parse(packed.stdout)[0]
  const paths = report.files.map(file => file.path).sort()
  for (const required of [
    'README.md',
    'cordis.patch.yml',
    'package.json',
    'skills/dev-flow/SKILL.md',
    'src/index.mjs',
    'src/launch-core.mjs',
    'src/runtime.mjs',
  ]) assert.ok(paths.includes(required), `dry-pack missing ${required}`)
  assert.equal(paths.some(path => path.startsWith('tests/')), false)
  assert.equal(paths.some(path => path.includes('fake-core')), false)
  assert.equal(paths.some(path => path.startsWith('specs/') || path.startsWith('scripts/')), false)
  assert.equal(paths.some(path => /(?:evidence|fixture|\.db$|\.sqlite$)/i.test(path)), false)
})

test('product composition owns no task data, repository cleanup, Codex resource, or remote path', async () => {
  const files = await walk(packageRoot)
  const productFiles = files.filter(path => !path.startsWith('tests/'))
  assert.deepEqual(productFiles.filter(path => path.startsWith('src/')), [
    'src/index.mjs',
    'src/launch-core.mjs',
    'src/runtime.mjs',
  ])
  assert.equal(productFiles.some(path => /(?:codex|profile|data|database|cleanup)/i.test(path)), false)

  const productText = (await Promise.all(productFiles
    .filter(path => /\.(?:json|md|mjs|yml)$/.test(path))
    .map(path => readFile(join(packageRoot, path), 'utf8')))).join('\n')
  for (const forbidden of [
    /node:http/,
    /node:https/,
    /node:net/,
    /streamable-http/,
    /fetch\(/,
    /createServer/,
    /git (?:clean|reset|checkout|stash|commit|push|tag)/,
    /rm -rf/,
  ]) assert.doesNotMatch(productText, forbidden)
})

test('bundle patch has exactly two product rows and no cleanup or second integration', async () => {
  const patch = await readFile(join(packageRoot, 'cordis.patch.yml'), 'utf8')
  assert.equal((patch.match(/^\s+- id:/gm) ?? []).length, 2)
  assert.equal((patch.match(/^\s*- insert:/gm) ?? []).length, 1)
  assert.equal((patch.match(/serverName:/g) ?? []).length, 1)
  assert.equal((patch.match(/transport:/g) ?? []).length, 1)
  for (const forbidden of ['codex', 'cleanup', 'remove', 'cache', 'database', 'data root']) {
    assert.equal(patch.toLowerCase().includes(forbidden), false)
  }
})
