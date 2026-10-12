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
 *
 * Phrases are matched exactly but read in clause context, so a claim that is
 * expressly disclaimed is not flagged. Two negation forms are recognised,
 * both confined to a single clause (never across sentences or unrelated
 * clauses):
 *
 *   - preceding negation: "does not claim demonstrated outcomes"
 *   - short-answer negation: "Is enrollment open? No."
 *
 * This is intentionally conservative: it can under-flag a genuine claim that
 * shares a clause with unrelated negation, but for an advisory checker a
 * false negative that a human still reviews is preferable to a false positive
 * that trains reviewers to ignore the signal.
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
 * A negation cue that, appearing before a claim phrase within the same clause,
 * disclaims it: "does not claim demonstrated outcomes". The `n't` alternative
 * catches every English contraction (doesn't, isn't, won't, can't).
 */
const PRECEDING_NEGATION = /\b(?:not|never|without|nor|neither|cannot)\b|n't\b/;

/**
 * A short denial that answers a yes/no question carrying a claim:
 * "Is enrollment open? No." Matched only at the opening of the clause that
 * immediately follows the question, so it can never reach across sentences.
 */
const SHORT_ANSWER_NEGATION =
  /^(?:no|nope|never|nah|not yet|not currently|not at this time|not right now)\b/i;

/**
 * Splits text into clauses, keeping each clause's trailing terminator so a
 * caller can tell a question ("...?") from a statement ("...", "...").
 */
function splitClauses(text: string): string[] {
  return (
    text
      .match(/[^.!?;\n]+[.!?;\n]*/g)
      ?.map((clause) => clause.trim())
      .filter((clause) => clause.length > 0) ?? []
  );
}

/**
 * True when a claim phrase at `index` inside `clauses[clauseIndex]` is
 * disclaimed by its clause context, and so must not be reported.
 *
 * Two forms, both confined to the immediate clause so negation never bleeds
 * across a sentence boundary or an unrelated clause:
 *   - preceding negation:   "does not claim demonstrated outcomes"
 *   - short-answer negation: "Is enrollment open? No."
 */
function isDisclaimed(clauses: readonly string[], clauseIndex: number, index: number): boolean {
  const clause = clauses[clauseIndex];
  if (!clause) return false;

  if (PRECEDING_NEGATION.test(clause.slice(0, index))) return true;

  if (clause.endsWith("?")) {
    const answer = clauses[clauseIndex + 1];
    if (answer && SHORT_ANSWER_NEGATION.test(answer)) return true;
  }
  return false;
}

/**
 * Detects prohibited claims in one subject.
 *
 * A subject is either a course {@link Source} (its title is scanned) or a
 * supplied public-site content string. Each rule fires at most once per
 * subject, so a sentence stuffed with synonyms of one claim is still a single
 * finding rather than a pile-up. A claim is reported only if at least one of
 * its phrases appears in a clause that does not disclaim it.
 */
export function detectClaims(subject: Source | string): ClaimCandidate[] {
  const id = typeof subject === "string" ? "public-site" : subject.id;
  const source = `${typeof subject === "string" ? "content" : "source"}--${id}`;
  const text = (typeof subject === "string" ? subject : subject.title).toLowerCase();
  const clauses = splitClauses(text);

  const found: ClaimCandidate[] = [];
  for (const rule of CLAIM_RULES) {
    const isClaimed = clauses.some((clause, clauseIndex) =>
      rule.phrases.some((phrase) => {
        const index = clause.indexOf(phrase);
        return index !== -1 && !isDisclaimed(clauses, clauseIndex, index);
      }),
    );
    if (isClaimed) {
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
