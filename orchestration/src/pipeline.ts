/**
 * The pipeline: the ten agents, in gate order, and the engine that runs them.
 *
 * This module is pure. It imports nothing from Workers, Durable Objects or the
 * Agents SDK, so the whole gate model can be exercised by `node --test` without
 * a Workers runtime. `workflow.ts` wraps this engine in durable steps.
 */
import { evidenceAgent, rightsAgent } from "./agents/admissibility.ts";
import { curriculumAgent, questionAgent } from "./agents/design.ts";
import { instructionalReviewAgent, technicalReviewAgent } from "./agents/reviewers.ts";
import { assessmentGovernanceAgent } from "./agents/governance.ts";
import { releaseAgent } from "./agents/release.ts";
import { softwareEngineeringAgent, validationAgent } from "./agents/shipping.ts";
import type { ApprovalRecord, ReleaseDecision, RunReport, StageId, StageResult, Submission } from "./types.ts";

/**
 * One agent in the pipeline.
 *
 * `run` receives the shared submission and returns its result. Agents append
 * their own artifact to the submission, so the stage order determines what each
 * agent can see.
 */
export interface PipelineAgent {
  stage: StageId;
  /** The agent's title, used in findings and the audit trail. */
  title: string;
  run: (submission: Submission, now: Date) => StageResult;
}

/**
 * The pipeline, in gate order.
 *
 * The order encodes a real dependency, not a preference:
 *  - Evidence and Rights are admissibility gates. Nothing downstream can make an
 *    unsourced objective or an unlicensed photograph acceptable.
 *  - Curriculum and Question define the contract and its realisation.
 *  - The three reviewers judge the same bank from independent mandates.
 *  - Engineering, Validation and Release turn judgement into a ship decision.
 *
 * As a consequence the pipeline short-circuits: once a stage reports a blocker,
 * no later agent runs. Running them anyway would produce findings that read as
 * objections to a release that is already impossible.
 */
export const PIPELINE: readonly PipelineAgent[] = [
  { stage: "evidence", title: "Evidence Agent", run: evidenceAgent },
  { stage: "rights", title: "Rights Agent", run: rightsAgent },
  { stage: "curriculum", title: "Curriculum Agent", run: curriculumAgent },
  { stage: "question", title: "Question Agent", run: questionAgent },
  { stage: "technical-review", title: "Technical Review Agent", run: technicalReviewAgent },
  {
    stage: "instructional-review",
    title: "Instructional Review Agent",
    run: instructionalReviewAgent,
  },
  {
    stage: "assessment-governance",
    title: "Assessment Governance Agent",
    run: assessmentGovernanceAgent,
  },
  {
    stage: "software-engineering",
    title: "Software Engineering Agent",
    run: softwareEngineeringAgent,
  },
  { stage: "validation", title: "Validation Agent", run: validationAgent },
  { stage: "release", title: "Release Agent", run: releaseAgent },
] as const;

/** The gate order, as a plain list of stage ids. */
export const STAGE_ORDER = PIPELINE.map((agent) => agent.stage);

/** Result of running the pipeline to completion (or to a halt). */
export interface PipelineRun {
  report: RunReport;
  /**
   * The submission after every agent has run, including each stage's artifact.
   * Returned so callers can inspect what the gates recorded, not just whether
   * they passed.
   */
  submission: Submission;
}

/**
 * Runs exactly one agent against the submission and returns its result.
 *
 * The workflow calls this once per durable step, so a resumed instance executes
 * only the gate it was interrupted inside. `runPipeline` is defined in terms of
 * it, so the durable path and the in-process path cannot drift apart.
 */
export function runAgent(
  agent: PipelineAgent,
  submission: Submission,
  now: Date,
): StageResult {
  return agent.run(submission, now);
}

/**
 * Runs the pipeline over a submission.
 *
 * `now` is injected rather than read from the clock so that a run is
 * reproducible: replaying a durable step must not change the artifacts that the
 * earlier steps already committed.
 */
export function runPipeline(submission: Submission, now: Date): PipelineRun {
  const results: StageResult[] = [];
  const completedStages: StageId[] = [];
  let haltedAt: StageId | undefined;

  for (const agent of PIPELINE) {
    const result = runAgent(agent, submission, now);
    results.push(result);
    completedStages.push(agent.stage);

    if (!result.passed) {
      // Short-circuit: the first blocker ends the run. Later agents assume the
      // upstream artifacts are trustworthy, which they are not.
      haltedAt = agent.stage;
      break;
    }
  }

  return {
    submission,
    report: summariseRun(submission, results, completedStages, haltedAt, now),
  };
}

/**
 * The decision a run has reached.
 *
 * A run that cleared every gate is NOT released. It is awaiting a human, and only
 * an accepted approval can move it to `RELEASED`. Returning "AWAITING_APPROVAL"
 * from the pure engine is what keeps the CLI, the tests and the workflow from
 * ever claiming an automated release.
 */
export function decideRun(haltedAt: StageId | undefined): ReleaseDecision {
  return haltedAt === undefined ? "AWAITING_APPROVAL" : "HELD";
}

/**
 * Rolls per-stage results up into the terminal report.
 *
 * Shared by the in-process engine and the durable workflow so both produce the
 * same report shape for the same sequence of gate outcomes. `decision` is
 * overridable because only the workflow, after an accepted approval, may claim
 * `RELEASED`.
 */
export function summariseRun(
  submission: Submission,
  results: StageResult[],
  completedStages: StageId[],
  haltedAt: StageId | undefined,
  now: Date,
  overrides: { decision?: ReleaseDecision; approval?: ApprovalRecord } = {},
): RunReport {
  const all = results.flatMap((result) => result.findings);

  return {
    submissionCourseId: submission.courseId,
    decision: overrides.decision ?? decideRun(haltedAt),
    completedStages,
    haltedAt,
    results,
    totalBlockers: all.filter((finding) => finding.severity === "blocker").length,
    totalWarnings: all.filter((finding) => finding.severity === "warning").length,
    startedAt: now.toISOString(),
    finishedAt: now.toISOString(),
    ...(overrides.approval ? { approval: overrides.approval } : {}),
  };
}