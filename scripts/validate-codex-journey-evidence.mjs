#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { versionSatisfiesRange } from "../packages/codex/lib/lifecycle.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = dirname(dirname(scriptPath));
const defaultSchemaPath = join(
  repositoryRoot,
  "specs",
  "003-codex-explicit-dev-flow",
  "contracts",
  "journey-evidence.schema.json",
);

export function validateEvidenceStructure(evidence, schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new TypeError("journey evidence schema must be an object");
  }
  return validateSchemaValue(evidence, schema, schema, "$", []);
}

export function validateEvidenceSemantics(evidence, { rootVersion } = {}) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return ["evidence must be an object"];
  }
  if (evidence.status !== "pass") return [];

  const errors = [];
  const versions = evidence.versions ?? {};
  const identity = evidence.identity ?? {};
  const validation = evidence.validation ?? {};
  const journey = evidence.journey ?? {};
  const lineage = journey.task_lineage ?? {};
  const invocation = journey.invocation ?? {};
  const lifecycle = journey.lifecycle ?? {};
  const repository = journey.repository ?? {};
  const taskData = journey.task_data ?? {};

  if (versions.package !== versions.core) {
    errors.push("package/Core versions must be equal");
  }
  if (typeof rootVersion !== "string" || rootVersion.length === 0) {
    errors.push("repository VERSION is required for semantic validation");
  } else if (versions.package !== rootVersion || versions.core !== rootVersion) {
    errors.push("package and Core versions must equal repository VERSION");
  }

  try {
    if (!versionSatisfiesRange(versions.codex, versions.codex_compatibility)) {
      errors.push("Codex version must satisfy the recorded Codex compatibility range");
    }
  } catch (error) {
    errors.push(`Codex compatibility range is invalid: ${error.message}`);
  }

  if (validation.targeted_checks?.source_commit !== identity.source_commit) {
    errors.push("targeted validation source commit must equal evidence source commit");
  }
  if (validation.root_validation?.source_commit !== identity.source_commit) {
    errors.push("root validation source commit must equal evidence source commit");
  }

  const revisions = Array.isArray(lineage.revisions) ? lineage.revisions : [];
  if (!strictlyIncreasing(revisions)) {
    errors.push("task revisions must be strictly increasing");
  }

  const actions = Array.isArray(lineage.committed_actions) ? lineage.committed_actions : [];
  if (actions.length < 2) {
    errors.push("at least two committed Core actions are required");
  }
  const revisionSet = new Set(revisions);
  if (actions.some((action) => !revisionSet.has(action?.revision))) {
    errors.push("every committed-action revision must appear in the task lineage");
  }
  const actionIDs = actions.map((action) => action?.action_id);
  if (new Set(actionIDs).size !== actionIDs.length) {
    errors.push("committed actions must have unique action IDs");
  }
  if (lineage.task_id_before_restart !== lineage.task_id_after_restart) {
    errors.push("restart/resume must preserve the same task ID");
  }
  if (
    !Number.isInteger(invocation.core_call_count)
    || !Number.isInteger(invocation.scenario_call_budget)
    || invocation.core_call_count > invocation.scenario_call_budget
  ) {
    errors.push("Core call count must remain within the scenario call budget");
  }
  if (lineage.terminal_outcome !== "DONE") {
    errors.push("terminal outcome must be exactly DONE");
  }

  if (!equalStringArrays(taskData.files_before_removal, taskData.files_after_removal)) {
    errors.push("task-data file lists must be equal before and after removal");
  }
  if (taskData.manifest_before_removal_sha256 !== taskData.manifest_after_removal_sha256) {
    errors.push("task-data manifest digests must be equal before and after removal");
  }
  if (repository.digest_after_completion !== repository.digest_after_removal) {
    errors.push("repository digest after completion must equal repository digest after removal");
  }
  if (!Array.isArray(repository.unexpected_changed_paths) || repository.unexpected_changed_paths.length !== 0) {
    errors.push("unexpected changed paths must be empty");
  }

  for (const field of [
    "setup_readback_passed",
    "restart_resume_passed",
    "remove_readback_passed",
    "task_data_retained",
    "task_reopened_after_removal",
    "compatible_reinstall_passed",
  ]) {
    if (lifecycle[field] !== true) errors.push(`lifecycle.${field} must be true`);
  }

  if (validation.targeted_checks?.result !== "pass") {
    errors.push("targeted checks must pass before final artifact evidence");
  }
  if (validation.root_validation?.result !== "pass") {
    errors.push("root validation must pass before final artifact evidence");
  }
  if (!Array.isArray(evidence.failures) || evidence.failures.length !== 0) {
    errors.push("passing evidence failures must be empty");
  }
  if (!Array.isArray(evidence.skips) || evidence.skips.length !== 0) {
    errors.push("passing evidence skips must be empty");
  }

  for (const [label, completedAt] of [
    ["targeted checks", validation.targeted_checks?.completed_at],
    ["root validation", validation.root_validation?.completed_at],
  ]) {
    if (validTimestamp(completedAt) && validTimestamp(evidence.recorded_at)) {
      if (Date.parse(completedAt) > Date.parse(evidence.recorded_at)) {
        errors.push(`${label} completion must precede the recorded final-artifact journey`);
      }
    }
  }

  return errors;
}

