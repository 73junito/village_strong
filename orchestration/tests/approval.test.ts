import assert from "node:assert/strict";
import test from "node:test";

import { acceptApproval, currentDecision, parseApproval } from "../src/approval.ts";
import { computeReviewHash } from "../src/hash.ts";
import { PIPELINE, decideRun, runPipeline } from "../src/pipeline.ts";
import type { ApprovalRecord, PendingApproval, Submission } from "../src/types.ts";

import { NOW, cleanSubmission, codes } from "./fixtures.ts";

/** The run id a paused workflow would report. */
export const RUN_ID = "wf-run-0001";

/**
 * Drives a submission to AWAITING_APPROVAL and returns the submission plus the
 * approval snapshot a workflow would present to a reviewer.
 *
 * The hash is computed after the gates have run and before any approval exists,
 * which is exactly the ordering the durable workflow uses.
 */
export async function pausedRun(
  submission: Submission = cleanSubmission(),
): Promise<{ submission: Submission; pending: PendingApproval }> {
  runPipeline(submission, NOW);

  assert.equal(
    currentDecision(submission),
    "AWAITING_APPROVAL",
    "precondition: the run must be awaiting approval",
  );

  return {
    submission,
    pending: {
      runId: RUN_ID,
      courseId: submission.courseId,
      requestHash: await computeReviewHash(submission),
      decidedAt: NOW.toISOString(),
      completedStages: PIPELINE.map((agent) => agent.stage),
      totalBlockers: 0,
      totalWarnings: 1,
    },
  };
}

/** A fully populated, valid approval for `runId`. */
export function validApproval(runId: string, requestHash: string): ApprovalRecord {
  return {
    runId,
    approvedBy: "D. Rodriguez (Program Director)",
    reason: "Week 1 reviewed in curriculum council; cleared for the pilot cohort.",
    approvedAt: "2026-10-05T09:30:00.000Z",
    requestHash,
  };
}

test("1. a clean run stops at AWAITING_APPROVAL and never self-releases", async () => {
  const { submission, pending } = await pausedRun();

  assert.equal(currentDecision(submission), "AWAITING_APPROVAL");
  // The decision is derived, not asserted: nothing downstream can invent RELEASED.
  assert.equal(decideRun(undefined), "AWAITING_APPROVAL");

  // And the Release Agent's own metrics admit that it released nothing. It has
  // to run after the earlier gates, since its verdict depends on their artifacts.
  const fresh = cleanSubmission();
  runPipeline(fresh, NOW);
  const release = PIPELINE.find((agent) => agent.stage === "release")!;
  const result = release.run(fresh, NOW);
  assert.equal(result.metrics.released, 0);
  assert.equal(result.metrics.awaitingApproval, 1);

  assert.equal(pending.requestHash.length, 64, "expected a hex SHA-256");
});

test("2. a held run never reaches approval", async () => {
  // An uncited objective blocks at Evidence, so the Release Agent never records
  // an approvable verdict in the first place.
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
  assert.equal(currentDecision(submission), null, "the release gate never ran");
  assert.ok(codes(report).includes("EVIDENCE-006"));
});

test("3. a missing approval cannot release", async () => {
  const { submission, pending } = await pausedRun();

  for (const missing of [undefined, null, {}, "", 42, []]) {
    const outcome = await acceptApproval({ submission, pending, approval: missing });
    assert.equal(outcome.ok, false, `${JSON.stringify(missing)} must not release`);
    assert.equal(currentDecision(submission), "AWAITING_APPROVAL");
  }
});

test("4. an approval for a different run id is rejected", async () => {
  const { submission, pending } = await pausedRun();

  const outcome = await acceptApproval({
    submission,
    pending,
    approval: validApproval("wf-some-other-run", pending.requestHash),
  });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "RUN_ID_MISMATCH");
  assert.equal(currentDecision(submission), "AWAITING_APPROVAL");
});

test("5. an approval is rejected once the reviewed request changes", async () => {
  const { submission, pending } = await pausedRun();
  const approval = validApproval(RUN_ID, pending.requestHash);
  // The submission is mutated after the reviewer signed: one item is re-keyed.
  const target = submission.items.find((item) => item.id === "o1-i1");
  assert.ok(target, "precondition: the item to tamper with");
  target.correctOptionIds = ["a"];

  const outcome = await acceptApproval({ submission, pending, approval });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "REQUEST_HASH_MISMATCH");
  assert.equal(currentDecision(submission), "AWAITING_APPROVAL", "no release on a changed request");
});

