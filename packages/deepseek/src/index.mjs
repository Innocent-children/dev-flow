import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROVIDER_NAME = 'dev-flow-deepseek'
const SKILL_URL = new URL('../skills/dev-flow/SKILL.md', import.meta.url)
const SKILL_ROOT = dirname(fileURLToPath(SKILL_URL))
const LAUNCHER_PATH = fileURLToPath(new URL('./launch-core.mjs', import.meta.url))

export const RAW_CORE_TOOLS = Object.freeze([
  'dev_flow_server_info',
  'dev_flow_open_task',
  'dev_flow_get_task',
  'dev_flow_get_next_action',
  'dev_flow_apply_action',
  'dev_flow_cancel_task',
])

const INVOCATION = Object.freeze({ modelInvocable: false, userInvocable: true })
const DESCRIPTION = 'Govern one explicit repository task through the dev-flow Core Contract 0.1.'
const RESOURCE_BASE = Object.freeze({ kind: 'directory', path: SKILL_ROOT })
const CANDIDATE = Object.freeze({
  name: 'dev-flow',
  description: DESCRIPTION,
  invocation: INVOCATION,
  provider: PROVIDER_NAME,
  source: 'bundled',
  resourceBase: RESOURCE_BASE,
  rank: 600,
  locator: SKILL_URL,
})

function createProvider() {
  return {
    name: PROVIDER_NAME,
    list: () => Promise.resolve([CANDIDATE]),
    async get() {
      return {
        name: CANDIDATE.name,
        description: CANDIDATE.description,
        invocation: CANDIDATE.invocation,
        provider: CANDIDATE.provider,
        source: CANDIDATE.source,
        resourceBase: CANDIDATE.resourceBase,
        content: await readFile(SKILL_URL, 'utf8'),
      }
    },
  }
}

export const name = 'dev-flow-deepseek'
export const inject = ['skills']

export function apply(ctx) {
  ctx.provide('devFlowRuntime', Object.freeze({
    command: process.execPath,
    args: Object.freeze([LAUNCHER_PATH]),
  }))
  ctx.skills.registerProvider(() => createProvider())
}
