# Requirements Quality Checklist: Lost Frozen-Directory Recovery

**Purpose**: Review whether the one-time recovery amendment is complete, unambiguous, and safe
before recovery preparation and publication resume.
**Created**: 2026-08-18
**Feature**: [spec.md](../spec.md)

**Ownership**: Reviewers own these markers. `[x]` means the requirements-quality criterion was
reviewed and satisfied; it does not mean implementation work is complete.

## Requirement Completeness

- [ ] CHK001 Are the triggering facts for lost-directory recovery explicitly limited to the observed missing sole operator directory after exact Tag/Draft creation? [Completeness, Spec §Edge Cases]
- [ ] CHK002 Are the source commit/tree, package/version, platform, host, tarball digest, and Core digest fixed for the recovery path? [Completeness, Spec §FR-037–FR-039]
- [ ] CHK003 Are durable-directory location and retention requirements defined through publication completion or explicit retirement? [Completeness, Spec §FR-038]

## Requirement Clarity

- [ ] CHK004 Is “one recovery preparation” objectively bounded to one invocation under this incident amendment? [Clarity, Spec §FR-037]
- [ ] CHK005 Is the distinction between reproduced immutable payloads and regenerated mutable/provisional evidence explicit? [Clarity, Spec §FR-040]

## Requirement Consistency

- [ ] CHK006 Are the recovery requirements consistent with immutable Tag, Draft, npm version, and asset rules? [Consistency, Spec §FR-004, FR-029, FR-040]
- [ ] CHK007 Are spec, plan, tasks, data model, quickstart, and release-process contract aligned on exact remote-state reuse? [Consistency]

## Scenario and Failure Coverage

- [ ] CHK008 Are mismatch and conflict stop conditions defined before publisher confirmation? [Coverage, Spec §FR-039–FR-040]
- [ ] CHK009 Is the recovery path explicitly prevented from becoming a general reprepare, alternate-version, rollback, or overwrite mechanism? [Coverage, Spec §Scope Boundaries]
- [ ] CHK010 Can successful recovery be measured by exact payload reproduction, remote truth reconstruction, publish-once behavior, native Journey, asset read-back, and final complete record? [Measurability, Spec §SC-011]

## Notes

- `$speckit-implement` reads checklist state but does not modify reviewer-owned markers.
