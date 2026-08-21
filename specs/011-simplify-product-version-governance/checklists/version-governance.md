# Requirements Quality Checklist: Product Version Governance

**Purpose**: Review whether Feature 011 fully and unambiguously governs independent product versions,
current-only compatibility, persistence safety, and Codex release recovery before implementation.

**Created**: 2026-08-21

**Feature**: [`spec.md`](../spec.md)

**Review Ownership**: Reviewer-owned. `$speckit-implement` MUST NOT change these markers.

**Marker Semantics**: `[x]` means the requirement-quality criterion was reviewed and satisfied. It
does not mean code exists or a test passed.

## Authority and Product Scope

- [x] CHK001 Are exactly three product authorities named with no fourth repository authority or
  duplicate embedded-Core field? [Completeness, Spec FR-001–FR-006]
- [x] CHK002 Is independent SemVer validity distinguished from cross-product equality in every
  acceptance path? [Clarity, Spec FR-007–FR-008, SC-001–SC-002]
- [x] CHK003 Is the Codex plugin clearly a mirror of Codex rather than an authority? [Consistency,
  Spec FR-005, SC-003]
- [x] CHK004 Are Core source reads, executable identity, fixtures, and build injection all tied to
  `CORE_VERSION`? [Completeness, Spec FR-009–FR-013, SC-004]
- [x] CHK005 Are current `0.5.0` values and differing-version fixtures both explicitly required so
  implementation cannot mistake coincidence for equality? [Clarity, Spec FR-008, FR-051, SC-016]

## Host Runtime Compatibility

- [x] CHK006 Does Codex require separate package/Core reporting while removing equality gates from
  setup, receipt, upgrade, remove, and launcher behavior? [Coverage, Spec US2, FR-015–FR-018]
- [x] CHK007 Does DeepSeek derive Core identity from the executable rather than its package manifest?
  [Clarity, Spec FR-021–FR-024]
- [x] CHK008 Are the concrete capability observations required after numeric compatibility fields
  disappear? [Completeness, Spec FR-018, FR-023, FR-029]
- [x] CHK009 Are wrong-product, malformed, missing, non-executable, catalog-incompatible, and schema-
  incompatible Core failures covered before task mutation? [Coverage, Spec US2/AC4, Edge Cases]
- [x] CHK010 Is any need for a second Core identity field or compatibility registry explicitly
  excluded? [Scope, Spec FR-014, Non-Goals]

## Internal Identity and Persistence

- [x] CHK011 Are all current artificial version families enumerated, including envelopes, process,
  storage, payload contracts, digest domains, receipts, build reports, and release records?
  [Completeness, Spec FR-026, FR-054–FR-055]
- [x] CHK012 Are replacement names such as revision, generation, API level, or compatibility version
  prohibited rather than merely discouraged? [Clarity, Spec FR-027]
- [x] CHK013 Is `definition_digest` justified as content identity and bounded to the unchanged
  `standard-development` process? [Consistency, Spec FR-028, State-Graph Impact]
- [x] CHK014 Is process-model behavior explicitly unchanged while generation-number production names
  are mechanically neutralized? [Scope, Spec State-Graph Impact, FR-055]
- [x] CHK015 Is `reject-and-reset` the single declared disposition for incompatible database data?
  [Completeness, Spec FR-030, FR-S001]
- [x] CHK016 Are read-only preflight, exact current structure, strict snapshot/row checks, zero writes,
  and user-controlled recovery all specified? [Coverage, Spec FR-030–FR-031, FR-S002–FR-S003]
- [x] CHK017 Are extra former objects/columns and partially initialized databases addressed rather
  than relying only on missing-required-field checks? [Edge Case, Spec US5/AC2, Edge Cases]
- [x] CHK018 Is an old numbered Codex receipt rejected before lifecycle mutation without retaining a
  legacy parser? [Coverage, Spec FR-056]

## Codex Build, Release, and Recovery

- [x] CHK019 Are Codex and Core artifact names independently derived and separately recorded?
  [Completeness, Spec FR-019–FR-020, SC-009–SC-011]
- [x] CHK020 Is the Codex release commit restricted to exactly the package and plugin mirror, with
  exact commit/Tag identities? [Clarity, Spec FR-035–FR-039, SC-007]
- [x] CHK021 Is the first `v0.5.0` bridge distinguished from later `codex-v*` baselines without
  creating a historical alias? [Consistency, Spec FR-039–FR-040, SC-008]
- [x] CHK022 Does the current release identity bind product, Codex/Core versions, Tag, source, mode,
  baseline, and digests without internal format numbers? [Completeness, Spec FR-041–FR-043]
- [x] CHK023 Must old or mismatched publication directories fail before remote observation/mutation
  that could create state? [Recovery, Spec FR-034, FR-042–FR-043, SC-012, SC-015]
- [x] CHK024 Is frozen-source resume still valid when current source product versions later change?
  [Coverage, Spec US4/AC4]
- [x] CHK025 Is quick eligibility based on Codex ownership so a DeepSeek-only diff is not treated as
  Codex product change? [Clarity, Spec FR-044–FR-046, SC-013]

## History, Documentation, and Evidence Budget

- [x] CHK026 Are current contracts/fixtures distinguished from the exact frozen historical evidence
  excluded from rewrite and no-version searches? [Consistency, Spec FR-033, FR-057, SC-014]
- [x] CHK027 Are external tool/dependency versions and Constitution SemVer clearly outside Dev Flow
  product/internal compatibility authorities? [Boundary, Spec Assumptions, Plan Documentation]
- [x] CHK028 Does the documentation requirement name the current product, architecture, support,
  manifest, release, package, and operator surfaces without authorizing historical Feature rewrites?
  [Completeness, Spec FR-049–FR-050]
- [x] CHK029 Is the final test budget capped at targeted tests plus one repository validation, with
  native journeys and publication explicitly excluded? [Measurability, Spec FR-052–FR-053]
- [x] CHK030 Are Tag/npm/GitHub Release and public-asset side effects objectively excluded and
  included in the final success criteria? [Release Separation, Spec Non-Goals, SC-018]
- [x] CHK031 Is delivery bounded to one pushed Feature branch and Draft PR without merge or
  publication? [Delivery Boundary, Spec FR-058, SC-019]

## Review Result

**Unresolved findings**: None

**Decision**: Ready for tasks and analyze

**Reviewer**: Codex

**Reviewed at**: 2026-08-21
