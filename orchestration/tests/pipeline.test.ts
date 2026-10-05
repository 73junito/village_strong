import assert from "node:assert/strict";
import test from "node:test";

import { PIPELINE, STAGE_ORDER, runPipeline } from "../src/pipeline.ts";

import {
  NOW,
  OBJECTIVES,
  cleanSubmission,
  codes,
  replaceItem,
  runUpTo,
} from "./fixtures.ts";


test("the pipeline declares the ten gates in gate order", () => {
  assert.deepEqual(STAGE_ORDER, [
    "evidence",
    "rights",
    "curriculum",
    "question",
    "technical-review",
    "instructional-review",
    "assessment-governance",
    "software-engineering",
    "validation",
    "release",
  ]);
  assert.equal(PIPELINE.length, 10);
});

test("a clean submission passes every gate and reaches release", () => {
  const { report, submission } = runPipeline(cleanSubmission(), NOW);

  assert.equal(report.decision, "AWAITING_APPROVAL", `unexpected blockers: ${codes(report).join(", ")}`);
  assert.equal(report.haltedAt, undefined);
  assert.equal(report.completedStages.length, 10);
  assert.deepEqual(
    report.results.map((r) => r.stage),
    STAGE_ORDER,
  );

  // Every agent reports its own title, so the audit trail names the reviewer.
  assert.deepEqual(
    report.results.map((r) => r.agent),
    PIPELINE.map((a) => a.title),
  );

  const release = submission.stageArtifacts.release as { decision: string; courseId: string };
  // A clean run must NOT be released by the engine. That is the whole point of
  // the approval boundary: ten passing agents earn the right to be reviewed.
  assert.equal(release.decision, "AWAITING_APPROVAL");
  assert.equal(release.courseId, "heroes-path-week-1");
});

test("every stage publishes an artifact the next stage can read", () => {
  const { submission } = runPipeline(cleanSubmission(), NOW);

  for (const stage of STAGE_ORDER) {
    assert.ok(submission.stageArtifacts[stage], `${stage} must publish an artifact`);
  }
});

test("the evidence agent blocks an uncited objective", () => {
  const submission = cleanSubmission({
    sources: [
      {
        id: "s1",
        title: "Mentoring meta-analysis",
        year: 2021,
        peerReviewed: true,
        supports: ["o1", "o2", "o3"],
      },
    ],
  });

  const { report } = runPipeline(submission, NOW);

  assert.equal(report.decision, "HELD");
  assert.equal(report.haltedAt, "evidence");
  assert.ok(codes(report).includes("EVIDENCE-006"));
});

test("the pipeline short-circuits at the first blocking stage", () => {
  // Unsourced objective AND a consent gap. Only the evidence gate should speak:
  // running later agents would produce objections to a release already refused.
  const submission = cleanSubmission({
    sources: [],
    assets: [
      {
        id: "a1",
        kind: "video",
        title: "Mentor intro",
        license: "",
        depictsPeople: true,
        consentOnFile: false,
        original: false,
      },
    ],
  });

  const { report } = runPipeline(submission, NOW);

  assert.equal(report.completedStages.length, 1);
  assert.equal(report.haltedAt, "evidence");
  assert.ok(!codes(report).includes("RIGHTS-005"), "later stages must not run");
});

test("the rights agent blocks media of people with no consent release", () => {
  const submission = cleanSubmission({
    assets: [
      {
        id: "a1",
        kind: "video",
        title: "Mentor interview",
        license: "CC BY 4.0",
        depictsPeople: true,
        consentOnFile: false,
        original: false,
      },
    ],
  });

  const { report } = runPipeline(submission, NOW);

  assert.equal(report.haltedAt, "rights");
  assert.ok(codes(report).includes("RIGHTS-005"));
});

test("a permissive licence does not discharge a missing consent release", () => {
  // The paired trap: a valid licence is present, but consent is not.
  const submission = cleanSubmission({
    assets: [
      {
        id: "a1",
        kind: "image",
        title: "Group photo",
        license: "CC BY 4.0",
        depictsPeople: true,
        consentOnFile: false,
        original: false,
      },
    ],
  });

  const { report } = runPipeline(submission, NOW);

  assert.equal(report.haltedAt, "rights");
  assert.ok(codes(report).includes("RIGHTS-005"));
  assert.ok(!codes(report).includes("RIGHTS-003"), "the licence itself is valid");
});

