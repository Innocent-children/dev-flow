# Recovery Contract

Recovery retains the original operation identity and canonical payload, including the node-result mutation
envelope. It observes the complete Scope once and uses the ordinary effect derivation/component proof.

| Facts | Existing classification/directive |
| --- | --- |
| Current Action and exact binding; declared effect absent | `not_started` / safe retry only if directed |
| Exact LastOperation proof | `completed_and_recorded` / read next Action |
| Full declared effect present, no forbidden fact | `completed_but_unrecorded` / recovery apply |
| Strict subset of multi-repository effect present | `partially_completed` / blocker |
| Forbidden binding or undeclared path | `conflicting` / existing safe stop or blocker |

Artifact presence is never completion evidence. Blocker resolution still requires exact expected binding and
resumes only the original source node. No class, directive or public error is added.
