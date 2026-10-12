import assert from "node:assert/strict";
import test from "node:test";

import { runPolicyCheck } from "../src/agents/policy-check.ts";
import {
  BROKEN_LINK_CHECKS,
  BROKEN_LINK_MENTION_CONTENT,
  CLEAN_CONTENT,
  cleanPolicySubmission,
  ENROLLMENT_CONTENT,
  HEALTHY_LINK_CHECKS,
  MULTI_CLAIM_CONTENT,
  POLICY_LATER,
  POLICY_NOW,
  RESEARCH_CONTENT,
  submissionWithClaimInSourceTitle,
} from "./policy-check-fixtures.ts";

function codesOf(findings: { code: string }[]): string[] {
  return findings.map((f) => f.code);
}

test("a clean submission and clean content produce no findings", () => {
  const report = runPolicyCheck(cleanPolicySubmission(), POLICY_NOW, { content: CLEAN_CONTENT });

  assert.deepEqual(report.findings, []);
  assert.equal(report.passed, true);
  assert.deepEqual(report.metrics, {
    prohibitedClaims: 0,
    policyWarnings: 0,
    outdatedLinks: 0,
    claimsReviewed: 2, // one source + one content string
  });
});

test("every finding carries an explicit source identifier", () => {
  const report = runPolicyCheck(cleanPolicySubmission(), POLICY_NOW, {
    content: MULTI_CLAIM_CONTENT,
    linkChecks: BROKEN_LINK_CHECKS,
  });

  assert.ok(report.findings.length > 0);
  for (const finding of report.findings) {
    assert.ok(
      typeof finding.source === "string" && finding.source.length > 0,
      `finding ${finding.code} must name its source`,
    );
  }
});

test("enrollment-open content is a blocker", () => {
  const report = runPolicyCheck(cleanPolicySubmission(), POLICY_NOW, { content: ENROLLMENT_CONTENT });

  assert.equal(report.passed, false);
  assert.equal(report.metrics.prohibitedClaims, 1);
  assert.ok(codesOf(report.findings).includes("CLAIM-ENROLLMENT-OPEN"));
});

test("research participation is a warning, not a blocker", () => {
  const report = runPolicyCheck(cleanPolicySubmission(), POLICY_NOW, { content: RESEARCH_CONTENT });

  assert.equal(report.passed, true, "a warning must not block");
  assert.equal(report.metrics.policyWarnings, 1);
  assert.equal(report.metrics.prohibitedClaims, 0);
  assert.ok(codesOf(report.findings).includes("CLAIM-RESEARCH-PARTICIPATION"));
});

test("multiple claims in one content string are each detected once", () => {
  const report = runPolicyCheck(cleanPolicySubmission(), POLICY_NOW, { content: MULTI_CLAIM_CONTENT });

  assert.equal(report.passed, false);
  assert.equal(report.metrics.prohibitedClaims, 2);
  assert.deepEqual(codesOf(report.findings).sort(), ["CLAIM-CREDENTIALS", "CLAIM-FEES"]);
});

test("a prohibited claim in a source title is detected and traced to that source", () => {
  const report = runPolicyCheck(submissionWithClaimInSourceTitle(), POLICY_NOW);

  assert.equal(report.passed, false);
  assert.equal(report.metrics.prohibitedClaims, 1);
  const finding = report.findings[0];
  assert.ok(finding);
  assert.equal(finding.code, "CLAIM-STATE-APPROVAL");
  assert.equal(finding.source, "source--s-claim");
});

test("supplied link checks drive OUTDATED_LINK; healthy checks are silent", () => {
  const healthy = runPolicyCheck(cleanPolicySubmission(), POLICY_NOW, { linkChecks: HEALTHY_LINK_CHECKS });
  assert.equal(healthy.metrics.outdatedLinks, 0);
  assert.equal(healthy.passed, true);

  const broken = runPolicyCheck(cleanPolicySubmission(), POLICY_NOW, { linkChecks: BROKEN_LINK_CHECKS });
  assert.equal(broken.metrics.outdatedLinks, 1);
  assert.equal(broken.passed, false);
  assert.ok(codesOf(broken.findings).includes("OUTDATED_LINK"));
});

test("OUTDATED_LINK is an offline assertion only: static text never trips it", () => {
  const report = runPolicyCheck(cleanPolicySubmission(), POLICY_NOW, {
    content: BROKEN_LINK_MENTION_CONTENT,
  });

  assert.ok(!codesOf(report.findings).includes("OUTDATED_LINK"));
  assert.deepEqual(report.findings, []);
});

test("the checker is advisory: it publishes no artifact and touches no pipeline state", () => {
  const submission = cleanPolicySubmission();
  const before = JSON.stringify(submission.stageArtifacts);

  const report = runPolicyCheck(submission, POLICY_NOW, { content: MULTI_CLAIM_CONTENT });

  // No stage artifact is written, so the release decision is unchanged.
  assert.equal(JSON.stringify(submission.stageArtifacts), before);
  // The report is not a pipeline verdict: it carries no decision or stage.
  assert.equal("decision" in report, false);
  assert.equal("stage" in report, false);
  assert.equal(report.passed, false, "the advisory signal is still surfaced");
});

test("the clock is injected: checkedAt follows now and findings do not", () => {
  const first = runPolicyCheck(cleanPolicySubmission(), POLICY_NOW, { content: MULTI_CLAIM_CONTENT });
  const second = runPolicyCheck(cleanPolicySubmission(), POLICY_LATER, { content: MULTI_CLAIM_CONTENT });

  assert.equal(first.checkedAt, POLICY_NOW.toISOString());
  assert.equal(second.checkedAt, POLICY_LATER.toISOString());
  assert.notEqual(first.checkedAt, second.checkedAt);
  assert.deepEqual(first.findings, second.findings, "findings must not depend on the clock");
});

test("a run is reproducible: identical inputs yield an identical report", () => {
  const options = { content: MULTI_CLAIM_CONTENT, linkChecks: BROKEN_LINK_CHECKS };
  const first = runPolicyCheck(cleanPolicySubmission(), POLICY_NOW, options);
  const second = runPolicyCheck(cleanPolicySubmission(), POLICY_NOW, options);

  assert.deepEqual(first, second);
});
