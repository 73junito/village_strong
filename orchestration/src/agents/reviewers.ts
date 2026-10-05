/**
 * Agents 5-6: technical and instructional review.
 *
 * Two reviewers with deliberately different mandates. Technical review asks
 * "is this correct and gradable"; instructional review asks "does this teach and
 * measure what the curriculum claims". Collapsing them into one judgement would
 * let a bank that is technically clean but pedagogically hollow pass the gate.
 *
 * Both read artifacts the intake stages published, which is what makes the
 * pipeline order load-bearing rather than decorative.
 */
import { FindingLog, pass, publish, readArtifact } from "../checks.ts";
import type { BloomLevel, StageResult, Submission } from "../types.ts";

export function technicalReviewAgent(submission: Submission): StageResult {
  const log = new FindingLog();

  const evidence = readArtifact<{ admissible: boolean }>(submission, "evidence");
  if (!evidence?.admissible) {
    log.blocker(
      "TECHNICAL-001",
      "Technical review requires a cleared Evidence Agent; it will not restate that gate.",
    );
  }

  const rights = readArtifact<{ cleared: boolean }>(submission, "rights");
  if (!rights?.cleared) {
    log.blocker(
      "TECHNICAL-002",
      "Technical review requires a cleared Rights Agent before content is assessed.",
    );
  }

  // Option-id hygiene: duplicates are invisible in a rendered form but make
  // per-option statistics collide, so they are caught here rather than in
  // analytics after the bank is live.
  let duplicateOptions = 0;
  for (const item of submission.items) {
    const options = item.optionIds ?? [];

    if (new Set(options).size !== options.length) {
      duplicateOptions += 1;
      log.blocker("TECHNICAL-003", `Item "${item.id}" repeats an option id.`, item.id);
    }

    // A two-option MCQ is gradable but discriminates poorly.
    if (item.kind === "mcq" && options.length === 2) {
      log.warn(
        "TECHNICAL-004",
        `Item "${item.id}" offers only two options, which rarely discriminates.`,
        item.id,
      );
    }

    const answer = item.numericAnswer;
    const tolerance = item.tolerance ?? 0;
    if (item.kind === "numeric" && typeof answer === "number" && tolerance > Math.abs(answer)) {
      log.warn(
        "TECHNICAL-005",
        `Item "${item.id}" has a tolerance larger than its answer; nearly any value scores.`,
        item.id,
      );
    }

    const correct = item.correctOptionIds ?? [];
    if (correct.length > 0 && correct.length === options.length) {
      log.blocker("TECHNICAL-006", `Item "${item.id}" has every option keyed correct.`, item.id);
    }
  }

  publish(submission, "technical-review", {
    verified: log.count("blocker") === 0,
    duplicateOptions,
  });

  return pass("technical-review", "Technical Review Agent", log.findings, {
    itemsReviewed: submission.items.length,
    duplicateOptions,
  });
}

const HIGH_DEMAND: BloomLevel[] = ["analyze", "evaluate", "create"];

export function instructionalReviewAgent(submission: Submission): StageResult {
  const log = new FindingLog();

  const authored = readArtifact<{ authored: boolean }>(submission, "question");
  if (!authored?.authored) {
    log.blocker(
      "INSTRUCTIONAL-001",
      "Instructional review requires a cleared Question Agent.",
    );
  }

  const objectivesById = new Map(submission.objectives.map((o) => [o.id, o]));

  let mismatched = 0;
  for (const item of submission.items) {
    const objective = objectivesById.get(item.objectiveId);
    if (!objective) continue;

    // An `apply`-level objective measured only by constructed response is a
    // signal worth confirming, not an error: it may be deliberate, or it may be
    // an over-stated objective.
    if (item.kind === "constructed" && objective.bloomLevel === "remember") {
      mismatched += 1;
      log.warn(
        "INSTRUCTIONAL-002",
        `Constructed item "${item.id}" is pitched at "${objective.bloomLevel}"; confirm it earns its rubric.`,
        item.id,
      );
    }
  }

  // Coverage of the demanding objectives specifically, not of the bank overall.
  const highDemandObjectives = submission.objectives.filter((o) =>
    HIGH_DEMAND.includes(o.bloomLevel),
  );
  const assessingHighDemand = highDemandObjectives.filter((objective) =>
    submission.items.some(
      (item) =>
        item.objectiveId === objective.id &&
        (item.kind === "constructed" || item.kind === "msq"),
    ),
  );

  for (const objective of highDemandObjectives) {
    if (!assessingHighDemand.includes(objective)) {
      log.warn(
        "INSTRUCTIONAL-003",
        `Objective "${objective.id}" demands ${objective.bloomLevel} thinking but no item assesses it.`,
        objective.id,
      );
    }
  }

  if (highDemandObjectives.length > 0 && assessingHighDemand.length === 0) {
    log.warn(
      "INSTRUCTIONAL-004",
      "No high-demand objective is assessed; the bank tests recall only.",
    );
  }

  publish(submission, "instructional-review", {
    aligned: log.count("blocker") === 0,
    highDemandObjectives: highDemandObjectives.length,
    assessedHighDemand: assessingHighDemand.length,
  });

  return pass(
    "instructional-review",
    "Instructional Review Agent",
    log.findings,
    {
      objectives: submission.objectives.length,
      highDemandObjectives: highDemandObjectives.length,
      assessedHighDemand: assessingHighDemand.length,
      mismatched,
    },
  );
}