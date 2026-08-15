import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import {
  PACKAGE_ROOT,
  createCoreEnvironment,
  resolveCorePath,
  resolveDataRoot,
  resolveWorkingDirectory,
} from './runtime.mjs'

const MAX_DIAGNOSTIC_BYTES = 2048
const TERMINATION_GRACE_MS = 250
const FORWARDABLE_SIGNALS = new Set(['SIGINT', 'SIGTERM'])

function writeDiagnostic(stream, message) {
  const prefix = 'dev-flow-deepseek: Core diagnostic: '
  const available = Math.max(0, MAX_DIAGNOSTIC_BYTES - Buffer.byteLength(prefix) - 1)
  const bounded = Buffer.from(String(message)).subarray(0, available).toString()
  stream.write(`${prefix}${bounded}\n`)
}

function fixedFailure(error) {
  const code = typeof error?.code === 'string' ? error.code : 'CORE_LAUNCH_FAILED'
  return Object.assign(new Error(`dev-flow-deepseek could not run the packaged Core (${code})`, { cause: error }), { code })
}

function forwardedSignal(abortSignal) {
  return FORWARDABLE_SIGNALS.has(abortSignal?.reason) ? abortSignal.reason : 'SIGTERM'
}

export async function launchCore({
  packageRoot = PACKAGE_ROOT,
  platform = process.platform,
  arch = process.arch,
  cwd = process.cwd(),
  env = process.env,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  signal,
} = {}) {
  let executable
  let dataRoot
  let workingDirectory
  try {
    executable = await resolveCorePath({ packageRoot, platform, arch })
    workingDirectory = await resolveWorkingDirectory(cwd, platform)
    dataRoot = await resolveDataRoot({ env, platform, worktreeRoot: workingDirectory })
  } catch (error) {
    writeDiagnostic(stderr, typeof error?.code === 'string' ? error.code : 'configuration unavailable')
    throw fixedFailure(error)
  }

  const childEnvironment = createCoreEnvironment(env, dataRoot)

  return new Promise((resolve, reject) => {
    let settled = false
    let cancelled = false
    let terminationTimer
    let stderrBytes = 0
    let sawStderr = false
    const child = spawn(executable, ['mcp', '--stdio'], {
      cwd: workingDirectory,
      env: childEnvironment,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    const abort = () => {
      cancelled = true
      child.kill(forwardedSignal(signal))
      if (terminationTimer === undefined) {
        terminationTimer = setTimeout(() => {
          if (!settled) child.kill('SIGKILL')
        }, TERMINATION_GRACE_MS)
      }
    }
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })

    stdin.pipe(child.stdin)
    child.stdout.pipe(stdout, { end: false })
    child.stderr.on('data', chunk => {
      sawStderr = true
      stderrBytes = Math.min(Number.MAX_SAFE_INTEGER, stderrBytes + Buffer.byteLength(chunk))
    })

    const finish = (error, code) => {
      if (settled) return
      settled = true
      if (terminationTimer !== undefined) clearTimeout(terminationTimer)
      signal?.removeEventListener('abort', abort)
      if (sawStderr) writeDiagnostic(stderr, `stderr output received (${stderrBytes} bytes; content withheld)`)
      if (error !== undefined) {
        writeDiagnostic(stderr, typeof error?.code === 'string' ? error.code : 'child process error')
        reject(fixedFailure(error))
        return
      }
      if (cancelled) {
        const cancellation = Object.assign(new Error('packaged Core launch was cancelled'), { code: 'CORE_CANCELLED' })
        writeDiagnostic(stderr, 'Core launch cancelled')
        reject(fixedFailure(cancellation))
        return
      }
      if (code !== 0) {
        const exitError = Object.assign(new Error(`packaged Core exited with status ${code}`), { code: 'CORE_EXITED' })
        writeDiagnostic(stderr, `Core exited with status ${code}`)
        reject(fixedFailure(exitError))
        return
      }
      resolve(0)
    }

    child.once('error', error => finish(error))
    child.stdin.on('error', error => {
      if (error?.code !== 'EPIPE') finish(error)
    })
    child.once('close', code => finish(undefined, code))
  })
}

async function main() {
  const controller = new AbortController()
  const abortFromSIGINT = () => controller.abort('SIGINT')
  const abortFromSIGTERM = () => controller.abort('SIGTERM')
  process.once('SIGINT', abortFromSIGINT)
  process.once('SIGTERM', abortFromSIGTERM)
  try {
    await launchCore({ signal: controller.signal })
  } catch {
    process.exitCode = 1
  } finally {
    process.removeListener('SIGINT', abortFromSIGINT)
    process.removeListener('SIGTERM', abortFromSIGTERM)
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
