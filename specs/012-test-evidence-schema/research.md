# Research: Precise TEST Evidence Schema Exposure

## Decision 1: Preserve workflow semantics

**Decision**: Treat `validateNormalizedEvidenceInput` as current authority and tighten MCP Schema to match it.

**Rationale**: The rejected payload violated an existing invariant; changing the validator would incorrectly count a
developer command as automatic or introduce a second budget meaning.

**Alternatives considered**: Allow nonzero user command_count; move completed user checks into manual_handoff_items.

**Why rejected**: User evidence is already a retained EvidenceSummary source, while manual_handoff_items is outstanding
work. Automatic budget counts only source automated.

## Decision 2: Use full top-level discriminated objects

**Decision**: Replace generic apply object plus allOf narrowing with oneOf complete apply objects.

**Rationale**: The current Host projection discovers action_kind alternatives but loses payload details at the generic
intersection. Full branches provide one direct discriminant-to-payload relation.

**Alternatives considered**: Add descriptions only; retain allOf and duplicate nested payload metadata; expose one tool
per action kind.

**Why rejected**: Descriptions do not create callable types, duplicated intersected schemas keep ambiguity, and extra
tools violate the six-tool catalog.

## Decision 3: Encode source invariants structurally

**Decision**: Make checks.items a oneOf of four complete source branches.

**Rationale**: JSON Schema must reject the same source/count/full-suite combinations as workflow validation.

**Alternatives considered**: JSON Schema if/then; keep broad schema and document prose only.

**Why rejected**: Full branches are easier for Host type generation and avoid conditional-schema support differences.

## Decision 4: No real Host assertion

**Decision**: Prove the produced MCP JSON Schema and packaged references deterministically; record live Host projection
as a later release/integration concern.

**Rationale**: The Feature test budget forbids a real Host journey, and source correctness is independently testable.

**Alternatives considered**: Restart Codex and inspect generated callable tools.

**Why rejected**: That is environment-dependent and belongs to a separately authorized final gate.

