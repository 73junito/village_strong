/**
 * Agent 7: Assessment Governance.
 *
 * The fairness gate. Its mandate is the one that protects the learner rather
 * than the content: a bank can be impeccably sourced, correctly licensed,
 * technically sound and pedagogically aligned and still be indefensible to score
 * a young person with. This agent asks whether the scoring decision is fair,
 * explainable and adequately evidenced.
 */
import { FindingLog, pass, publish, readArtifact } from "../checks.ts";
import type { StageResult, Submission } from "../types.ts";

export function assessmentGovernanceAgent(submission: Submission): StageResult {
  const log = new FindingLog();

  const curriculum = readArtifact<{ coherent: boolean }>(submission, "curriculum");
  if (!curriculum?.coherent) {
    log.blocker(
      "GOVERNANCE-001",
      "Assessment governance requires a cleared Curriculum Agent.",
    );
  }

  const itemsPerObjective = new Map<string, number>();
  for (const item of submission.items) {
    itemsPerObjective.set(item.objectiveId, (itemsPerObjective.get(item.objectiveId) ?? 0) + 1);
  }

  // Coverage is counted per objective, not across the bank: 40 items all aimed at
  // one objective look thorough on a summary and prove nothing about the rest.
  let thinCoverage = 0;
  for (const [objectiveId, count] of itemsPerObjective) {
    if (count < 2) {
      thinCoverage += 1;
      log.warn(
        "GOVERNANCE-002",
        `Objective "${objectiveId}" is assessed by ${count} item(s); a single item cannot evidence mastery.`,
        objectiveId,
      );
    }
  }

  const totalPoints = submission.items.reduce((sum, item) => sum + item.points, 0);
  if (totalPoints <= 0) {
    log.blocker("GOVERNANCE-003", "Total available points must be positive.");
  }

  // Many distinct point weights make a score unexplainable to a learner and
  // unauditable to a parent; a small set keeps the result defensible.
  const distinctPointValues = new Set(submission.items.map((item) => item.points));
  if (distinctPointValues.size > 3) {
    log.warn(
      "GOVERNANCE-004",
      `The bank uses ${distinctPointValues.size} different point values; scoring becomes hard to explain.`,
    );
  }

  // Every objective must appear in the scored blueprint, not merely in the bank.
  const scoredObjectiveIds = new Set(submission.items.map((item) => item.objectiveId));
  const unscored = submission.objectives
    .map((o) => o.id)
    .filter((id) => !scoredObjectiveIds.has(id));
  for (const id of unscored) {
    log.blocker(
      "GOVERNANCE-005",
      `Objective "${id}" contributes no scorable item to the blueprint.`,
      id,
    );
  }

  const overrides = submission.priorReviewNotes.filter((note) =>
    /override|waiver|exception/i.test(note),
  );
  if (overrides.length > 0) {
    // Overrides are legitimate but must be visible to a reviewer, never silent.
    log.info(
      "GOVERNANCE-006",
      `${overrides.length} prior note(s) record an override; confirm each is authorised and dated.`,
    );
  }

  publish(submission, "assessment-governance", {
    governed: log.count("blocker") === 0,
    totalPoints,
    thinCoverage,
    objectiveCoverage: scoredObjectiveIds.size,
    overrides: overrides.length,
  });

  return pass(
    "assessment-governance",
    "Assessment Governance Agent",
    log.findings,
    {
      totalPoints,
      objectiveCoverage: scoredObjectiveIds.size,
      thinCoverage,
      distinctPointValues: distinctPointValues.size,
      overrides: overrides.length,
    },
  );
}