test("the curriculum agent blocks an objective nothing measures", () => {
  const submission = cleanSubmission();
  // Drop every item for o4, leaving it sourced but unmeasured. The source is
  // deliberately left citing o4: removing the citation as well would trip the
  // earlier Evidence gate, and this test is meant to isolate the Curriculum one.
  submission.items = submission.items.filter((item) => item.objectiveId !== "o4");

  const { report } = runPipeline(submission, NOW);

  assert.equal(report.haltedAt, "curriculum");
  assert.ok(codes(report).includes("CURRICULUM-005"));
});

test("the question agent blocks a key that points at a missing option", () => {
  const submission = cleanSubmission();
  replaceItem(submission, "o1-i1", { correctOptionIds: ["z"] });

  const { report } = runPipeline(submission, NOW);

  assert.equal(report.haltedAt, "question");
  assert.ok(codes(report).includes("QUESTION-011"));
});

test("the question agent blocks an MCQ with two correct options", () => {
  const submission = cleanSubmission();
  replaceItem(submission, "o1-i1", { correctOptionIds: ["a", "b"] });

  const { report } = runPipeline(submission, NOW);

  assert.equal(report.haltedAt, "question");
  assert.ok(codes(report).includes("QUESTION-006"));
});

test("a numeric item with no tolerance is ungradable and blocks", () => {
  const submission = cleanSubmission();
  // Retype the item and drop its tolerance, which is what makes it ungradable.
  replaceItem(submission, "o1-i1", {
    kind: "numeric",
    optionIds: undefined,
    correctOptionIds: undefined,
    numericAnswer: 3,
    tolerance: undefined,
  });

  const { report } = runPipeline(submission, NOW);

  assert.equal(report.haltedAt, "question");
  assert.ok(codes(report).includes("QUESTION-009"));
});

test("a run is reproducible: the same submission yields the same report", () => {
  const first = runPipeline(cleanSubmission(), NOW).report;
  const second = runPipeline(cleanSubmission(), NOW).report;

  assert.deepEqual(first.results, second.results);
  assert.deepEqual(first.completedStages, second.completedStages);
  assert.equal(first.decision, second.decision);
});

test("a pipeline run does not mutate the caller's source array", () => {
  const submission = cleanSubmission();
  const before = JSON.stringify(submission.sources);

  runPipeline(submission, NOW);

  assert.equal(JSON.stringify(submission.sources), before);
});

test("warnings do not halt the pipeline", () => {
  // One item per objective is thin coverage, but thin coverage is only a
  // warning: the run must still reach a release decision.
  const submission = cleanSubmission();
  submission.items = OBJECTIVES.map((objective) => ({
    id: `${objective.id}-only`,
    kind: "mcq",
    objectiveId: objective.id,
    points: 1,
    optionIds: ["a", "b", "c"],
    correctOptionIds: ["a"],
    rationale: "Only one item for this objective.",
  }));

  const { report } = runPipeline(submission, NOW);

  assert.ok(report.totalWarnings > 0, "the run should record warnings");
  assert.equal(report.decision, "AWAITING_APPROVAL", `unexpected blockers: ${codes(report).join(", ")}`);
  assert.equal(report.haltedAt, undefined);
});

test("validation blocks when an upstream gate produced no artifact", () => {
  // A stage that silently failed to publish is exactly the case the Validation
  // Agent exists to catch, so drive the agents directly rather than the engine.
  const submission = cleanSubmission();
  runUpTo(submission, "software-engineering");
  assert.ok(submission.stageArtifacts["assessment-governance"], "precondition");
  delete submission.stageArtifacts["assessment-governance"];

  const validationAgent = PIPELINE.find((a) => a.stage === "validation")!;
  const result = validationAgent.run(submission, NOW);

  assert.equal(result.passed, false);
  assert.ok(result.findings.some((f) => f.code === "VALIDATION-001"));
});

test("release refuses when the engineering gate did not clear", () => {
  const submission = cleanSubmission();
  runUpTo(submission, "software-engineering");
  // Break referential integrity after the gates that would have caught it.
  submission.items.push({
    id: "ghost",
    kind: "mcq",
    objectiveId: "does-not-exist",
    points: 1,
    optionIds: ["a", "b"],
    correctOptionIds: ["a"],
    rationale: "Targets a missing objective.",
  });

  const engineering = PIPELINE.find((a) => a.stage === "software-engineering")!;
  assert.equal(engineering.run(submission, NOW).passed, false);

  const release = PIPELINE.find((a) => a.stage === "release")!;
  const result = release.run(submission, NOW);

  assert.equal(result.passed, false);
  assert.ok(result.findings.some((f) => f.code === "RELEASE-001"));
  assert.equal((submission.stageArtifacts.release as { decision: string }).decision, "HELD");
});
