/**
 * Immutable request/artifact hash.
 *
 * An approval authorises a specific set of reviewed content. If the submission or
 * a gate artifact can change after a human signs off, the signature means nothing,
 * so the approval carries a SHA-256 of the exact state the ten agents judged and
 * the release boundary recomputes it before honouring anything.
 *
 * Web Crypto is used deliberately: `crypto.subtle` is available in both Node and
 * workerd, so this module needs no Node builtin and no Workers import, which
 * keeps it testable under plain `node --test`.
 */
import type { Submission } from "./types.ts";

/**
 * Recursively sorts object keys and drops `undefined` values.
 *
 * `JSON.stringify` preserves insertion order, so the same logical submission
 * serialised by two different code paths could hash differently purely because
 * of key ordering. Sorting removes that as a source of false mismatches.
 */
function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, item]) => [key, canonicalise(item)]));
  }

  return value;
}

/** The exact byte sequence the hash covers, for debugging a mismatch. */
export function canonicalReviewPayload(submission: Submission): string {
  const { release: _release, ...reviewedArtifacts } = submission.stageArtifacts;

  // The `release` artifact is deliberately excluded. It records the approval
  // decision itself, so including it would make the hash depend on its own
  // output, and the boundary could never verify a value computed before the
  // artifact was written.
  return JSON.stringify(
    canonicalise({
      courseId: submission.courseId,
      sources: submission.sources,
      assets: submission.assets,
      objectives: submission.objectives,
      items: submission.items,
      priorReviewNotes: submission.priorReviewNotes,
      stageArtifacts: reviewedArtifacts,
    }),
  );
}

/** SHA-256 (hex) of the reviewed submission and gate artifacts. */
export async function computeReviewHash(submission: Submission): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalReviewPayload(submission));
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}