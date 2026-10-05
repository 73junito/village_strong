/**
 * The durable orchestration layer.
 *
 * Each of the ten agents is one `step.do()` in a Cloudflare Workflow, so a run
 * survives eviction, resumes after a crash, and never re-executes a gate that
 * already cleared. The gate logic itself lives in `pipeline.ts` and is pure;
 * this module only supplies durability and progress reporting.
 */
import { AgentWorkflow } from "agents/workflows";
import type { AgentWorkflowEvent, AgentWorkflowStep } from "agents/workflows";
import type { WorkflowStepConfig } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import { acceptApproval, type ReleaseArtifact } from "./approval.ts";
import { readArtifact } from "./checks.ts";
import { computeReviewHash } from "./hash.ts";
import { PIPELINE, runAgent, summariseRun, type PipelineAgent } from "./pipeline.ts";
import type {
  ApprovalRecord,
  PendingApproval,
  RunReport,
  StageId,
  StageResult,
  Submission,
} from "./types.ts";
import type { OrchestratorAgent } from "./agent.ts";

/** What a caller supplies to start a run. */
export interface ReleaseRequest {
  submission: Submission;
  /**
   * Optional reviewer note. When set, the Release gate pauses and waits for a
   * human decision, because a release with a human override on it must not be
   * decided by an automated pipeline alone.
   */
  approvalReason?: string;
}

/** Progress payload broadcast to connected clients at each gate boundary. */
export interface GateProgress {
  stage: StageId;
  agent: string;
  /** 1-10, so a client can render a ten-step indicator without hard-coding it. */
  position: number;
  total: number;
  status: "running" | "passed" | "blocked" | "awaiting-approval";
  blockers: number;
  warnings: number;
  message: string;
}

/**
 * How long a cleared run may sit awaiting a human.
 *
 * Long enough for a curriculum council to meet, bounded so an abandoned request
 * cannot wait forever and consume a workflow instance.
 */
const APPROVAL_TIMEOUT = "30 days";

/**
 * Retry policy for a gate.
 *
 * Deliberately shallow. The agents are pure functions over an in-memory
 * submission, so a retry can only help if the failure was transient; anything
 * structural surfaces immediately instead of burning the full budget.
 *
 * Typed as `WorkflowStepConfig` so the duration literals stay literal. Left
 * untyped, `delay` would widen to `string` and no longer match the
 * `` `${number} ${WorkflowDurationLabel}${"s" | ""}` `` pattern.
 */
const GATE_RETRY: WorkflowStepConfig = {
  retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
  timeout: "5 minutes",
};

/** Renders a one-line audit summary of a blocked gate. */
function summarise(result: StageResult): string {
  const first = result.findings.find((finding) => finding.severity === "blocker");
  return first
    ? `${result.agent} blocked the release: ${first.code} ${first.message}`
    : `${result.agent} blocked the release`;
}

export class ReleasePipelineWorkflow extends AgentWorkflow<
  OrchestratorAgent,
  ReleaseRequest,
  GateProgress