test("6. a valid approval releases exactly once", async () => {
  const { submission, pending } = await pausedRun();

  const outcome = await acceptApproval({
    submission,
    pending,
    approval: validApproval(RUN_ID, pending.requestHash),
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.ok === true && outcome.duplicate, false);
  assert.equal(outcome.ok === true && outcome.decision, "RELEASED");
  assert.equal(currentDecision(submission), "RELEASED");

  // The full record is retained on the artifact, not just a boolean.
  const artifact = submission.stageArtifacts.release as { approval: ApprovalRecord };
  assert.equal(artifact.approval.approvedBy, "D. Rodriguez (Program Director)");
  assert.equal(artifact.approval.approvedAt, "2026-10-05T09:30:00.000Z");
  assert.equal(artifact.approval.requestHash, pending.requestHash);
});

test("7. a duplicate approval does not produce a second release", async () => {
  const { submission, pending } = await pausedRun();
  const approval = validApproval(RUN_ID, pending.requestHash);

  const first = await acceptApproval({ submission, pending, approval });
  assert.equal(first.ok, true);

  const decidedAt = (submission.stageArtifacts.release as { decidedAt: string }).decidedAt;

  const second = await acceptApproval({ submission, pending, approval });
  assert.equal(second.ok, true);
  assert.equal(second.ok === true && second.duplicate, true, "the repeat must be a no-op");
  // The original record is returned unchanged rather than re-stamped.
  assert.equal(second.ok === true && second.approval.approvedAt, approval.approvedAt);
  assert.equal(
    (submission.stageArtifacts.release as { decidedAt: string }).decidedAt,
    decidedAt,
  );

  // A *different* approval against an already-released run is refused outright.
  const forged = await acceptApproval({
    submission,
    pending,
    approval: { ...approval, approvedBy: "someone-else" },
  });
  assert.equal(forged.ok, false);
  assert.equal(forged.ok === false && forged.reason, "NOT_APPROVABLE");
});

test("8. replay preserves the original artifacts and timestamp", async () => {
  const { submission, pending } = await pausedRun();
  const approval = validApproval(RUN_ID, pending.requestHash);

  await acceptApproval({ submission, pending, approval });

  const artifactBefore = JSON.stringify(submission.stageArtifacts);
  const decidedAtBefore = (submission.stageArtifacts.release as { decidedAt: string }).decidedAt;

  // Replaying the same approval, as a durable step would on resume.
  await acceptApproval({ submission, pending, approval });
  await acceptApproval({ submission, pending, approval });

  // Writing the release artifact must not alter the hash that was approved.
  // That is precisely why the release artifact is excluded from the hash input.
  assert.equal(await computeReviewHash(submission), pending.requestHash);

  assert.equal(
    (submission.stageArtifacts.release as { decidedAt: string }).decidedAt,
    decidedAtBefore,
  );
  assert.equal(JSON.stringify(submission.stageArtifacts), artifactBefore);
  assert.equal(
    (submission.stageArtifacts.release as { approval: ApprovalRecord }).approval.approvedAt,
    "2026-10-05T09:30:00.000Z",
    "the approver's timestamp is preserved verbatim, never re-stamped",
  );
});

test("an approval missing its actor, reason or timestamp is refused", async () => {
  const { submission, pending } = await pausedRun();
  const approval = validApproval(RUN_ID, pending.requestHash);

  const cases: [Partial<ApprovalRecord>, string][] = [
    [{ approvedBy: "  " }, "MISSING_ACTOR"],
    [{ reason: "" }, "MISSING_REASON"],
    [{ approvedAt: "not-a-date" }, "INVALID_TIMESTAMP"],
    [{ runId: "" }, "MALFORMED"],
  ];

  for (const [patch, expected] of cases) {
    const outcome = await acceptApproval({ submission, pending, approval: { ...approval, ...patch } });
    assert.equal(outcome.ok, false, JSON.stringify(patch));
    assert.equal(outcome.ok === false && outcome.reason, expected);
    assert.equal(currentDecision(submission), "AWAITING_APPROVAL");
  }

  // parseApproval is the shared edge used by the API and the workflow alike.
  assert.equal(parseApproval(validApproval(RUN_ID, pending.requestHash)).ok, true);
  assert.equal(parseApproval({}).ok, false);
});

test("the hash ignores key order but detects a changed value", async () => {
  const a = cleanSubmission();
  const b = cleanSubmission();

  assert.equal(await computeReviewHash(a), await computeReviewHash(b));

  b.objectives = b.objectives.map((objective) =>
    objective.id === "o4" ? { ...objective, text: "Changed wording." } : objective,
  );

  assert.notEqual(await computeReviewHash(a), await computeReviewHash(b));
});

test("a held run cannot be approved into a release", async () => {
  // Guards the exact regression this boundary exists to prevent: a held run
  // reaching RELEASED because a verifier checked only the hash, not the state.
  const submission = cleanSubmission({ sources: [] });
  runPipeline(submission, NOW);

  const hash = await computeReviewHash(submission);
  const outcome = await acceptApproval({
    submission,
    pending: {
      runId: RUN_ID,
      courseId: submission.courseId,
      requestHash: hash,
      decidedAt: NOW.toISOString(),
      completedStages: ["evidence"],
      totalBlockers: 1,
      totalWarnings: 0,
    },
    approval: validApproval(RUN_ID, hash),
  });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "NOT_APPROVABLE");
  assert.equal(currentDecision(submission), null);
});
