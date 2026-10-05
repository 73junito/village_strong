import assert from "node:assert/strict";
import test from "node:test";

import { approvalRefusal, resolveActor, tokensMatch } from "../src/auth.ts";

/**
 * Authentication and identity rules.
 *
 * These live in the Node suite because `src/auth.ts` is pure. The fail-closed
 * behaviour used to be proven inside the workerd suite by overriding
 * `env.ORCHESTRATOR_APPROVER`, but Miniflare bindings are shared across a test
 * file, so that override leaked into every later test and made the suite
 * order-dependent. Pure functions cannot leak.
 */

test("tokensMatch rejects a wrong or partial token", () => {
  assert.equal(tokensMatch("correct-token", "correct-token"), true);
  assert.equal(tokensMatch("correct-toke", "correct-token"), false);
  assert.equal(tokensMatch("correct-tokenx", "correct-token"), false);
  assert.equal(tokensMatch("wrong-token", "correct-token"), false);
  assert.equal(tokensMatch("", "correct-token"), false);
});

test("resolveActor returns null when the approver is unset or blank", () => {
  assert.equal(resolveActor(undefined), null);
  assert.equal(resolveActor(""), null);
  assert.equal(resolveActor("   "), null);
});

test("resolveActor keeps a configured identity", () => {
  assert.equal(resolveActor("D. Rodriguez (Program Director)"), "D. Rodriguez (Program Director)");
  // Trimmed, so a stray newline in a secret cannot corrupt the audit record.
  assert.equal(resolveActor("  D. Rodriguez  "), "D. Rodriguez");
});

test("approval is refused when no approver identity is configured", () => {
  // The central rule: with no accountable person, nothing may be released.
  // Falling back to a placeholder would attribute a release to nobody, which
  // is the same defect as letting the caller name themselves.
  for (const approver of [undefined, "", "   "]) {
    const refusal = approvalRefusal({ actor: resolveActor(approver), token: "t" });
    assert.ok(refusal, `approver=${JSON.stringify(approver)} must refuse`);
    assert.match(refusal, /ORCHESTRATOR_APPROVER is not configured/);
  }
});

test("approval proceeds only with a real identity", () => {
  const refusal = approvalRefusal({
    actor: resolveActor("D. Rodriguez (Program Director)"),
    token: "t",
  });
  assert.equal(refusal, null);
});