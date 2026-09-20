import { join } from "node:path";
import { execPortableCommand } from "../../command.mjs";

export async function stopStdioCores(runtimePaths, options = {}) {
  await inspectProcesses(runtimePaths, true, options);
}

export async function assertManagedCoresStopped(runtimePaths, options = {}) {
  await inspectProcesses(runtimePaths, false, options);
}

async function inspectProcesses(runtimePaths, stop, { environment = process.env, run = execPortableCommand } = {}) {
  if (runtimePaths.length === 0) return;
  const systemRoot = Object.entries(environment).find(([name]) => name.toUpperCase() === "SYSTEMROOT")?.[1];
  if (!systemRoot) throw new Error("SystemRoot is required to inspect managed Core processes");
  const powershell = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const literal = value => "'" + value.replaceAll("'", "''") + "'";
  await run(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", `
    $ErrorActionPreference = 'Stop'
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    $executables = @(${runtimePaths.map(literal).join(", ")})
    foreach ($row in (Get-CimInstance Win32_Process -Filter "Name='dev-flow.exe'")) {
      foreach ($expected in $executables) {
        if ($row.ExecutablePath -ine $expected) { continue }
        $image = [Regex]::Escape($expected)
        $arguments = ${stop ? "'mcp\\s+--stdio'" : "'(?:mcp\\s+--stdio|webui\\s+serve)'"}
        $command = '^(?:"' + $image + '"|' + $image + ')\\s+' + $arguments + '\\s*$'
        if ($row.CommandLine -notmatch $command) { continue }
        $ownedProcess = Get-Process -Id $row.ProcessId -ErrorAction SilentlyContinue
        if ($null -eq $ownedProcess) { continue }
        try {
          $null = $ownedProcess.Handle
          $difference = [Math]::Abs($ownedProcess.StartTime.ToUniversalTime().Ticks - $row.CreationDate.ToUniversalTime().Ticks)
          if ($ownedProcess.Path -ine $expected -or $difference -ge 10) { throw 'Managed Core process identity changed' }
          ${stop ? "$ownedProcess.Kill()\n          if (-not $ownedProcess.WaitForExit(5000)) { throw 'The managed STDIO Core did not exit' }" : "throw 'A managed Core is still running or reconnected; close its Host session before resetting'"}
        } finally { $ownedProcess.Dispose() }
      }
    }
  `], { env: environment, encoding: "utf8", timeout: 10000, windowsHide: true });
}
