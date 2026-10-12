/**
 * Fixtures for the advisory policy and claim checker.
 *
 * Kept in their own module rather than in `tests/fixtures.ts` on purpose: these
 * are specific to the policy checker and are advisory-only, so they must never
 * be mistaken for the shared submission fixtures that drive the release
 * pipeline. Like those, this module registers no tests, so it is safe to import
 * under `node --test`.
 */
import type { Submission } from "../src/types.ts";
import type { OfflineLinkCheck } from "../src/agents/policy-links.ts";

/** A stable clock for reproducible reports. */
export const POLICY_NOW = new Date("2026-10-11T00:00:00.000Z");

/** A later clock, used to prove the report clock is injected, not read. */
export const POLICY_LATER = new Date("2027-01-01T00:00:00.000Z");

/** A submission whose single source title carries no prohibited claim. */
export function cleanPolicySubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    courseId: "policy-review-week-1",
    sources: [
      {
        id: "s1",
        title: "Youth mentoring meta-analysis",
        year: 2021,
        peerReviewed: true,
        supports: ["o1"],
      },
    ],
    assets: [],
    objectives: [],
    items: [],
    priorReviewNotes: [],
    stageArtifacts: {},
    ...overrides,
  };
}

/** A submission whose source title claims state approval. */
export function submissionWithClaimInSourceTitle(): Submission {
  return cleanPolicySubmission({
    sources: [
      {
        id: "s-claim",
        title: "State-approved mentoring program",
        year: 2022,
        peerReviewed: false,
        supports: [],
      },
    ],
  });
}

/** Public-site content with no prohibited claim. */
export const CLEAN_CONTENT =
  "This week introduces mentoring basics. Learners practise active listening and set boundaries.";

/** Content that claims enrollment is open. */
export const ENROLLMENT_CONTENT =
  "Enrollment open for the spring cohort. Registration open now for all mentors.";

/** Content that mentions research participation (a warning, not a blocker). */
export const RESEARCH_CONTENT =
  "Mentors and learners participate in research alongside programme staff.";

/** Content carrying two distinct prohibited claims: credentials and fees. */
export const MULTI_CLAIM_CONTENT =
  "Earn a certificate of completion and pay no fees. Our programme is free of charge.";

/** Content that merely mentions a broken link; must NOT trip OUTDATED_LINK. */
export const BROKEN_LINK_MENTION_CONTENT =
  "The old resource page has a broken link and is badly outdated.";

/** Link checks that report every route healthy. */
export const HEALTHY_LINK_CHECKS: OfflineLinkCheck[] = [
  {
    source: "route-manifest@v3",
    linkIndex: 0,
    url: "https://example.org/mentoring",
    route: "/mentoring",
    isMissingOrBroken: false,
  },
];

/** Link checks that report one route missing or broken. */
export const BROKEN_LINK_CHECKS: OfflineLinkCheck[] = [
  {
    source: "route-manifest@v3",
    linkIndex: 0,
    url: "https://example.org/mentoring",
    route: "/mentoring",
    isMissingOrBroken: false,
  },
  {
    source: "route-manifest@v3",
    linkIndex: 1,
    url: "https://example.org/removed",
    route: "/removed",
    isMissingOrBroken: true,
  },
];
