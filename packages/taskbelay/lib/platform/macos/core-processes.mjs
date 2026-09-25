import { execPortableCommand } from "../../command.mjs";

export async function stopStdioCores(runtimePaths, options = {}) {
  const signal = options.signal ?? ((pid) => process.kill(pid, "SIGTERM"));
  const wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const now = options.now ?? Date.now;
  for (const observed of await managedProcesses(runtimePaths, options)) {
    if (observed.operation !== "mcp --stdio") continue;
    const current = await inspectProcess(observed.pid, options);
    if (!current) continue;
    assertSameProcess(observed, current);
    try { signal(observed.pid); }
    catch (error) { if (error.code !== "ESRCH") throw error; }
    const deadline = now() + 5000;
    for (;;) {
      const remaining = await inspectProcess(observed.pid, options);
      if (!remaining) break;
      assertSameProcess(observed, remaining);
      if (now() >= deadline) throw new Error("The managed STDIO Core did not exit; close its Host session before resetting");
      await wait(50);
    }
  }
}

export async function assertManagedCoresStopped(runtimePaths, options = {}) {
  if ((await managedProcesses(runtimePaths, options)).length) {
    throw new Error("A managed Core is still running or reconnected; close its Host session before resetting");
  }
}

async function managedProcesses(runtimePaths, options) {
  if (runtimePaths.length === 0) return [];
  const expected = new Set(runtimePaths);
  const output = await ps(["-axo", "pid=,comm="], options);
  const processes = [];
  for (const line of output.split("\n")) {
    const match = /^\s*(\d+)\s+(.+?)\s*$/u.exec(line);
    if (!match || !expected.has(match[2])) continue;
    const current = await inspectProcess(Number(match[1]), options);
    if (!current) continue;
    if (current.image !== match[2]) throw new Error("Managed Core process identity changed");
    for (const operation of ["mcp --stdio", "webui serve"]) {
      if (current.command === `${current.image} ${operation}` || current.command === `"${current.image}" ${operation}`) {
        processes.push({ ...current, operation });
      }
    }
  }
  return processes;
}

async function inspectProcess(pid, options) {
  try {
    const start = (await ps(["-p", String(pid), "-o", "lstart="], options)).trim();
    const image = (await ps(["-p", String(pid), "-o", "comm="], options)).trim();
    const command = (await ps(["-p", String(pid), "-o", "args="], options)).trim();
    if (!start || !image || !command) throw new Error("Managed Core process identity is unavailable");
    return { pid, start, image, command };
  } catch (error) {
    if (error.code === 1 && !String(error.stdout ?? "").trim()) return null;
    throw error;
  }
}

function assertSameProcess(expected, actual) {
  if (["pid", "start", "image", "command"].some(key => expected[key] !== actual[key])) throw new Error("Managed Core process identity changed");
}

async function ps(args, { run = execPortableCommand, environment = process.env } = {}) {
  return (await run("/bin/ps", ["-ww", ...args], {
    env: { ...environment, LC_ALL: "C" }, encoding: "utf8", timeout: 10000, maxBuffer: 4 * 1024 * 1024,
  })).stdout;
}
