# Research: Publish Codex 0.4.0

## Decision 1: Expose one root operator command

**Decision**: Add `release:codex` with exact `--output` and `--confirm` arguments.

**Rationale**: The maintainer performs one action while existing reviewed safety components retain
their ownership.

**Alternatives considered**: Keep four documented operator commands; replace all release tooling.

**Why alternatives were rejected**: Multiple commands preserve unnecessary human coordination;
replacement would duplicate proven release behavior and enlarge risk.

**Consequences**: The wrapper remains thin and delegates preparation, verification, publication, and
final Journey behavior.

## Decision 2: Classify the external directory before execution

**Decision**: Missing and empty directories enter preparation; an exact five-file directory enters
resume; every other state fails closed.

**Rationale**: This provides one command for first execution and recovery while preserving the
publisher's durable truth.

**Alternatives considered**: Always rebuild; always require an empty directory; infer partial
preparation from arbitrary files.

**Why alternatives were rejected**: Rebuilding can diverge after remote mutation, empty-only input
prevents simple recovery, and arbitrary partial-file inference weakens identity checks.

**Consequences**: An interrupted preparation that never produced the five-file set requires a new
empty directory; any remote-started attempt retains and reuses the exact five-file directory.

## Decision 3: Advance the current release manifest to graph identity

**Decision**: Release manifest Schema 2 records Feature 008 commit, Core Contract 0.2, storage Schema
2, snapshot version 2, and `standard-development@1` identity/digest.

**Rationale**: The existing manifest still names Feature 003/005 and the old shared fixture digest,
which cannot identify the graph product being published.

**Alternatives considered**: Publish with the old manifest; add free-form notes; retain obsolete
fields alongside graph fields.

**Why alternatives were rejected**: Old identity would be false release evidence, notes are not a
closed contract, and mixed generations make the active product identity ambiguous.

**Consequences**: Feature 006's contract and `release/testdata/` fixtures remain frozen historical
evidence; the current implementation schema mirrors Feature 009's Schema 2 authority and temporary
release preparation supplies current-version fixture coverage.

## Decision 4: Align current identities and preserve historical literals

**Decision**: Update the five current workspace version authorities and current graph/public release
fixtures to `0.4.0`; keep historical `0.1.0`–`0.3.0` specifications, artifacts, release fixtures, and
Feature 008 acceptance evidence literal.

**Rationale**: Current builds need one version, while historical evidence must continue to describe
what actually occurred.

**Alternatives considered**: Global string replacement; leave private workspace metadata at
`0.3.0`.

**Why alternatives were rejected**: Global replacement corrupts history; split current workspace
versions violate existing package authority checks.

**Consequences**: Tests distinguish current version-derived expectations from frozen historical
fixtures.

## Decision 5: Keep publication effects in the existing publisher

**Decision**: The wrapper invokes the production publisher once with exact confirmation; it does not
implement Tag, npm, GitHub, Journey, asset, or recovery operations itself.

**Rationale**: The publisher already provides read-before-mutation, publish-once, exact reuse,
atomic records, and conflict blocking.

**Alternatives considered**: Move the state machine into the wrapper; call each remote step from the
wrapper.

**Why alternatives were rejected**: Either option creates a second publication authority and
duplicates recovery logic.

**Consequences**: Existing publication record Schema 1 and nine ordered steps remain stable.

## Decision 6: Use one clean source commit and one completion commit

**Decision**: Push one clean `main` source commit before publication, then record public evidence in a
documentation-only completion commit after the immutable release succeeds.

**Rationale**: Preparation and publication require a clean, pushed source identity; public evidence
does not exist until the release completes.

**Alternatives considered**: Pre-claim completion in the source commit; mutate source after
preparation but before publication.

**Why alternatives were rejected**: Both make repository evidence inconsistent with remote truth.

**Consequences**: Tag `v0.4.0` remains fixed at the source commit; later completion evidence does not
change published bytes.

## Decision 7: Bound validation to one full run and one native Journey

**Decision**: Run targeted release tests during implementation, one repository validation at the
source gate, and one production registry Journey inside the publisher.

**Rationale**: This matches the changed surface and Constitution evidence budget.

**Alternatives considered**: Re-run the full suite after every slice; run local and registry native
Journeys.

**Why alternatives were rejected**: Repeated broad checks add cost without distinct evidence; local
native evidence cannot replace final registry evidence.

**Consequences**: Any retry records the failing cause before repeating the affected gate.
