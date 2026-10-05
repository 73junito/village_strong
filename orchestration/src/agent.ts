/**
 * The Orchestrator Agent.
 *
 * A Durable Object that owns one release conversation: it starts pipeline runs,
 * tracks their status, and relays gate progress to any connected WebSocket
 * client. The heavy lifting happens in the Workflow; this class exists so there
 * is a stable addressable identity (`orchestrator:<courseId>`) and somewhere to
 * hang approval and audit state.
 */
import { Agent } from "agents";

import { parseApproval } from "./approval.ts";
import { PIPELINE } from "./pipeline.ts";
import type { PendingApproval, ReleaseDecision, ApprovalRejection } from "./types.ts";
import type { ReleaseRequest } from "./workflow.ts";

/** Workflow binding name, which must match `wrangler.jsonc`. */
export const RELEASE_WORKFLOW = "RELEASE_PIPELINE_WORKFLOW";

/**
 * One row of the run ledger.
 *
 * Keyed by run id in `OrchestratorState.runs`, NOT stored as a single "last run",
 * because two runs started back to back must not overwrite one another. A
 * single-row ledger silently answers questions about the wrong run, which is
 * worse than answering nothing.
 */
export interface RunRecord {
  id: string;
  courseId: string;
  status: string;
  decision?: ReleaseDecision;
  haltedAt?: string | null;
  /** Why it was held, carried over from the workflow's completion callback. */
  message?: string;
  pendingApproval: PendingApproval | null;
}

/** The state mirrored to every connected client. */
export interface OrchestratorState {
  courseId: string;
  /** Every run this orchestrator knows about, newest decision last. */
  runs: Record<string, RunRecord>;
}

export class OrchestratorAgent extends Agent<Env, OrchestratorState> {
  /**
   * Reserves a run id in the ledger. Does NOT start the workflow.
   *
   * Split from `dispatchRun` on purpose. A Durable Object handles one request at
   * a time, and the workflow reports gate progress back into THIS object. If a
   * single request both started the workflow and stayed open while it ran, the
   * workflow's first callback would arrive at an object still holding its own
   * lock, and the two would wait on each other until the request was cancelled:
   *
   *     request -> this object (lock held) -> workflow -> reportProgress
   *              -> this object (locked) -> deadlock
   *
   * Two short requests avoid it: this one records the run and returns, and the
   * next one starts the workflow and returns immediately. The lock is free
   * before the workflow needs it.
   */
  async reserveRun(request: ReleaseRequest, runId: string): Promise<{ runId: string }> {
    if (!request.submission?.courseId) {
      throw new Error("A submission must carry a courseId.");
    }

    // Written before the workflow exists, so a run is always addressable even if
    // dispatch never completes.
    await this.setState({
      courseId: request.submission.courseId,
      runs: {
        ...(this.state?.runs ?? {}),
        [runId]: {
          id: runId,
          courseId: request.submission.courseId,
          status: "queued",
          pendingApproval: null,
        },
      },
    });

    return { runId };
  }

  /**
   * Starts the workflow and returns WITHOUT awaiting it.
   *
   * The promise is deliberately not awaited and deliberately not handed to
   * `ctx.waitUntil`: either of those keeps the Durable Object's turn open, which
   * is the deadlock again. Returning straight away releases the lock so the
   * workflow's first `reportProgress` can be serviced.
   *
   * The cost is that the instance may not be created if the object is evicted in
   * the window before `runWorkflow` settles. That window is visible rather than
   * silent: the ledger row stays `queued`, which is what `GET /api/runs/:id`
   * reports.
   */
  dispatchRun(request: ReleaseRequest, runId: string): { dispatched: boolean } {
    // `waitUntil` keeps the instance creation alive past the end of this
    // request. Without it the promise is cancelled the moment the handler
    // returns and the run never starts.
    //
    // It is safe only because the workflow makes NO call back into this object
    // until long after this turn ends: the gate loop below reports nothing, and
    // the first callback is the approval snapshot emitted after all ten gates
    // have completed. That separation is what breaks the cycle, and it is why
    // `runWorkflow` is started here rather than inside the gate loop.
    this.ctx.waitUntil(
      this.runWorkflow(RELEASE_WORKFLOW, request, {
        id: runId,
        metadata: { courseId: request.submission.courseId },
      }),
    );

    return { dispatched: true };
  }

