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

## Decision 8: Recover Journey tooling against the frozen release source

**Decision**: Strengthen only the final-registry resume prompt so every apply explicitly carries a
caller-generated top-level `request_id`, commit the reviewed tooling correction, and run that tooling
against a clean external `main`-named checkout of frozen Tag `v0.4.0` and the retained directory.

**Rationale**: Tag, Draft, npm bytes, and source are immutable. The observed substantive session
passed, while the resume apply was correctly rejected for missing caller request binding.

**Alternatives considered**: Move the Tag; republish npm; rebuild artifacts; blindly rerun the same
prompt; weaken Core input validation.

**Why alternatives were rejected**: The first three corrupt immutable release identity, blind retry
does not address a complete domain rejection, and Core correctly enforced the closed mutation schema.

**Consequences**: One read-only fixed-tooling preflight must prove exact reuse before confirmation.
Recovery may rerun the Journey and complete later steps; npm publish count remains one and artifact
digests remain unchanged.

## Decision 9: Validate final registry sessions as Contract 0.2 graph tasks

**Decision**: Select an explicit graph-contract branch for the final-registry session validator,
reuse the existing Schema 2/process handshake assertion, and read `current_cursor` for nonterminal,
`DONE`, and retained-reopen checks. Historical development fixture validation keeps its Schema 1 and
`phase` defaults.

**Rationale**: The fixed request-ID prompt completed both native sessions, then the old post-session
validator rejected the substantive Schema 2 handshake before it could assess the graph task.

**Alternatives considered**: Change the released Core back to Schema 1; weaken handshake validation;
rewrite the separate historical development smoke.

**Why alternatives were rejected**: The released Core correctly implements Feature 008, omitted
handshake checks would invalidate public evidence, and historical fixture behavior is outside the
release correction.

**Consequences**: A closed four-session graph fixture must prove Contract 0.2 handshake, read order,
current cursor, revision growth, one targeted command, and terminal outcome before another recovery
Journey.

## Decision 10: Bind every final-registry task-bearing prompt

**Decision**: Define one shared final-registry instruction requiring a new nonempty opaque top-level
`request_id` for every apply, and embed it in both substantive and resume prompts.

**Rationale**: The resume-specific correction worked, but a later substantive session omitted the
same required field. Native publication evidence cannot depend on a previously successful model
choice when both sessions issue mutations.

**Alternatives considered**: Retry the unchanged substantive prompt; weaken Core validation; inject
or repair tool arguments after Codex emits them.

**Why alternatives were rejected**: Retry is blind after a complete domain rejection, Core is
correct, and post-generation mutation would create hidden adapter behavior outside the live schema.

**Consequences**: Tests must assert the full rule in both prompts and retain the existing read-order
rule in resume. Another Journey is allowed only after the combined targeted suite passes.

## Decision 11: Require current human comprehension before delivery

**Decision**: Final-registry resume tooling may carry a comprehension-passed payload only after the
maintainer explicitly states that they have read the proof implementation and validation path, can
explain and maintain it, and confirm the current result passes comprehension review.

**Rationale**: Feature 008 makes human comprehension a binding Core node. AI output, passing tests,
release confirmation, and publication intent cannot substitute for the developer verdict.

**Alternatives considered**: Infer confirmation from `--confirm v0.4.0`; let Codex self-confirm;
bypass the node.

**Why alternatives were rejected**: All three violate the Core graph and Constitution IV.

**Consequences**: The maintainer supplied the explicit verdict on 2026-08-20. The next tooling
correction may embed that exact fact alongside closed payload rules; AI inference remains forbidden.
