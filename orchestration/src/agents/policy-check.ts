/**
 * Policy and claim checker (advisory-only, offline-first).
 *
 * Scans a release packet's course sources and any supplied public-site content
 * for prohibited claims, and records `OUTDATED_LINK` assertions only from
 * supplied offline link-check results or an approved route manifest. It never
 * fetches, follows or validates a URL from static text, and it never makes a
 * network request.
 *
 * This module is advisory. A prohibited claim produces a blocker *finding*; it
 * does not alter the existing release decision. Only a separately reviewed
 * policy gate may convert these findings into a binding verdict, which is why
 * this checker is deliberately not registered in the pipeline and publishes no
 * stage artifact.
 *
 * The clock is injected, not read: `checkedAt` is taken from the caller's
 * `now`, and every finding carries an explicit `source` identifier, so the
 * report is byte-for-byte reproducible during durable-step replay.
 */
import type { Finding, Source, Submission } from "../types.ts";
import { detectClaims } from "./policy-claims.ts";
import { detectOutdatedLinks, type OfflineLinkCheck } from "./policy-links.ts";

/**
 * The output of the policy and claim checker.
 *
 * A standalone, JSON-serializable artifact. It is intentionally NOT a
 * `StageResult` and carries no `decision`: `passed` is an advisory signal
 * meaning "the checker saw no blockers", not a release verdict. Wiring this
 * into the release decision is a separate, reviewed change.
 */
export interface PolicyCheckReport {
  /** Stable id of this checker run/version, stamped for replay and comparison. */
  source: string;
  /** The injected clock value, as ISO-8601. Reproducible on replay. */
  checkedAt: string;
  /** Findings in detection order: claims first (sources, then content), then links. */
  findings: Finding[];
  metrics: {
    /** Blocker-severity prohibited claims detected. */
    prohibitedClaims: number;
    /** Warning-severity claim notes detected. */
    policyWarnings: number;
    /** `OUTDATED_LINK` assertions from supplied checks. */
    outdatedLinks: number;
    /** Subjects reviewed: one per course source, plus one if content was supplied. */
    claimsReviewed: number;
  };
  /** Advisory: `true` when no blocker was seen. Not a release decision. */
  passed: boolean;
}

/** Optional inputs to the checker beyond the submission itself. */
export interface PolicyCheckOptions {
  /** Stable id for this run; defaults to `"policy-check"`. */
  source?: string;
  /** Supplied public-site content to scan. Never fetched; passed in by the caller. */
  content?: string;
  /** Supplied offline link-check results or approved route manifest entries. */
  linkChecks?: readonly OfflineLinkCheck[];
}

/**
 * Runs the advisory policy and claim check over a submission.
 *
 * Pure and non-mutating: it reads `submission.sources` and returns a fresh
 * report. It publishes no artifact and touches no pipeline state, so it cannot
 * change a release decision on its own.
 */
export function runPolicyCheck(
  submission: Submission,
  now: Date,
  options: PolicyCheckOptions = {},
): PolicyCheckReport {
  const findings: Finding[] = [];
  let claimsReviewed = 0;
  let prohibitedClaims = 0;
  let policyWarnings = 0;

  const review = (subject: Source | string): void => {
    claimsReviewed += 1;
    for (const candidate of detectClaims(subject)) {
      if (candidate.severity === "blocker") prohibitedClaims += 1;
      else policyWarnings += 1;
      findings.push(candidate);
    }
  };

  for (const source of submission.sources) review(source);
  if (options.content !== undefined) review(options.content);

  const linkFindings = detectOutdatedLinks(options.linkChecks ?? []);
  findings.push(...linkFindings);

  return {
    source: options.source ?? "policy-check",
    checkedAt: now.toISOString(),
    findings,
    metrics: {
      prohibitedClaims,
      policyWarnings,
      outdatedLinks: linkFindings.length,
      claimsReviewed,
    },
    passed: findings.every((finding) => finding.severity !== "blocker"),
  };
}
