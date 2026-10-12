/**
 * Offline link assertion detection (advisory-only).
 *
 * Records `OUTDATED_LINK` only from link-check results or an approved route
 * manifest that the caller supplies. It never fetches a URL, never makes a
 * network request, and never derives a link's status from static text. A
 * sentence that merely mentions a broken link is not evidence; only a supplied
 * check is.
 */
import type { Finding } from "../types.ts";

/**
 * A link-check assertion supplied by an external reviewer or an approved route
 * manifest. Kept offline: this module never performs its own validation.
 */
export interface OfflineLinkCheck {
  /** Stable id of where this result came from (a run id, manifest revision). */
  source: string;
  /** Zero-based index of the link being checked, for traceability. */
  linkIndex: number;
  /** The URL evaluated, for traceability only; never fetched here. */
  url: string;
  /** The route this references, if a route manifest is being checked. */
  route?: string;
  /** `true` when the supplied check reports the route missing, broken or removed. */
  isMissingOrBroken: boolean;
}

/**
 * Converts supplied offline link-check results into findings.
 *
 * `isMissingOrBroken === true` yields a blocker finding for the policy gate to
 * adjudicate; it is not a release veto. `false` is silent: the upstream check
 * is authoritative and there is nothing for this detector to add.
 */
export function detectOutdatedLinks(checks: readonly OfflineLinkCheck[]): Finding[] {
  const findings: Finding[] = [];
  for (const check of checks) {
    if (!check.isMissingOrBroken) continue;
    findings.push({
      code: "OUTDATED_LINK",
      severity: "blocker",
      message: `Link ${check.linkIndex} (${check.url}) is reported missing or broken by ${check.source}.`,
      subject: check.route ?? check.url,
      source: check.source,
    });
  }
  return findings;
}
