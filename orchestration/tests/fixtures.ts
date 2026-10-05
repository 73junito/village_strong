/**
 * Shared test fixtures.
 *
 * Kept out of the *.test.ts files on purpose: the unit suites import these
 * under node --test and the integration suite under Vitest inside workerd. A
 * shared module that registered tests would be executed twice, by runners that
 * do not understand each other's test functions.
 */
import { PIPELINE } from "../src/pipeline.ts";
import type { Item, Objective, RunReport, Submission } from "../src/types.ts";

export const NOW = new Date("2026-10-05T00:00:00.000Z");

/** An objective at each Bloom level, so coverage tests can vary demand. */
export const OBJECTIVES: Objective[] = [
  { id: "o1", text: "Define emotional regulation.", bloomLevel: "remember" },
  { id: "o2", text: "Explain how conflict affects peers.", bloomLevel: "understand" },
  { id: "o3", text: "Apply a de-escalation script in a role play.", bloomLevel: "apply" },
  { id: "o4", text: "Compare two mentoring responses.", bloomLevel: "analyze" },
];

/** Two gradable MCQ items per objective, which clears every coverage warning. */
export function items(): Item[] {
  const built: Item[] = [];
  for (const objective of OBJECTIVES) {
    for (const n of [1, 2]) {
      built.push({
        id: `${objective.id}-i${n}`,
        kind: "mcq",
        objectiveId: objective.id,
        points: 1,
        optionIds: ["a", "b", "c"],
        correctOptionIds: ["b"],
        rationale: "Option b matches the programme's scripted response.",
      });
    }
  }
  return built;
}

/** A submission that passes all ten gates. Individual tests break one thing. */
export function cleanSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    courseId: "heroes-path-week-1",
    sources: [
      {
        id: "s1",
        title: "Youth mentoring meta-analysis",
        year: 2021,
        peerReviewed: true,
        supports: ["o1", "o2", "o3", "o4"],
      },
    ],
    assets: [
      {
        id: "a1",
        kind: "image",
        title: "Village banner",
        license: "CC BY 4.0",
        // Artwork only: a banner depicting nobody needs no consent release,
        // which is exactly why `depictsPeople` is declared rather than inferred.
        depictsPeople: false,
        consentOnFile: false,
        original: true,
      },
    ],
    objectives: OBJECTIVES,
    items: items(),
    priorReviewNotes: ["Reviewed in the week-0 curriculum council."],
    stageArtifacts: {},
    ...overrides,
  };
}

/**
 * Replaces one item by id.
 *
 * Addressing by id rather than by index keeps these tests honest under
 * `noUncheckedIndexedAccess`: `items[0]` is `Item | undefined`, and silently
 * spreading that into a new object would produce a half-populated item that the
 * agents then reject for the wrong reason.
 */
export function replaceItem(submission: Submission, id: string, patch: Partial<Item>): void {
  const index = submission.items.findIndex((item) => item.id === id);
  const existing = submission.items[index];
  if (index < 0 || !existing) throw new Error(`No item "${id}" to replace.`);
  submission.items[index] = { ...existing, ...patch };
}

/** Every finding code raised by the run, for readable assertions. */
export function codes(report: RunReport): string[] {
  return report.results.flatMap((result) => result.findings.map((f) => f.code));
}

/** Runs every agent before `stage`, leaving `stage` and later unrun. */
export function runUpTo(submission: Submission, stage: string): void {
  for (const agent of PIPELINE) {
    if (agent.stage === stage) break;
    agent.run(submission, NOW);
  }
}
