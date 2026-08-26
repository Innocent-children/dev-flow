# Local Runtime Contract

## User commands

```text
dev-flow webui start [--no-open] [--plain|--json]
dev-flow webui open [--plain|--json]
dev-flow webui status [--plain|--json]
dev-flow webui stop [--plain|--json]
dev-flow webui reset [--confirm TOKEN] [--plain|--json]
```

No listen-address option is supported. Reset confirmation must use the token returned by the current reset plan.

## Internal Core subcommand

```text
dev-flow webui serve
```

`serve` is the child-process entrypoint used by the public Core lifecycle command and is not a separate Host contract. Reset
planning and confirmation are internal Core functions called directly by the public `reset` command; they are not CLI
subcommands.

## Start, open, status and stop

- Start uses the current `dev-flow` executable and shared data root, validates storage, starts a loopback listener, writes
  a mode-0600 runtime receipt and opens the browser unless `--no-open` is set.
- Repeated start and open validate PID/start identity and data-root digest, then use the live status response to decide whether
  the current process is compatible and reusable.
- A caller from another Host Adapter reuses that process when the data root matches and live status is compatible; otherwise
  it returns incompatible and does not start a second instance.
- Status returns ready, read_only, reset_required, incompatible or unavailable.
- Stop verifies PID and process start identity before graceful shutdown.

The runtime receipt contains PID, process start identity, data-root digest, loopback URL and creation time.

## Browser request protection

- The listener binds `tcp4 127.0.0.1` on an OS-assigned port and accepts only the exact listener Host.
- Mutation requests require the exact page Origin and an unguessable process-local session value.
- Page and asset responses load only embedded local resources.
- No remote setting, account, persistent browser credential or telemetry is exposed.

## Polling

- Task detail polls every 2 seconds; dashboard/list poll every 5 seconds.
- Revision change invalidates an open form and reloads the complete Task model.
- Poll failure marks the current page stale and disables mutation until a successful refresh.

## Reset

- Reset plan may inspect old data while normal startup is reset-required or unavailable.
- Confirmation uses one token bound to the exact database and sidecar identities shown by the plan.
- Confirm obtains exclusive access to the Task database before deletion. Failure to obtain it returns zero deletes; success
  deletes only those Task-data targets and creates/preflights empty storage.

## Packaging

Web assets remain embedded in the Core binary. Every maintained Host Adapter package that carries Core must include the
same WebUI command contract and compatible assets. One installed-package Journey covers every currently maintained Host
package and proves they open or reuse the same shared WebUI. Feature completion does not change versions or publish.
