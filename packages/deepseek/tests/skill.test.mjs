import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { RAW_CORE_TOOLS, apply } from '../src/index.mjs'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const skillPath = join(packageRoot, 'skills', 'dev-flow', 'SKILL.md')

function applyWithFakeContext() {
  const provided = new Map()
  let createProvider
  const ctx = {
    provide(name, value) {
      provided.set(name, value)
      return () => provided.delete(name)
    },
    skills: {
      registerProvider(create) {
        createProvider = create
        return () => {}
      },
    },
  }
  apply(ctx)
  return { provided, provider: createProvider({ signal: new AbortController().signal, invalidate() {} }) }
}

test('provider registers exactly one user-only bundled dev-flow Skill', async () => {
  const { provided, provider } = applyWithFakeContext()
  assert.equal(provider.name, 'dev-flow-deepseek')
  const candidates = await provider.list({ cwd: process.cwd(), signal: new AbortController().signal })
  assert.equal(candidates.length, 1)
  assert.deepEqual(candidates[0].invocation, { modelInvocable: false, userInvocable: true })
  assert.equal(candidates[0].name, 'dev-flow')
  const definition = await provider.get(candidates[0], { signal: new AbortController().signal })
  assert.equal(definition.name, 'dev-flow')
  assert.match(definition.content, /^---\n/)

  const runtime = provided.get('devFlowRuntime')
  assert.equal(runtime.command, process.execPath)
  assert.deepEqual(runtime.args.slice(1), [])
  assert.match(runtime.args[0], /src\/launch-core\.mjs$/)
})

test('Skill metadata requires explicit user invocation and rejects model invocation', async () => {
  const skill = await readFile(skillPath, 'utf8')
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/)?.[1]
  assert.ok(frontmatter)
  assert.deepEqual(
    frontmatter.split('\n').map(line => line.slice(0, line.indexOf(':'))),
    ['name', 'description', 'disable-model-invocation', 'user-invocable'],
  )
  assert.match(skill, /name: dev-flow/)
  assert.match(skill, /disable-model-invocation: true/)
  assert.match(skill, /user-invocable: true/)
  assert.match(skill, /exact token `\/dev-flow`/)
})

test('explicit admission rejects zero-intent and invalid repository scope before every Core call', async () => {
  const skill = await readFile(skillPath, 'utf8')
  const prose = skill.replace(/\s+/g, ' ')
  for (const phrase of [
    'substantive new requirement',
    'explicit resume request',
    'one current existing Git worktree',
    'exactly one repository',
    'ordinary request',
    'empty or conversational message',
    'non-Git',
    'multi-repository scope',
  ]) assert.ok(prose.includes(phrase), `Skill missing admission rule: ${phrase}`)
  assert.ok(skill.indexOf('Before calling Core') < skill.indexOf('dev_flow_server_info'))
})

test('public Harness names map one-to-one to the exact six raw tools', async () => {
  const skill = await readFile(skillPath, 'utf8')
  for (const rawName of RAW_CORE_TOOLS) {
    assert.match(skill, new RegExp(`mcp__dev_flow__${rawName}`))
  }
  assert.equal((skill.match(/mcp__dev_flow__/g) ?? []).length, RAW_CORE_TOOLS.length)
})

test('server-info handshake requires supported_hosts to contain the exact deepseek identity', async () => {
  const skill = await readFile(skillPath, 'utf8')
  const handshake = skill.slice(
    skill.indexOf('## Handshake and tool boundary'),
    skill.indexOf('Harness may expose'),
  ).replace(/\s+/g, ' ')
  assert.match(handshake, /`supported_hosts`[^.]*exact value `deepseek`/)
  assert.doesNotMatch(handshake, /`?host=deepseek`?/)
})

test('Skill requires server-info first, exact tools, complete authority, and read-before-retry', async () => {
  const skill = await readFile(skillPath, 'utf8')
  const serverInfo = skill.indexOf('dev_flow_server_info')
  const mutation = skill.indexOf('dev_flow_apply_action')
  assert.ok(serverInfo >= 0 && mutation > serverInfo)
  for (const tool of RAW_CORE_TOOLS) assert.match(skill, new RegExp(`\\b${tool}\\b`))
  for (const phrase of [
    'complete canonical JSON',
    'fresh Core result',
    'retain the original request and action values',
    'read back before any retry',
    'Core-owned outcome',
    'verification budget',
  ]) assert.ok(skill.includes(phrase), `Skill missing ${phrase}`)
  for (const label of [
    'automated',
    'manual',
    'simulated',
    'pre-release-native',
    'stable-native',
    'skipped',
    'unverified',
  ]) assert.match(skill, new RegExp(`\\b${label}\\b`), `Skill missing exact evidence label ${label}`)
})

test('Skill and provider contain no adapter-owned workflow or proxy implementation', async () => {
  const source = await readFile(join(packageRoot, 'src', 'index.mjs'), 'utf8')
  const skill = await readFile(skillPath, 'utf8')
  for (const forbidden of [
    /class .*Task/i,
    /transitionTable/i,
    /recoveryClassifier/i,
    /persist.*task/i,
    /projection proxy/i,
    /spawn\(/,
    /fetch\(/,
    /ctx\.tools/,
    /child_process/,
    /sh -c/,
    /bash -c/,
    /retry\s*\([^)]*dev_flow_apply_action/i,
    /promote.*(?:simulated|pre-release)/i,
  ]) {
    assert.doesNotMatch(source, forbidden)
    assert.doesNotMatch(skill, forbidden)
  }
})
