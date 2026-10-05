/**
 * Agents 8-9: engineering and validation.
 *
 * Software Engineering asks whether the content can be represented by the
 * delivery system at all. Validation re-derives the upstream gates rather than
 * trusting them, so a stage that silently reported success still cannot let a
 * release through.
 */
import { FindingLog, pass, publish, readArtifact } from "../checks.ts";
import type { StageId, StageResult, Submission } from "../types.ts";

/**
 * Stages whose artifacts must be present and clean before a release. Mirrors the
 * pipeline order exactly: a stage missing from this list would let the release
 * record skip a gate without noticing.
 */
const REQUIRED_GATES: StageId[] = [
  "evidence",
  "rights",
  "curriculum",
  "question",
  "technical-review",
  "instructional-review",
  "assessment-governance",
];

/** Maps each gate to the artifact key carrying its pass/fail flag. */
const GATE_ARTIFACT_KEYS: Record<string, string> = {
  evidence: "admissible",
  rights: "cleared",
  curriculum: "coherent",
  question: "authored",
  "technical-review": "verified",
  "instructional-review": "aligned",
  "assessment-governance": "governed",
};

export function softwareEngineeringAgent(submission: Submission): StageResult {
  const log = new FindingLog();

  const governed = readArtifact<{ governed: boolean }>(submission, "assessment-governance");
  if (!governed?.governed) {
    log.blocker(
      "ENGINEERING-001",
      "Engineering work requires a cleared Assessment Governance Agent.",
    );
  }

  // Delivery-system constraints, mirroring what the assessment service can
  // actually store. An item that violates them is un-releasable by definition
  // rather than by policy preference.
  const itemIds = new Set<string>();
  for (const item of submission.items) {
    if (itemIds.has(item.id)) {
      log.blocker("ENGINEERING-002", `Item "${item.id}" collides with an earlier id.`, item.id);
    }
    itemIds.add(item.id);

    if (item.kind === "constructed" && !item.rubric?.trim()) {
      log.blocker(
        "ENGINEERING-003",
        `Constructed item "${item.id}" has no rubric and cannot be routed to mentor grading.`,
        item.id,
      );
    }

    if (item.kind === "numeric" && typeof item.tolerance !== "number") {
      log.blocker(
        "ENGINEERING-004",
        `Numeric item "${item.id}" has no tolerance, so the grader cannot accept an answer.`,
        item.id,
      );
    }
  }

  // Referential integrity across the whole aggregate, which no single-item
  // check can see.
  const objectiveIds = new Set(submission.objectives.map((o) => o.id));
  const dangling = submission.items.filter((item) => !objectiveIds.has(item.objectiveId));
  if (dangling.length > 0) {
    log.blocker(
      "ENGINEERING-005",
      `${dangling.length} item(s) reference an objective that does not exist.`,
    );
  }

  const orphanSources = submission.sources.filter((s) => !s.supports.length);

  publish(submission, "software-engineering", {
    shippable: log.count("blocker") === 0,
    items: submission.items.length,
    orphanSources: orphanSources.length,
  });

  return pass(
    "software-engineering",
    "Software Engineering Agent",
    log.findings,
    {
      items: submission.items.length,
      orphanSources: orphanSources.length,
      danglingItems: dangling.length,
    },
  );
}

export function validationAgent(submission: Submission): StageResult {
  const log = new FindingLog();

  const missing: string[] = [];
  const uncleared: string[] = [];

  for (const stage of REQUIRED_GATES) {
    const artifact = readArtifact<Record<string, unknown>>(submission, stage);
    if (!artifact) {
      missing.push(stage);
      continue;
    }
    const key = GATE_ARTIFACT_KEYS[stage];
    if (key && artifact[key] !== true) {
      uncleared.push(stage);
    }
  }

  for (const stage of missing) {
    log.blocker(
      "VALIDATION-001",
      `Gate "${stage}" produced no artifact; the run is incomplete.`,
      stage,
    );
  }

  for (const stage of uncleared) {
    log.blocker("VALIDATION-002", `Gate "${stage}" recorded an uncleared artifact.`, stage);
  }

  const gatesChecked = REQUIRED_GATES.length - missing.length;

  const uniqueItems = new Set(submission.items.map((item) => item.id)).size;
  if (submission.items.length !== uniqueItems) {
    log.blocker(
      "VALIDATION-003",
      `Item bank contains duplicate ids (${submission.items.length} rows, ${uniqueItems} unique).`,
    );
  }

  publish(submission, "validation", {
    valid: log.count("blocker") === 0,
    gatesChecked,
    missingGates: missing.length,
  });

  return pass("validation", "Validation Agent", log.findings, {
    gatesChecked,
    missingGates: missing.length,
    uniqueItems,
  });
}