  /**
 * Reads the run ledger for `runId`.
 *
 * The ledger is the authoritative answer to "what does this run say?", because
 * it is written by the workflow's own callbacks. Workflow instance status alone
 * cannot distinguish a run that is genuinely queued from one that never started.
 */

  /**
   * Reads the run ledger for `runId`.
   *
   * The ledger is the authoritative answer to "what does this run say?", because
   * it is written by the workflow's own callbacks. Workflow instance status alone
   * cannot distinguish a run that is genuinely queued from one that never started.
   */
  getLedgerRun(runId: string): RunRecord | null {
    // `this.state` is undefined until the first `setState`, and a GET for an
    // unknown run can arrive before any run has ever been created.
    return this.state?.runs?.[runId] ?? null;
  }

  /** Every known run, so the list endpoint is not limited to the latest. */
  getAllRuns(): RunRecord[] {
    return Object.values(this.state?.runs ?? {});
  }

  /** Applies a partial update to one run, leaving the others untouched. */
  private async patchRun(runId: string, patch: Partial<RunRecord>): Promise<void> {
    const runs = this.state?.runs ?? {};
    const existing = runs[runId];
    if (!existing) return;

    await this.setState({
      ...this.state,
      runs: { ...runs, [runId]: { ...existing, ...patch } },
    });
  }

  /** Recent runs, newest first. */
  async listRuns(limit = 20) {
    return (await this.getAllRuns()).slice(-limit).reverse();
  }

  /** Status of one run's workflow instance, or null when it is not tracked. */
  async getRun(runId: string) {
    return this.getWorkflow(runId) ?? null;
  }

  /**
   * Forwards a human approval to a paused workflow.
   *
   * `principal` is the authenticated caller, resolved from the bearer token at
   * the HTTP edge. It is the ONLY source of `approvedBy`: any `approvedBy` in
   * the request body is overwritten before parsing, because otherwise anyone
   * holding a valid token could sign a release as somebody else.
   *
   * The approval still passes run-id and recomputed-hash checks in the workflow,
   * which remain the real boundary; this method is an early gate that reports a
   * reason instead of waking a Durable Object to fail inside it.
   */
  async approveRun(
    runId: string,
    approval: unknown,
    principal: string,
  ): Promise<{ accepted: boolean; reason?: ApprovalRejection; message?: string }> {
    // Overwrite any claimed identity before it can influence anything.
    const sanitised =
      approval && typeof approval === "object"
        ? { ...(approval as Record<string, unknown>), approvedBy: principal }
        : approval;

    const parsed = parseApproval(sanitised);
    if (!parsed.ok) {
      return { accepted: false, reason: parsed.reason, message: parsed.message };
    }

    if (parsed.approval.runId !== runId) {
      return {
        accepted: false,
        reason: "RUN_ID_MISMATCH",
        message: `Approval targets run "${parsed.approval.runId}", not "${runId}".`,
      };
    }

    // A run that is not parked at the approval boundary cannot be approved.
    // Without this the SDK accepts the event for an already-finished workflow
    // and the API answers 202 "accepted" for a run that will never release — a
    // fail-open at the edge, because the workflow would still refuse while the
    // caller is told their approval landed.
    const ledger = this.getLedgerRun(runId);
    if (!ledger) {
      return { accepted: false, reason: "NOT_APPROVABLE", message: "Unknown run." };
    }
    if (ledger.status !== "AWAITING_APPROVAL") {
      return {
        accepted: false,
        reason: "NOT_APPROVABLE",
        message: `Run ${runId} is "${ledger.status}", not awaiting approval.`,
      };
    }

    // The hash must match what the workflow published. Checked here as well as
    // in the workflow: forwarding a mismatched approval would resume the run
    // only for the workflow to refuse it, which errors the instance and turns a
    // bad request into a destroyed run.
    const expectedHash = ledger.pendingApproval?.requestHash;
    if (!expectedHash || parsed.approval.requestHash !== expectedHash) {
      return {
        accepted: false,
        reason: "REQUEST_HASH_MISMATCH",
        message: "The approval does not match the request this run published.",
      };
    }

    try {
      // Sent as a typed workflow event rather than through `approveWorkflow`,
      // whose envelope reshapes the payload. The record must reach the approval
      // boundary byte-for-byte as it was validated here.
      await this.sendWorkflowEvent(RELEASE_WORKFLOW, runId, {
        type: "release-approval",
        payload: parsed.approval,
      });
    } catch (cause) {
      // The SDK throws when the run is unknown, already finished, or not
      // waiting. None are reasons to fail open, and none should surface as an
      // opaque 500, so the refusal is reported instead.
      return {
        accepted: false,
        reason: "NOT_APPROVABLE",
        message: cause instanceof Error ? cause.message : String(cause),
      };
    }

    await this.patchRun(runId, { status: "approved" });

    return { accepted: true, message: `Approval forwarded for ${principal}.` };
  }

