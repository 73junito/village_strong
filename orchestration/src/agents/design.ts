/**
 * Agents 3-4: design.
 *
 * Curriculum checks that the objective set is measurable and actually measured.
 * Question checks that every item is gradable at all. Both depend on the
 * admissibility gates having cleared, which is why the pipeline is ordered.
 */
import { FindingLog, pass, publish, unique } from "../checks.ts";
import type { StageResult, Submission } from "../types.ts";

export function curriculumAgent(submission: Submission): StageResult {
  const log = new FindingLog();

  if (submission.objectives.length === 0) {
    log.blocker("CURRICULUM-001", "No learning objectives declared.");
  }

  const seenObjectiveIds = new Set<string>();
  const textSeen = new Map<string, string>();

  for (const objective of submission.objectives) {
    if (seenObjectiveIds.has(objective.id)) {
      log.blocker("CURRICULUM-002", `Duplicate objective id "${objective.id}".`, objective.id);
    }
    seenObjectiveIds.add(objective.id);

    if (!objective.text.trim()) {
      log.blocker("CURRICULUM-003", `Objective "${objective.id}" has no text.`, objective.id);
    }

    const normalised = objective.text.trim().toLowerCase();
    const previous = textSeen.get(normalised);
    if (previous && previous !== objective.id) {
      log.warn(
        "CURRICULUM-004",
        `Objective "${objective.id}" duplicates the wording of "${previous}".`,
        objective.id,
      );
    }
    textSeen.set(normalised, objective.id);
  }

  const measures = unique(submission.items.map((item) => item.objectiveId));
  const unmeasured = submission.objectives
    .map((o) => o.id)
    .filter((id) => !measures.includes(id));
  for (const id of unmeasured) {
    log.blocker(
      "CURRICULUM-005",
      `Objective "${id}" is never measured by any item; it cannot ship unassessed.`,
      id,
    );
  }

  if (submission.priorReviewNotes.length === 0) {
    log.warn(
      "CURRICULUM-006",
      "No prior review notes supplied; confirm an earlier review round actually ran.",
    );
  }

  publish(submission, "curriculum", {
    coherent: log.count("blocker") === 0,
    objectives: submission.objectives.length,
    unmeasuredObjectives: unmeasured.length,
  });

  return pass("curriculum", "Curriculum Agent", log.findings, {
    objectives: submission.objectives.length,
    measuredObjectives: measures.length,
    unmeasuredObjectives: unmeasured.length,
  });
}

export function questionAgent(submission: Submission): StageResult {
  const log = new FindingLog();

  const knownObjectiveIds = new Set(submission.objectives.map((o) => o.id));
  const seenItemIds = new Set<string>();
  let totalPoints = 0;
  let multiPart = 0;

  for (const item of submission.items) {
    if (seenItemIds.has(item.id)) {
      log.blocker("QUESTION-001", `Duplicate item id "${item.id}".`, item.id);
    }
    seenItemIds.add(item.id);

    if (!knownObjectiveIds.has(item.objectiveId)) {
      log.blocker(
        "QUESTION-002",
        `Item "${item.id}" targets unknown objective "${item.objectiveId}".`,
        item.id,
      );
    }

    if (!(item.points > 0)) {
      log.blocker(
        "QUESTION-003",
        `Item "${item.id}" must carry positive points; got ${item.points}.`,
        item.id,
      );
    }
    totalPoints += item.points;

    if (!item.rationale?.trim()) {
      log.warn("QUESTION-004", `Item "${item.id}" has no rationale for its key.`, item.id);
    }

    const options = item.optionIds ?? [];
    const correct = item.correctOptionIds ?? [];

    switch (item.kind) {
      case "mcq":
        if (options.length < 2) {
          log.blocker("QUESTION-005", `MCQ "${item.id}" needs at least two options.`, item.id);
        }
        if (correct.length !== 1) {
          log.blocker(
            "QUESTION-006",
            `MCQ "${item.id}" must have exactly one correct option; got ${correct.length}.`,
            item.id,
          );
        }
        break;

      case "msq":
        multiPart += 1;
        if (correct.length < 1) {
          log.blocker("QUESTION-007", `MSQ "${item.id}" has no correct option.`, item.id);
        }
        break;

      case "numeric":
        if (typeof item.numericAnswer !== "number") {
          log.blocker("QUESTION-008", `Numeric item "${item.id}" has no answer.`, item.id);
        }
        if (typeof item.tolerance !== "number" || item.tolerance < 0) {
          log.blocker(
            "QUESTION-009",
            `Numeric item "${item.id}" must declare a non-negative tolerance.`,
            item.id,
          );
        }
        break;

      case "constructed":
        if (!item.rubric?.trim()) {
          log.blocker(
            "QUESTION-010",
            `Constructed item "${item.id}" has no rubric, so mentors cannot score it consistently.`,
            item.id,
          );
        }
        break;
    }

    // A key pointing at an option the item never offers is the classic
    // unscorable-bank defect: it type-checks but can never be graded correctly.
    for (const correctId of correct) {
      if (!options.includes(correctId)) {
        log.blocker(
          "QUESTION-011",
          `Item "${item.id}" keys option "${correctId}", which is not among its options.`,
          item.id,
        );
      }
    }
  }

  if (submission.items.length === 0) {
    log.blocker("QUESTION-012", "No items in the bank; nothing to release.");
  }

  publish(submission, "question", {
    authored: log.count("blocker") === 0,
    items: submission.items.length,
    totalPoints,
  });

  return pass("question", "Question Agent", log.findings, {
    items: submission.items.length,
    totalPoints,
    multiPart,
  });
}