> {
  /**
   * Runs the ten gates in order.
   *
   * Exactly one agent executes per durable `step.do()`, so the workflow's own
   * history is the audit trail: a resumed instance replays completed gates from
   * storage instead of re-running them, and re-executes at most the one gate it
   * was interrupted inside.
   */
  async run(
    event: AgentWorkflowEvent<ReleaseRequest>,
    step: AgentWorkflowStep,
  ): Promise<RunReport> {
    const submission = event.payload.submission;
    // Injected, not read from the clock, so replaying a step cannot change an
    // artifact an earlier step already committed.
    const now = new Date(event.timestamp);
    const total = PIPELINE.length;

    const results: StageResult[] = [];
    const completedStages: StageId[] = [];
    let haltedAt: StageId | undefined;
    // Warnings are surfaced to the approver so a clean run with caveats is a
    // visible decision rather than a silent one.
    let warnings = 0;

    for (const [index, agent] of PIPELINE.entries()) {
      if (haltedAt) break;

      const position = index + 1;

      // NOTE: no `reportProgress` inside this loop, deliberately.
      //
      // Each progress signal is an RPC back into the Orchestrator Durable Object.
      // The object that dispatched this workflow is still inside `dispatchRun`,
      // holding its turn until `runWorkflow` settles, so a progress callback
      // arriving here would wait on an object that is itself waiting here. That
      // is the deadlock this loop used to contain. Gate-by-gate progress is
      // therefore derived from the workflow's own durable step history, which
      // `GET /api/runs/:id` reads, rather than pushed from inside the gates.
      //
      // One durable step per gate. Exactly one agent executes here, so a resumed
      // instance re-runs at most the gate it was interrupted inside and replays
      // the rest from storage.
      const result = await step.do(
        `gate-${String(position).padStart(2, "0")}-${agent.stage}`,
        GATE_RETRY,
        async () => runAgent(agent, submission, now),
      );

      results.push(result);
      completedStages.push(agent.stage);

      const stepWarnings = result.findings.filter((f) => f.severity === "warning").length;
      warnings += stepWarnings;

      if (!result.passed) {
        // A blocker ends the run: later agents assume the upstream artifacts
        // are trustworthy, which is exactly what just failed.
        haltedAt = agent.stage;
      }
    }

    if (results.length === 0) {
      // Unreachable in practice: the loop always runs at least one step, and an
      // empty pipeline would be a configuration error worth surfacing loudly.
      throw new NonRetryableError("The release pipeline executed no gates.");
    }

    // A held run stops here. There is no approval path out of HELD: a blocker is
    // a refusal, not a question, and no signature can overrule it.
    if (haltedAt) {
      const report = summariseRun(submission, results, completedStages, haltedAt, now);
      const blocked = results.find((result) => result.stage === haltedAt);

      await step.reportComplete({
        courseId: report.submissionCourseId,
        decision: "HELD",
        haltedAt,
        // Carries the reason into the ledger, so `GET /api/runs/:id` explains
        // itself instead of reporting a bare "HELD".
        message: blocked ? summarise(blocked) : "Held by an earlier gate.",
      });
      return report;
    }

    // Every gate cleared. Compute the hash of exactly what was reviewed, then
    // durably wait for a human. The workflow holds here for as long as the
    // timeout allows, so nothing downstream runs on an unapproved decision.
    const requestHash = await step.do("compute-review-hash", async () =>
      computeReviewHash(submission),
    );

    // Read back what the Release Agent actually recorded rather than assuming
    // it cleared: the approval snapshot must reflect the stored verdict.
    const releaseArtifact = readArtifact<ReleaseArtifact>(submission, "release");

    const pending: PendingApproval = {
      runId: this.workflowId,
      courseId: submission.courseId,
      requestHash,
      decidedAt: releaseArtifact?.decidedAt ?? now.toISOString(),
      completedStages,
      totalBlockers: 0,
      totalWarnings: warnings,
      ...(event.payload.approvalReason
        ? { approvalReason: event.payload.approvalReason }
        : {}),
    };

    // Durable: the approval snapshot is recorded once and replayed verbatim, so a
    // resumed instance presents the reviewer with the same hash it was asked to
    // authorise rather than recomputing it.
    await step.sendEvent({ type: "pending-approval", payload: pending });

    await this.reportProgress({
      stage: "release",
      agent: "Release Agent",
      position: total,
      total,
      status: "awaiting-approval",
      blockers: 0,
      warnings,
      message: `All ten agents cleared. Awaiting a named approval for run ${pending.runId}.`,
    });

    // Durable pause. The instance survives eviction while it waits, and the
    // approval event is recorded, so a replay returns this same payload instead
    // of re-reading a different one.
    //
    // `waitForEvent` is used rather than `waitForApproval` because the latter
    // wraps the payload in the SDK's own envelope, and the approval record must
    // arrive here exactly as it was validated — not reshaped in transit.
    const approvalEvent = await step.waitForEvent<ApprovalRecord>(
      "await-release-approval",
      { type: "release-approval", timeout: APPROVAL_TIMEOUT },
    );

    const outcome = await step.do("accept-approval", async () =>
      acceptApproval({ submission, pending, approval: approvalEvent?.payload }),
    );

    if (!outcome.ok) {
      // Fail closed and loudly. A refused approval leaves the run unreleased and
      // marks the workflow failed, rather than quietly completing as if it had
      // been approved.
      await step.reportError(
        `Approval refused (${outcome.reason}): ${outcome.message}`,
      );
      throw new NonRetryableError(`Approval refused: ${outcome.reason}`, "ApprovalRefused");
    }

    const report = summariseRun(submission, results, completedStages, undefined, now, {
      decision: "RELEASED",
      approval: outcome.approval,
    });

    await step.reportComplete({
      courseId: report.submissionCourseId,
      decision: "RELEASED",
      approvedBy: outcome.approval.approvedBy,
    });

    return report;
  }
}

/** Re-exported so the Worker entry can name the pipeline without a deep import. */
export type { PipelineAgent };