# Quickstart: TEST Evidence Schema Regression

## Schema projection

Run the targeted MCP schema test and verify nine complete apply branches, a concrete COMPLETE_TEST payload and four
source-specific EvidenceInput branches.

## Workflow matrix

Run the targeted workflow tests. Automated command_count starts at one; user/static/host_observed use zero and reject
full_suite=true.

## Feature 010 regression

Construct a TEST result with four automatic commands and the developer-reported manager check:

```json
{"source":"user","name":"Developer manager V1","status":"passed","summary":"21/21 passed","command_count":0,"full_suite":false}
```

Expected: automatic command total remains four, user evidence is retained, manual_handoff_items is empty and TEST can
advance. The cancelled historical Task is not resumed or rewritten.

