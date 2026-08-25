# Data Model: Unified Adapter Lifecycle Manager

## Persistence Disposition

Core and Task persistence disposition is `not-applicable`. This Feature creates manager-owned JSON records outside
Core storage and defines an explicit user-triggered factory-reset operation over current product data.

## Closed Enums

### Operation

```text
status
doctor
install
upgrade
repair
reinstall
uninstall
factory-reset
```

### Host

```text
codex
deepseek
all
```

### Target status

```text
absent
partial
ready
restart_required
incompatible
conflicted
unknown
```

### Confirmation class

```text
none
mutation
downgrade
reset
permanent_reset
adopt_profile
```

### Action status

```text
pending
completed
skipped
failed
```

## LifecycleRequest

| Field | Type | Rule |
| --- | --- | --- |
| `operation` | Operation | required |
| `host` | Host | mutation operations require explicit value in non-TTY mode |
| `profiles` | string[] | normalized, unique, safe names; default `web` for DeepSeek |
| `target_version` | `latest` or semver | applies to install/upgrade/repair/reinstall |
| `preserve_data` | boolean | true except factory reset |
| `reinstall_after_reset` | boolean | factory reset only |
| `permanent` | boolean | factory reset only |
| `output_mode` | `rich|plain|json` | derived from flags and terminal |
| `yes` | boolean | ordinary mutation confirmation only |
| `confirmation_token` | string or null | required for destructive operations |

The normalized request is immutable for one run. User input is never interpolated into a shell string.

## ObservedState

| Field | Type | Meaning |
| --- | --- | --- |
| `platform` | object | OS, architecture and Node.js facts |
| `codex` | HostState | executable, package, Core, receipt and registration readback |
| `deepseek` | HostState[] | explicit or manager-owned Profile state |
| `configuration` | ResourceState | exact `$HOME/.dev-flow/config.json` state |
| `default_data` | ResourceState | exact current default data directory state |
| `explicit_data` | ResourceState or null | only current explicitly supplied canonical directory |
| `manager_receipts` | receipt identity[] | validated closed manager-owned Profiles |
| `pending_run` | run identity or null | one compatible incomplete operation |

HostState facts are observations and never become Host authority. A later execute step re-observes before mutation.

## LifecyclePlan

| Field | Type | Rule |
| --- | --- | --- |
| `plan_id` | string | random opaque identity |
| `request` | LifecycleRequest | exact normalized request |
| `observed_digest` | SHA-256 | stable digest of cleanup/Host target identities |
| `actions` | PlannedAction[] | ordered closed action list |
| `impacts` | Impact[] | exact persistent resources and preservation facts |
| `restart_requirements` | string[] | bounded Host/Profile hints |
| `confirmation_class` | enum | strongest required confirmation |
| `confirmation_token_digest` | SHA-256 or null | no plaintext token persisted |
| `created_at` | RFC3339 | plan issuance |

A confirmed plan cannot acquire a new target during execution. Changed observed identity invalidates the plan.

## PlannedAction

| Field | Type | Rule |
| --- | --- | --- |
| `action_id` | closed string ID | unique within plan |
| `host` | `codex|deepseek|manager` | action owner |
| `profile` | string or null | DeepSeek only |
| `kind` | closed action kind | contract-defined executable behavior |
| `target_identity` | object | version/path/receipt facts needed for ownership |
| `persistent` | boolean | whether action crosses a mutation boundary |
| `status` | Action status | run projection |

## LifecycleRun

| Field | Type | Rule |
| --- | --- | --- |
| `operation_id` | string | opaque stable identity |
| `plan_id` | string | exact plan |
| `plan_digest` | SHA-256 | detects edited/stale plan |
| `completed_action_ids` | string[] | ordered exact subset |
| `failed_action_id` | string or null | current failure boundary |
| `temporary_roots` | canonical path[] | created by this run and cleanup-owned |
| `trash_root` | canonical path or null | unique recoverable reset target |
| `next_step` | closed string | one resume, repair or manual handoff action |
| `updated_at` | RFC3339 | atomic record update |

The run is evidence of attempted external effects. Resume always re-observes Host and resource state before using it.

## DeepSeekProfileReceipt

| Field | Type | Rule |
| --- | --- | --- |
| `profile` | string | exact safe Profile name |
| `package_name` | const `dev-flow-deepseek` | closed identity |
| `installed_version` | semver | last verified manager action |
| `adoption` | `installed|adopted` | receipt origin |
| `dsh_version` | semver-like string | last verified Host version |
| `created_at` | RFC3339 | first ownership record |
| `updated_at` | RFC3339 | last verified write |

Receipt ownership is valid only with a matching current DSH dump-config readback. It never enumerates Profiles.

## ResourceState and Cleanup Invariants

- Paths are absolute, normalized, canonical and non-symlink at observation and immediately before mutation.
- Default resources equal fixed paths derived from canonical HOME.
- Explicit data is accepted only from the current environment/request and is never discovered by filesystem scan.
- A cleanup target must appear in the confirmed plan and match its observed identity.
- Shared data requires all observed Adapter users in the same plan.
- `$HOME`, `$HOME/.codex`, `$HOME/.dsh`, npm cache, repository roots and path ancestors are never cleanup targets.
- An unknown file beside a known target is preserved; empty parent removal is allowed only after exact child cleanup.

## Lifecycle

1. Parse request.
2. Observe fixed and explicitly declared resources.
3. Create immutable plan and confirmation requirement.
4. Confirm or exit with zero mutation.
5. Write run atomically before the first persistent action.
6. Before each action, revalidate target identity and journal predecessor.
7. Execute one argument-array Host/filesystem action.
8. Re-observe and atomically record completion or failure.
9. Verify final desired state.
10. Retain bounded recovery evidence on failure; remove or archive completed run evidence according to ownership policy.
