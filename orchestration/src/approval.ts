/**
 * The approval boundary.
 *
 * Everything here is fail-closed: any doubt, inconsistency or missing field means
 * the run does not release. The module is pure and has no Workers import, so the
 * rules below are exercised directly by the test suite rather than only through
 * a live Durable Object.
 */
import { publish, readArtifact } from "./checks.ts";
import { computeReviewHash } from "./hash.ts";
import type {
  ApprovalOutcome,
  ApprovalRecord,
  ApprovalRejection,
  PendingApproval,
  Submission,
} from "./types.ts";

/** What the Release Agent recorded when it reached its verdict. */
export interface ReleaseArtifact {
  decision: "HELD" | "AWAITING_APPROVAL" | "RELEASED";
  courseId: string;
  decidedAt: string;
  /** The approver's timestamp, mirrored here once the run is released. */
  approvedAt?: string;
  approval?: ApprovalRecord;
  approvalRequired?: boolean;
}

function refuse(reason: ApprovalRejection, message: string): ApprovalOutcome {
  return { ok: false, reason, message };
}

/** True only when two approvals are the same decision by the same person. */
function sameApproval(a: ApprovalRecord, b: ApprovalRecord): boolean {
  return (
    a.runId === b.runId &&
    a.requestHash === b.requestHash &&
    a.approvedBy === b.approvedBy &&
    a.reason === b.reason &&
    a.approvedAt === b.approvedAt
  );
}

/**
 * Narrows an untrusted value to an ApprovalRecord, or explains why it is not one.
 *
 * Used both at the HTTP edge and inside the workflow, because a workflow event
 * can arrive from any code path and must not be trusted just because it reached
 * us through our own API.
 */
export function parseApproval(input: unknown):
  | { ok: true; approval: ApprovalRecord }
  | { ok: false; reason: ApprovalRejection; message: string } {
  if (input === null || typeof input !== "object") {
    return refuse("MALFORMED", "An approval must be an object.");
  }

  const raw = input as Record<string, unknown>;

  if (typeof raw.runId !== "string" || !raw.runId.trim()) {
    return refuse("MALFORMED", "`runId` is required.");
  }
  if (typeof raw.requestHash !== "string" || !raw.requestHash.trim()) {
    return refuse("MALFORMED", "`requestHash` is required.");
  }
  if (typeof raw.approvedBy !== "string" || !raw.approvedBy.trim()) {
    return refuse("MISSING_ACTOR", "`approvedBy` is required and must name a person.");
  }
  if (typeof raw.reason !== "string" || !raw.reason.trim()) {
    return refuse("MISSING_REASON", "`reason` is required; an unexplained approval is not reviewable.");
  }
  if (typeof raw.approvedAt !== "string" || !raw.approvedAt.trim()) {
    return refuse("INVALID_TIMESTAMP", "`approvedAt` is required.");
  }
  // Reject an unparseable timestamp rather than storing it: an approval whose
  // time cannot be ordered against the run is not auditable.
  if (Number.isNaN(Date.parse(raw.approvedAt))) {
    return refuse("INVALID_TIMESTAMP", `\`approvedAt\` is not a valid date: ${raw.approvedAt}`);
  }

  return {
    ok: true,
    approval: {
      runId: raw.runId.trim(),
      approvedBy: raw.approvedBy.trim(),
      reason: raw.reason.trim(),
      approvedAt: raw.approvedAt,
      requestHash: raw.requestHash.trim(),
    },
  };
}
/**
 * Verifies an approval against a paused run and, if it holds, releases it.
 *
 * The checks are ordered so the most specific failure is reported first, and
 * every branch either returns a refusal or performs exactly one release.
 */
export async function acceptApproval(options: {
  submission: Submission;
  pending: PendingApproval;
  /** Untrusted: whatever arrived over the wire or on the workflow event. */
  approval: unknown;
}): Promise<ApprovalOutcome> {
  const { submission, pending, approval: raw } = options;

  const parsed = parseApproval(raw);
  if (!parsed.ok) return refuse(parsed.reason, parsed.message);
  const approval = parsed.approval;

  // An approval names exactly one run. Accepting one that targets another would
  // let a signature collected for a clean run authorise a different submission.
  if (approval.runId !== pending.runId) {
    return refuse(
      "RUN_ID_MISMATCH",
      `Approval targets run "${approval.runId}" but this run is "${pending.runId}".`,
    );
  }

  // The hash binds the approval to the content actually reviewed. It is
  // recomputed here rather than trusted from the request, so an approval cannot
  // be carried over to a submission that changed after sign-off.
  const currentHash = await computeReviewHash(submission);
  if (approval.requestHash !== currentHash) {
    return refuse(
      "REQUEST_HASH_MISMATCH",
      "The submission changed after approval was requested; the approval does not apply.",
    );
  }
  if (currentHash !== pending.requestHash) {
    return refuse(
      "REQUEST_HASH_MISMATCH",
      "The reviewed artifacts changed between the request and the approval.",
    );
  }

  const artifact = readArtifact<ReleaseArtifact>(submission, "release");

  // Idempotency. A repeated approval of the same run is a no-op that returns the
  // original record, so replay cannot produce a second release.
  //
  // The comparison is against the WHOLE stored record, not just the run id and
  // hash. Matching on those two alone would let anyone who knows them replay an
  // approval under their own name and have it treated as a harmless duplicate,
  // which would quietly launder a second, unattributed release.
  if (artifact?.decision === "RELEASED") {
    const existing = artifact.approval;
    if (existing && sameApproval(existing, approval)) {
      return { ok: true, duplicate: true, decision: "RELEASED", approval: existing };
    }
    return refuse(
      "NOT_APPROVABLE",
      "This run is already released under a different approval record.",
    );
  }

  // A held run is not approvable. This is the guarantee that a blocker can
  // never be overridden by a human signature.
  if (artifact?.decision !== "AWAITING_APPROVAL") {
    return refuse(
      "NOT_APPROVABLE",
      `This run is "${artifact?.decision ?? "not approved for release"}" and cannot be approved.`,
    );
  }

  publish(submission, "release", {
    ...artifact,
    decision: "RELEASED",
    approvedAt: approval.approvedAt,
    approval,
  } satisfies ReleaseArtifact);

  return { ok: true, duplicate: false, decision: "RELEASED", approval };
}

/** Reads the Release Agent's verdict without trusting the caller's claim. */
export function currentDecision(submission: Submission): ReleaseArtifact["decision"] | null {
  return readArtifact<ReleaseArtifact>(submission, "release")?.decision ?? null;
}
