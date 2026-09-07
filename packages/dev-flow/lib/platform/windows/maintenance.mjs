import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execPortableCommand } from "../../command.mjs";

// Resolve Windows filesystem aliases after the confirmed installation creates
// its directories. Read-only status and previews never call this function.
export async function prepareInstallation(paths) {
  await mkdir(paths.productRoot, { recursive: true });
  await mkdir(paths.managerRoot, { recursive: true });
  return true;
}

export async function runtimeForAction(action, paths, environment) {
  let packageRoot;
  if (action.host === "codex") {
    const result = await execPortableCommand("npm", ["root", "--global"], {env:environment,encoding:"utf8",windowsHide:true,timeout:10000});
    packageRoot = join(result.stdout.trim(), "dev-flow-codex");
  } else {
    packageRoot = join(resolve(environment.DSH_HOME || join(paths.homeDirectory, ".dsh")), "profiles", action.profile, "node_modules", "dev-flow-deepseek");
  }
  const runtimePath = join(packageRoot, "runtime", "win32-x64", "dev-flow.exe");
  try { await lstat(runtimePath); }
  catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
  return {host:action.host,profile:action.profile ?? null,runtimePath};
}

// Windows cannot replace a running executable. Stop only the WebUI process
// whose image belongs to the exact Adapter being maintained.
export async function prepareReplacement({ runtime, paths, environment }) {
  const dataDirectory = paths.explicitDataDirectory ?? paths.defaultDataDirectory;
  try { await lstat(dataDirectory); await lstat(runtime.runtimePath); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  const executable = await realpath(runtime.runtimePath);
  const packageRoot = dirname(dirname(dirname(executable)));
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  if (manifest.name !== `dev-flow-${runtime.host}` || executable !== join(packageRoot, "runtime", "win32-x64", "dev-flow.exe")) {
    throw new Error("maintained Core must belong to its Adapter package");
  }
  const options = { env: { ...environment, DEV_FLOW_DATA_DIR: dataDirectory }, encoding: "utf8", timeout: 10000, windowsHide: true };
  const powershell = join(environment.SystemRoot ?? environment.SYSTEMROOT ?? process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const literal = value => "'" + value.replaceAll("'", "''") + "'";
  // A running STDIO server also keeps the package directory open on Windows.
  // Bind the process handle to the observed image and creation time before stop.
  await execPortableCommand(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", `
    $ErrorActionPreference = 'Stop'
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    $expected = ${literal(executable)}
    foreach ($row in (Get-CimInstance Win32_Process -Filter "Name='dev-flow.exe'")) {
      if ($row.ExecutablePath -ine $expected -or $row.CommandLine -notmatch '\\smcp\\s+--stdio(?:\\s|$)') { continue }
      $ownedProcess = Get-Process -Id $row.ProcessId -ErrorAction SilentlyContinue
      if ($null -eq $ownedProcess) { continue }
      try {
        $null = $ownedProcess.Handle
        $difference = [Math]::Abs($ownedProcess.StartTime.ToUniversalTime().Ticks - $row.CreationDate.ToUniversalTime().Ticks)
        if ($ownedProcess.Path -ieq $expected -and $difference -lt 10) {
          $ownedProcess.Kill()
          if (-not $ownedProcess.WaitForExit(5000)) { throw 'The owned Core did not exit' }
        }
      } finally { $ownedProcess.Dispose() }
    }
  `], options);
  const state = JSON.parse((await execPortableCommand(executable, ["webui", "status", "--json"], options)).stdout);
  if (!Number.isInteger(state.pid) || state.pid <= 0) return;
  const image = (await execPortableCommand(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
    `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); (Get-Process -Id ${state.pid} -ErrorAction SilentlyContinue).Path`,
  ], options)).stdout.trim();
  if (!image || resolve(image).toLowerCase() !== resolve(executable).toLowerCase()) return;
  if (state.readiness !== "ready") throw new Error("the maintained WebUI cannot be stopped safely");
  const stopped = JSON.parse((await execPortableCommand(executable, ["webui", "stop", "--json"], options)).stdout);
  if (stopped.readiness !== "unavailable") throw new Error("the maintained WebUI did not stop");
}
