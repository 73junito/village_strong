/**
 * Static claim detection (advisory-only, offline-first).
 *
 * Scans course source records and supplied public-site content for prohibited
 * claims: enrollment open, credentials, state approval, partner endorsement,
 * research participation, fees, or demonstrated outcomes. This module never
 * fetches a URL, never touches the network, and never proposes a release
 * decision. It only produces structured, source-referenced candidates for a
 * separately reviewed policy gate to adjudicate.
 *
 * Detection is exact-phrase matching, deliberately narrow to keep false
 * positives low: a broad keyword match would bury a reviewer in noise and
 * train them to ignore the one finding that mattered.
 */
import type { Source } from "../types.ts";

/**
 * A detected claim, not yet a verdict.
 *
 * `source` is the explicit identifier of the input the claim came from
 * (`source--<id>` for a course source, `content--public-site` for supplied
 * public-site text) so a finding can be traced and re-derived on replay.
 */
export interface ClaimCandidate {
  code: string;
  severity: "blocker" | "warning";
  message: string;
  /** The id of the source record, or `public-site` for supplied content. */
  subject?: string;
  source: string;
}

/** One prohibited-claim category and the exact phrases that trip it. */
interface ClaimRule {
  code: string;
  severity: "blocker" | "warning";
  phrases: readonly string[];
  message: (subject: string) => string;
}

const CLAIM_RULES: ClaimRule[] = [
  {
    code: "CLAIM-ENROLLMENT-OPEN",
    severity: "blocker",
    phrases: ["enrollment open", "now enrolling", "accepting applications", "registration open"],
    message: (s) => `"${s}" claims enrollment is open; confirm the window against the publish schedule.`,
  },
  {
    code: "CLAIM-CREDENTIALS",
    severity: "blocker",
    phrases: ["certificate of completion", "diploma granted", "credentials awarded", "earn a certificate", "earn a diploma"],
    message: (s) => `"${s}" claims a credential is awarded; confirm the awarding body before this ships.`,
  },
  {
    code: "CLAIM-STATE-APPROVAL",
    severity: "blocker",
    phrases: ["state-approved", "state approved", "approved by the state", "state accredited"],
    message: (s) => `"${s}" claims state approval or accreditation; confirm the licence is current.`,
  },
  {
    code: "CLAIM-PARTNER-ENDORSEMENT",
    severity: "blocker",
    phrases: ["endorsed by", "in partnership with", "sponsored by"],
    message: (s) => `"${s}" claims a partner endorsement; confirm each partner has signed off.`,
  },
  {
    // Research participation is not prohibited, but claiming it without review
    // is a warning rather than a blocker: a human must confirm consent and
    // review posture, not an automatic hold.
    code: "CLAIM-RESEARCH-PARTICIPATION",
    severity: "warning",
    phrases: ["participate in research", "join a study", "research participants"],
    message: (s) => `"${s}" mentions research participation; confirm consent and review posture.`,
  },
  {
    code: "CLAIM-FEES",
    severity: "blocker",
    phrases: ["no fees", "free of charge", "tuition-free", "at no cost"],
    message: (s) => `"${s}" makes a claim about fees; confirm it is accurate and current.`,
  },
  {
    code: "CLAIM-OUTCOMES",
    severity: "blocker",
    phrases: ["proven outcomes", "demonstrated outcomes", "guaranteed results", "measured improvement"],
    message: (s) => `"${s}" claims demonstrated outcomes; confirm the evidence supports it.`,
  },
];

/**
 * Detects prohibited claims in one subject.
 *
 * A subject is either a course {@link Source} (its title is scanned) or a
 * supplied public-site content string. Each rule fires at most once per
 * subject, so a sentence stuffed with synonyms of one claim is still a single
 * finding rather than a pile-up.
 */
export function detectClaims(subject: Source | string): ClaimCandidate[] {
  const id = typeof subject === "string" ? "public-site" : subject.id;
  const source = `${typeof subject === "string" ? "content" : "source"}--${id}`;
  const text = (typeof subject === "string" ? subject : subject.title).toLowerCase();

  const found: ClaimCandidate[] = [];
  for (const rule of CLAIM_RULES) {
    if (rule.phrases.some((phrase) => text.includes(phrase))) {
      found.push({
        code: rule.code,
        severity: rule.severity,
        message: rule.message(id),
        subject: id,
        source,
      });
    }
  }
  return found;
}
