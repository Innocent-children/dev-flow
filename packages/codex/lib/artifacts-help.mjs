// The Codex Host describes the artifact CLI; Core validates inputs and observes Git.
export const ARTIFACT_OPERATIONS = Object.freeze(["collect", "prepare"]);

const transport = "Send one closed UTF-8 JSON object on stdin, up to 1 MiB. Core returns JSON on stdout: exit 0 for success, exit 1 for failure.";
const context = {
  host: "Use codex for this Host.",
  task_id: "Copy task_id from the current Core Action.",
  action_id: "Copy action_id from the same current Core Action.",
};

export function artifactsHelp(operation) {
  if (operation === undefined) {
    return "Usage: dev-flow-codex artifacts <collect|prepare>\n" +
      "Read command help: dev-flow-codex artifacts <collect|prepare> --help\n\n" +
      "collect: Read the current Action's complete file changes from Core.\n" +
      "prepare: Classify the collected files and prepare the submission's artifacts object.\n\n" +
      "Set DEV_FLOW_DATA_DIR before starting Codex to use an existing canonical absolute data directory.\n";
  }
  let help;
  if (operation === "collect") {
    help = {
      operation,
      description: "Read the current Action's file changes without changing Task or Git state.",
      transport,
      input_example: { host: "codex", task_id: "<current task_id>", action_id: "<current action_id>" },
      input_fields: context,
      output_fields: {
        ok: "A boolean indicating whether collection succeeded.",
        result: "The complete collection: task_id, action_id, revision, observation_digest and files.",
        "result.files[]": "Each file contains path, change_type, digest, slot and summary. Core supplies its identity and content digest; slot and summary start empty.",
        error: "On failure, read code, message and any details before choosing the next step.",
      },
      next_step: "Keep the complete result collection. Fill only each file's slot and summary, then send {host: \"codex\", collection: <that collection>} to dev-flow-codex artifacts prepare.",
    };
  } else if (operation === "prepare") {
    help = {
      operation,
      description: "Validate a classified collection against Core's current observation and produce artifact references.",
      transport,
      input_example: {
        host: "codex",
        collection: {
          task_id: "<copy from collect.result>",
          action_id: "<copy from collect.result>",
          revision: 1,
          observation_digest: "<copy from collect.result>",
          files: [{
            path: "docs/requirements.md", change_type: "modified", digest: "<copy from collect.result.files[]>",
            slot: "current", summary: "Record the current requirements.",
          }],
        },
      },
      input_fields: {
        host: context.host,
        collection: "Copy the entire successful collect.result, including the actual revision, observation_digest and every file. Empty files remains an empty array.",
        "collection.files[].slot": "Choose current for a current-node process document when that slot is available; other_process for related process documents; product for product files in IMPLEMENT or REFACTOR.",
        "collection.files[].summary": "Provide a nonempty explanation of this file's actual purpose.",
        "collection.files[].path/change_type/digest": "Preserve these Core-observed values exactly.",
      },
      output_fields: {
        ok: "A boolean indicating whether preparation succeeded.",
        result: "The artifacts object for the current submission, with other_process and the current slot when available. Product files are excluded from these arrays.",
        error: "On failure, read code, message, details and repository_paths when present.",
      },
      next_step: "Use the complete result as artifacts in the current Action's submission_tool. After further file changes, collect and prepare again. If the Action is stale or the workspace changed, follow Core's current Action and recovery instructions.",
    };
  } else {
    throw new Error("unknown artifact operation " + operation);
  }
  return JSON.stringify(help, null, 2) + "\n";
}
