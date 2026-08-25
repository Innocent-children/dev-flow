# Contract: TEST Evidence Sources

Completed developer verification is encoded as:

```json
{
  "source": "user",
  "name": "Developer manager V1",
  "status": "passed",
  "summary": "The developer reported 21/21 tests passed.",
  "command_count": 0,
  "full_suite": false
}
```

`command_count` attributes automatic commands to the agent, so every non-automated source uses zero. The developer's
summary may state the command they ran, but the numeric budget field remains zero.

`manual_handoff_items` contains only checks still awaiting execution. A passing TEST result with completed user
evidence has an empty manual_handoff_items list.

