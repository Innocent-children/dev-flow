#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

const STAGES = Object.freeze(['explicit-invocation', 'done', 'remove'])
const PRODUCT = 'dev-flow-deepseek'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function gitRead(repository, args) {
  const result = spawnSync('git', args, {
    cwd: repository,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) throw new Error('fake journey could not fingerprint the repository')
  return result.stdout
}

function repositoryFingerprint(repository) {
  const hash = createHash('sha256')
  hash.update('head\0').update(gitRead(repository, ['rev-parse', 'HEAD']))
  hash.update('tracked-diff\0').update(gitRead(repository, ['diff', '--no-ext-diff', '--binary', 'HEAD', '--']))
  const untracked = gitRead(repository, ['ls-files', '-z', '--others', '--exclude-standard'])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort()
  for (const relative of untracked) {
    const absolute = resolve(repository, relative)
    if (absolute !== repository && !absolute.startsWith(`${repository}${sep}`)) {
      throw new Error('fake journey received an out-of-repository Git path')
    }
    const metadata = lstatSync(absolute)
    hash.update('untracked\0').update(relative).update('\0')
    if (metadata.isSymbolicLink()) hash.update('symlink\0').update(readlinkSync(absolute))
    else if (metadata.isFile()) hash.update('file\0').update(readFileSync(absolute))
    else hash.update('other\0')
  }
  return hash.digest('hex')
}

function parseStage(argv) {
  const throughIndex = argv.indexOf('--through')
  if (!argv.includes('--fake-host') || throughIndex < 0 || argv[throughIndex + 1] === undefined) {
    throw new Error('fake journey requires --fake-host --through <stage>')
  }
  const stage = argv[throughIndex + 1]
  if (!STAGES.includes(stage)) throw new Error(`unknown fake journey stage: ${stage}`)
  return stage
}

function installedManifest() {
  return {
    private: true,
    dependencies: { [PRODUCT]: 'file:/fixture/dev-flow-deepseek.tgz' },
    dsh: { profile: { bundles: [PRODUCT] } },
  }
}

async function restartAndRead(profileManifestPath) {
  return JSON.parse(await readFile(profileManifestPath, 'utf8'))
}

async function run(stage) {
  if (process.env.DEV_FLOW_TEST_DSH_TRIPWIRE !== '1') {
    throw new Error('fake-host tripwire must be armed')
  }

  const repository = resolve(process.cwd())
  const repositoryBefore = repositoryFingerprint(repository)
  const root = await mkdtemp(join(tmpdir(), 'dev-flow-deepseek-fake-profile-'))
  const profileRoot = join(root, 'profile')
  const dataRoot = join(root, 'data')
  await mkdir(profileRoot, { mode: 0o700 })
  await mkdir(dataRoot, { mode: 0o700 })
  const profileManifestPath = join(profileRoot, 'package.json')
  const taskPath = join(dataRoot, 'core-task.json')
  const task = {
    id: 'task-deepseek-fixture',
    revision: 1,
    actions: [],
    read_before_retry: false,
    outcome: 'OPEN',
  }

  try {
    await writeFile(profileManifestPath, `${JSON.stringify(installedManifest(), null, 2)}\n`)
    const installed = await restartAndRead(profileManifestPath)
    if (installed.dsh.profile.bundles.filter(value => value === PRODUCT).length !== 1) {
      throw new Error('fake profile did not resolve exactly one product bundle')
    }

    const ordinaryPromptCalls = 0
    const invalidInvocationCalls = 0
    const startupFailure = {
      fatal_to_host: false,
      tools_registered: 0,
      diagnostic_channel: 'stderr',
    }

    if (stage === 'done' || stage === 'remove') {
      task.actions.push({ id: 'action-one', request_id: 'request-one', revision: 2 })
      task.revision = 2
      task.read_before_retry = true
      await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`, { mode: 0o600 })
      const resumedAfterRestart = JSON.parse(await readFile(taskPath, 'utf8'))
      if (resumedAfterRestart.id !== task.id || resumedAfterRestart.revision !== 2) {
        throw new Error('fake restart did not resume the same Core task identity')
      }
      task.actions.push({ id: 'action-two', request_id: 'request-two', revision: 3 })
      task.revision = 3
      task.outcome = 'DONE'
      task.restart_resume = true
    }
    await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`, { mode: 0o600 })
    const dataBefore = sha256(await readFile(taskPath))

    let dataAfter = dataBefore
    let reinstallResumeSucceeded = false
    let removal = null
    if (stage === 'remove') {
      const removed = { private: true, dependencies: {}, dsh: { profile: { bundles: [] } } }
      await writeFile(profileManifestPath, `${JSON.stringify(removed, null, 2)}\n`)
      const firstReadback = process.env.DEV_FLOW_TEST_STALE_PROFILE === '1'
        ? installedManifest()
        : await restartAndRead(profileManifestPath)
      if (firstReadback.dsh.profile.bundles.length !== 0) {
        throw new Error('stale profile metadata remained after supported restart')
      }
      await writeFile(profileManifestPath, `${JSON.stringify(removed, null, 2)}\n`)
      const repeatedReadback = await restartAndRead(profileManifestPath)
      dataAfter = sha256(await readFile(taskPath))

      await writeFile(profileManifestPath, `${JSON.stringify(installedManifest(), null, 2)}\n`)
      const reinstalled = await restartAndRead(profileManifestPath)
      const resumed = JSON.parse(await readFile(taskPath, 'utf8'))
      reinstallResumeSucceeded = reinstalled.dsh.profile.bundles.includes(PRODUCT)
        && resumed.id === task.id
        && resumed.outcome === 'DONE'
      removal = {
        dependency_absent: Object.keys(firstReadback.dependencies).length === 0,
        bundle_absent: firstReadback.dsh.profile.bundles.length === 0,
        repeated_remove_absent: repeatedReadback.dsh.profile.bundles.length === 0,
        stale_metadata: false,
      }
    }

    const repositoryAfter = repositoryFingerprint(repository)
    return {
      schema_version: 1,
      through_stage: stage,
      classification: 'simulated',
      support_claim: false,
      real_harness_started: false,
      native_evidence_written: false,
      proxy_presence: 'none',
      harness: {
        channel: 'fixture',
        version: 'not-started',
        integrity: 'not-applicable',
      },
      profile: {
        isolated: true,
        data_root_separate: true,
        restart_readback: true,
        skill_count: 1,
        integration_count: 1,
        raw_tool_count: 6,
      },
      admission: {
        exact_token: '/dev-flow',
        ordinary_prompt_core_calls: ordinaryPromptCalls,
        invalid_invocation_core_calls: invalidInvocationCalls,
      },
      startup_failure: startupFailure,
      task: {
        id: task.id,
        revision: task.revision,
        action_commits: task.actions.length,
        read_before_retry: task.read_before_retry,
        restart_resume: task.restart_resume === true,
        outcome: task.outcome,
      },
      verification: { used: task.actions.length, limit: 3 },
      data: { before_sha256: dataBefore, after_sha256: dataAfter, removal_owned: false },
      repository: { before_sha256: repositoryBefore, after_sha256: repositoryAfter },
      removal,
      reinstall: { resume_succeeded: reinstallResumeSucceeded },
      codex: {
        classification: 'comparison-logic-only',
        native_comparison_performed: false,
        before_sha256: sha256('codex-comparison-fixture'),
        after_sha256: sha256('codex-comparison-fixture'),
      },
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

try {
  const stage = parseStage(process.argv.slice(2))
  process.stdout.write(`${JSON.stringify(await run(stage))}\n`)
} catch (error) {
  process.stderr.write(`dev-flow-deepseek fake journey: ${error.message}\n`)
  process.exitCode = 1
}
