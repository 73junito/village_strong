/**
 * Agent 10: Release.
 *
 * This agent no longer grants a release. It records a verdict and stops.
 *
 * When every gate has cleared it records `AWAITING_APPROVAL` and nothing more. A
 * machine that can reach `RELEASED` on its own makes the human approval boundary
 * decorative, and Village Strong's governance treats an automated release as
 * unsupported by the evidence. Turning `AWAITING_APPROVAL` into `RELEASED`
 * happens only in `approval.ts`, after an explicit, hashed, attributed approval.
 *
 * When anything upstream is unclean it records `HELD`, which is terminal and
 * cannot be approved at all.
 */
import { FindingLog, pass, publish, readArtifact } from "../checks.ts";
import type { StageResult, Submission } from "../types.ts";

export function releaseAgent(submission: Submission, now: Date): StageResult {
  const log = new FindingLog();

  const engineering = readArtifact<{ shippable: boolean }>(submission, "software-engineering");
  const validation = readArtifact<{ valid: boolean }>(submission, "validation");

  // A gate on the gates. Releasing here would launder an upstream failure into
  // a clean-looking decision, so both must be present and true.
  if (!engineering?.shippable) {
    log.blocker(
      "RELEASE-001",
      "Release refused: the Software Engineering Agent has not cleared the build.",
    );
  }

  if (!validation?.valid) {
    log.blocker("RELEASE-002", "Release refused: the Validation Agent has not cleared the record.");
  }

  const decision = log.count("blocker") === 0 ? "AWAITING_APPROVAL" : "HELD";

  if (decision === "HELD") {
    log.info(
      "RELEASE-003",
      "Release is held and cannot be approved; fix the blocker and start a new run.",
    );
  } else {
    log.info("RELEASE-004", "All ten agents cleared. The run is awaiting a named human approval.");
  }

  publish(submission, "release", {
    decision,
    courseId: submission.courseId,
    // The decision time is injected rather than read from the clock so the
    // artifact stays reproducible when a workflow step is replayed.
    decidedAt: now.toISOString(),
    approvalRequired: decision === "AWAITING_APPROVAL",
  });

  return pass("release", "Release Agent", log.findings, {
    awaitingApproval: decision === "AWAITING_APPROVAL" ? 1 : 0,
    // Never 1 from this agent: only an accepted approval may release a run.
    released: 0,
    items: submission.items.length,
    objectives: submission.objectives.length,
    sources: submission.sources.length,
  });
}