export function validateEvidence(evidence, { schema, rootVersion } = {}) {
  const structuralErrors = validateEvidenceStructure(evidence, schema);
  const semanticErrors = structuralErrors.length === 0
    ? validateEvidenceSemantics(evidence, { rootVersion })
    : [];
  return {
    valid: structuralErrors.length === 0 && semanticErrors.length === 0,
    structuralErrors,
    semanticErrors,
  };
}

export async function validateEvidenceFile(
  evidencePath,
  {
    schemaPath = defaultSchemaPath,
    versionPath = join(repositoryRoot, "VERSION"),
  } = {},
) {
  const [evidenceText, schemaText, rootVersionText] = await Promise.all([
    readFile(evidencePath, "utf8"),
    readFile(schemaPath, "utf8"),
    readFile(versionPath, "utf8"),
  ]);
  const evidence = JSON.parse(evidenceText);
  const schema = JSON.parse(schemaText);
  return validateEvidence(evidence, { schema, rootVersion: rootVersionText.trim() });
}

function validateSchemaValue(value, schema, rootSchema, path, errors) {
  if (schema === true) return errors;
  if (schema === false) {
    errors.push(`${path} is forbidden by schema`);
    return errors;
  }

  if (schema.$ref) {
    const target = resolveReference(rootSchema, schema.$ref);
    validateSchemaValue(value, target, rootSchema, path, errors);
  }

  if (Array.isArray(schema.allOf)) {
    for (const member of schema.allOf) validateSchemaValue(value, member, rootSchema, path, errors);
  }
  if (Array.isArray(schema.anyOf)) {
    const valid = schema.anyOf.some((member) => validateSchemaValue(value, member, rootSchema, path, []).length === 0);
    if (!valid) errors.push(`${path} must satisfy at least one anyOf branch`);
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((member) => validateSchemaValue(value, member, rootSchema, path, []).length === 0);
    if (matches.length !== 1) errors.push(`${path} must satisfy exactly one oneOf branch`);
  }

  if (schema.if) {
    const conditionMatches = validateSchemaValue(value, schema.if, rootSchema, path, []).length === 0;
    if (conditionMatches && schema.then) validateSchemaValue(value, schema.then, rootSchema, path, errors);
    if (!conditionMatches && schema.else) validateSchemaValue(value, schema.else, rootSchema, path, errors);
  }

  if (Object.hasOwn(schema, "const") && !deepEqual(value, schema.const)) {
    errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(value, candidate))) {
    errors.push(`${path} must equal one of ${JSON.stringify(schema.enum)}`);
  }

  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${path} must have type ${schema.type}`);
    return errors;
  }

  if (typeof value === "string") {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
      errors.push(`${path} must have length >= ${schema.minLength}`);
    }
    if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) {
      errors.push(`${path} must have length <= ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path} must match pattern ${schema.pattern}`);
    }
    if (schema.format === "date-time" && !validTimestamp(value)) {
      errors.push(`${path} must be a valid date-time`);
    }
  }

  if (typeof value === "number" && Number.isFinite(schema.minimum) && value < schema.minimum) {
    errors.push(`${path} must be >= ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      errors.push(`${path} must contain at least ${schema.minItems} items`);
    }
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
      errors.push(`${path} must contain at most ${schema.maxItems} items`);
    }
    if (schema.uniqueItems && new Set(value.map(stableValue)).size !== value.length) {
      errors.push(`${path} must contain unique items`);
    }
    if (schema.items) {
      value.forEach((item, index) => validateSchemaValue(item, schema.items, rootSchema, `${path}[${index}]`, errors));
    }
  }

  if (isObject(value)) {
    if (Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!Object.hasOwn(value, field)) errors.push(`${path}.${field} is required`);
      }
    }
    if (schema.properties && isObject(schema.properties)) {
      for (const [field, childSchema] of Object.entries(schema.properties)) {
        if (Object.hasOwn(value, field)) {
          validateSchemaValue(value[field], childSchema, rootSchema, `${path}.${field}`, errors);
        }
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const field of Object.keys(value)) {
        if (!allowed.has(field)) errors.push(`${path}.${field} is not allowed`);
      }
    }
  }

  return errors;
}

function resolveReference(rootSchema, reference) {
  if (!reference.startsWith("#/")) throw new Error(`unsupported schema reference ${reference}`);
  let current = rootSchema;
  for (const encoded of reference.slice(2).split("/")) {
    const member = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isObject(current) || !Object.hasOwn(current, member)) {
      throw new Error(`unresolved schema reference ${reference}`);
    }
    current = current[member];
  }
  return current;
}

function matchesType(value, type) {
  if (type === "object") return isObject(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "null") return value === null;
  throw new Error(`unsupported schema type ${type}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepEqual(left, right) {
  return stableValue(left) === stableValue(right);
}

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function strictlyIncreasing(values) {
  if (!Array.isArray(values) || values.length < 2) return false;
  return values.every((value, index) => Number.isInteger(value) && (index === 0 || value > values[index - 1]));
}

function equalStringArrays(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function validTimestamp(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

async function main() {
  if (process.argv.length !== 3) {
    throw new Error("usage: validate-codex-journey-evidence.mjs <evidence.json>");
  }
  const evidencePath = resolve(process.argv[2]);
  const result = await validateEvidenceFile(evidencePath);
  if (!result.valid) {
    for (const message of [...result.structuralErrors, ...result.semanticErrors]) {
      process.stderr.write(`evidence validation failed: ${message}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${JSON.stringify({ status: "valid", evidence_path: evidencePath })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`evidence validation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
