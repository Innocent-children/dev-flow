import { constants } from 'node:fs'
import { access, chmod, lstat, mkdir, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ALLOWED_CORE_ENVIRONMENT = Object.freeze([
  'DEV_FLOW_DATA_DIR',
  'HOME',
  'PATH',
  'LANG',
  'LC_ALL',
  'TMPDIR',
])

export const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function runtimeError(code, message, cause) {
  return Object.assign(new Error(message, cause === undefined ? undefined : { cause }), { code })
}

function requireDarwinArm64(platform, arch) {
  if (platform !== 'darwin' || arch !== 'arm64') {
    throw runtimeError(
      'UNSUPPORTED_PLATFORM',
      `dev-flow-deepseek supports only darwin/arm64; received ${platform}/${arch}`,
    )
  }
}

function isWithin(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`)
}

export async function resolveCorePath({
  packageRoot = PACKAGE_ROOT,
  platform = process.platform,
  arch = process.arch,
} = {}) {
  requireDarwinArm64(platform, arch)
  try {
    const canonicalPackageRoot = await realpath(packageRoot)
    const candidate = join(canonicalPackageRoot, 'runtime', 'darwin-arm64', 'dev-flow')
    const metadata = await lstat(candidate)
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw runtimeError('INVALID_CORE_RUNTIME', 'packaged Core must be a regular non-symlink file')
    }
    await access(candidate, constants.R_OK | constants.X_OK)
    const canonical = await realpath(candidate)
    if (!isWithin(canonicalPackageRoot, canonical)) {
      throw runtimeError('INVALID_CORE_RUNTIME', 'packaged Core resolves outside the product package')
    }
    return canonical
  } catch (error) {
    if (error?.code === 'INVALID_CORE_RUNTIME') throw error
    throw runtimeError('CORE_RUNTIME_UNAVAILABLE', 'packaged Core is missing or not executable', error)
  }
}

export function defaultDataRoot(home, platform = process.platform) {
  if (platform !== 'darwin') {
    throw runtimeError('UNSUPPORTED_PLATFORM', `default data root is defined only for darwin; received ${platform}`)
  }
  if (typeof home !== 'string' || home.length === 0 || !isAbsolute(home)) {
    throw runtimeError('INVALID_DATA_ROOT', 'HOME must be an absolute path when DEV_FLOW_DATA_DIR is unset')
  }
  return join(home, 'Library', 'Application Support', 'dev-flow', 'data')
}

async function verifyExistingDataRoot(candidate) {
  try {
    const metadata = await lstat(candidate)
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw runtimeError('INVALID_DATA_ROOT', 'data root must be a real directory, not a symbolic link')
    }
    await access(candidate, constants.R_OK | constants.W_OK | constants.X_OK)
    return await realpath(candidate)
  } catch (error) {
    if (error?.code === 'INVALID_DATA_ROOT') throw error
    throw runtimeError('INVALID_DATA_ROOT', 'data root must exist and be readable, writable, and searchable', error)
  }
}

function isDarwinSystemAlias(candidate, canonical, platform) {
  if (platform !== 'darwin') return false
  if (!/^\/(?:var|tmp|etc)(?:\/|$)/.test(candidate)) return false
  return canonical === `/private${candidate}`
}

function rootsOverlap(left, right) {
  return isWithin(left, right) || isWithin(right, left)
}

export async function resolveWorkingDirectory(cwd, platform = process.platform) {
  if (typeof cwd !== 'string' || cwd.length === 0 || !isAbsolute(cwd) || normalize(cwd) !== cwd) {
    throw runtimeError('INVALID_WORKING_DIRECTORY', 'Core working directory must be an absolute canonical path')
  }
  try {
    const metadata = await lstat(cwd)
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw runtimeError('INVALID_WORKING_DIRECTORY', 'Core working directory must be a real directory')
    }
    const canonical = await realpath(cwd)
    if (canonical !== cwd && !isDarwinSystemAlias(cwd, canonical, platform)) {
      throw runtimeError('INVALID_WORKING_DIRECTORY', 'Core working directory must not traverse symbolic links')
    }
    const gitMetadata = await lstat(join(canonical, '.git'))
    if (gitMetadata.isSymbolicLink() || (!gitMetadata.isDirectory() && !gitMetadata.isFile())) {
      throw runtimeError('INVALID_WORKING_DIRECTORY', 'Core working directory must be one Git worktree root')
    }
    return canonical
  } catch (error) {
    if (error?.code === 'INVALID_WORKING_DIRECTORY') throw error
    throw runtimeError('INVALID_WORKING_DIRECTORY', 'Core working directory must be an existing Git worktree root', error)
  }
}

function ensureDataRootSeparation(dataRoot, worktreeRoot) {
  if (rootsOverlap(dataRoot, worktreeRoot)) {
    throw runtimeError('INVALID_DATA_ROOT', 'data root and target Git worktree must be disjoint')
  }
}

async function defaultCandidate(home, platform) {
  const rawCandidate = defaultDataRoot(home, platform)
  try {
    const homeMetadata = await lstat(home)
    if (!homeMetadata.isDirectory() || homeMetadata.isSymbolicLink()) {
      throw runtimeError('INVALID_DATA_ROOT', 'HOME must be a real directory for the default data root')
    }
    const canonicalHome = await realpath(home)
    if (canonicalHome !== home && !isDarwinSystemAlias(home, canonicalHome, platform)) {
      throw runtimeError('INVALID_DATA_ROOT', 'HOME must not traverse symbolic-link ancestors')
    }
    let current = canonicalHome
    for (const segment of ['Library', 'Application Support', 'dev-flow', 'data']) {
      current = join(current, segment)
      try {
        const metadata = await lstat(current)
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
          throw runtimeError('INVALID_DATA_ROOT', 'default data root must not traverse symbolic-link ancestors')
        }
      } catch (error) {
        if (error?.code === 'ENOENT') break
        throw error
      }
    }
    return defaultDataRoot(canonicalHome, platform)
  } catch (error) {
    if (error?.code === 'INVALID_DATA_ROOT') throw error
    throw runtimeError('INVALID_DATA_ROOT', `default data root is unsafe: ${rawCandidate}`, error)
  }
}

export async function resolveDataRoot({
  env = process.env,
  platform = process.platform,
  worktreeRoot,
} = {}) {
  const canonicalWorktree = await resolveWorkingDirectory(worktreeRoot, platform)
  const explicit = env.DEV_FLOW_DATA_DIR
  if (explicit !== undefined && explicit !== '') {
    if (!isAbsolute(explicit) || normalize(explicit) !== explicit) {
      throw runtimeError('INVALID_DATA_ROOT', 'DEV_FLOW_DATA_DIR must be an absolute canonical path')
    }
    const canonical = await verifyExistingDataRoot(explicit)
    if (canonical !== explicit && !isDarwinSystemAlias(explicit, canonical, platform)) {
      throw runtimeError('INVALID_DATA_ROOT', 'DEV_FLOW_DATA_DIR must not traverse symbolic-link ancestors')
    }
    ensureDataRootSeparation(canonical, canonicalWorktree)
    return canonical
  }

  const candidate = await defaultCandidate(env.HOME, platform)
  ensureDataRootSeparation(candidate, canonicalWorktree)
  try {
    await mkdir(candidate, { recursive: true, mode: 0o700 })
  } catch (error) {
    throw runtimeError('INVALID_DATA_ROOT', 'default data root could not be created privately', error)
  }
  const canonical = await verifyExistingDataRoot(candidate)
  ensureDataRootSeparation(canonical, canonicalWorktree)
  try {
    await chmod(canonical, 0o700)
  } catch (error) {
    throw runtimeError('INVALID_DATA_ROOT', 'default data root could not be made private', error)
  }
  return canonical
}

export function createCoreEnvironment(source = process.env, canonicalDataRoot) {
  if (typeof canonicalDataRoot !== 'string' || !isAbsolute(canonicalDataRoot)) {
    throw runtimeError('INVALID_DATA_ROOT', 'canonical data root is required')
  }
  const environment = { DEV_FLOW_DATA_DIR: canonicalDataRoot }
  for (const key of ALLOWED_CORE_ENVIRONMENT) {
    if (key === 'DEV_FLOW_DATA_DIR') continue
    const value = source[key]
    if (typeof value === 'string') environment[key] = value
  }
  return environment
}