  /** Rejects a pending approval, which ends the run unreleased. */
  async rejectRun(runId: string, reason: string): Promise<{ rejected: boolean; message?: string }> {
    try {
      await this.rejectWorkflow(runId, { reason });
      await this.patchRun(runId, { status: "rejected" });
      return { rejected: true };
    } catch (cause) {
      return {
        rejected: false,
        message: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }

  async onWorkflowComplete(
    _workflowName: string,
    runId: string,
    result?: unknown,
  ): Promise<void> {
    const outcome = result as
      | { decision?: ReleaseDecision; haltedAt?: string | null; message?: string }
      | undefined;

    await this.patchRun(runId, {
      status: outcome?.decision ?? "complete",
      decision: outcome?.decision,
      haltedAt: outcome?.haltedAt ?? null,
      message: outcome?.message,
      // The approval is consumed; clear it so the UI cannot offer a stale one.
      pendingApproval: null,
    });
  }

  /**
   * Receives the approval snapshot the workflow publishes once every gate has
   * cleared.
   *
   * The SDK hands over the event envelope, not the bare payload, so the payload
   * is unwrapped here. Anything that is not a pending-approval event is ignored:
   * a run must only be marked approvable by this one message.
   */
  async onWorkflowEvent(
    _workflowName: string,
    runId: string,
    event: unknown,
  ): Promise<void> {
    const envelope = event as { type?: string; payload?: unknown } | null;
    if (envelope?.type !== "pending-approval") return;

    const pending = envelope.payload as PendingApproval | undefined;
    if (!pending?.requestHash) return;

    await this.patchRun(runId, {
      status: "AWAITING_APPROVAL",
      decision: "AWAITING_APPROVAL",
      pendingApproval: { ...pending, runId },
    });
  }

  async onWorkflowError(_workflowName: string, runId: string, error: string): Promise<void> {
    await this.patchRun(runId, { status: `errored: ${error}` });
  }

  /**
   * The pipeline definition, so a client can render the ten gates without
   * hard-coding their order anywhere.
   */
  describePipeline() {
    return PIPELINE.map((agent, index) => ({
      position: index + 1,
      stage: agent.stage,
      agent: agent.title,
    }));
  }
}

// `Env` is intentionally not declared here. `wrangler types env.d.ts` generates
// the global `Env` interface from wrangler.jsonc, and hand-writing a second one
// would merge with it and produce incompatible-property errors that point at
// this file rather than at the real mismatch.
