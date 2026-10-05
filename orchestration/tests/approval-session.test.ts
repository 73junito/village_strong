import assert from "node:assert/strict";
import test from "node:test";

import {
  SESSION_TTL_MS,
  checkApprovalSession,
  consumeSession,
  createApprovalSession,
  verifyNonce,
  verifyState,
} from "../src/approval-session.ts";
import { generatePkce, s256Challenge, sha256Hex, timingSafeEqual } from "../src/pkce.ts";

const NOW = 1_760_000_000_000;

test("creates a run-bound session with hashed nonce and state", async () => {
  const { session, issued } = await createApprovalSession("run-a", NOW);

  assert.equal(session.runId, "run-a");
  assert.equal(session.consumedAt, null);
  assert.equal(session.createdAt, NOW);
  assert.equal(session.expiresAt, NOW + SESSION_TTL_MS);

  // The stored record must not contain the plaintext secrets.
  assert.notEqual(session.nonceHash, issued.nonce);
  assert.notEqual(session.stateHash, issued.state);
  assert.equal(session.nonceHash, await sha256Hex(issued.nonce));
  assert.equal(session.stateHash, await sha256Hex(issued.state));

  // The PKCE verifier is stored in the clear: the exchange must send it verbatim.
  assert.equal(session.pkceChallenge, issued.pkceChallenge);
  assert.equal(session.pkceChallenge, await s256Challenge(session.pkceVerifier));
});

test("issued values are high entropy and URL safe", async () => {
  const a = await createApprovalSession("run-a", NOW);
  const b = await createApprovalSession("run-a", NOW);

  // Two sessions for one run must never collide.
  assert.notEqual(a.issued.nonce, b.issued.nonce);
  assert.notEqual(a.issued.state, b.issued.state);
  assert.notEqual(a.session.pkceVerifier, b.session.pkceVerifier);

  for (const value of [a.issued.nonce, a.issued.state, a.issued.pkceChallenge]) {
    assert.match(value, /^[A-Za-z0-9_-]+$/, "must be base64url and unpadded");
    assert.ok(value.length >= 43, "RFC 7636 minimum verifier entropy");
  }
});

test("a valid state passes and a wrong state fails without consuming", async () => {
  const { session, issued } = await createApprovalSession("run-a", NOW);

  assert.equal(checkApprovalSession(session, issued.state, NOW).ok, true);
  assert.equal(await verifyState(session, issued.state), true);

  // A wrong state is refused, but leaves the session spendable so the reviewer
  // can correct the flow and retry.
  assert.equal(await verifyState(session, "some-other-state"), false);
  assert.equal(session.consumedAt, null);
});

test("a nonce from another run is refused", async () => {
  const a = await createApprovalSession("run-a", NOW);
  const b = await createApprovalSession("run-b", NOW);

  // A nonce legitimately issued for run A must not verify against run B.
  assert.equal(await verifyNonce(b.session, a.issued.nonce), false);
  assert.equal(await verifyNonce(a.session, a.issued.nonce), true);
});

test("an expired session is refused", async () => {
  const { session } = await createApprovalSession("run-a", NOW);

  assert.equal(checkApprovalSession(session, "s", NOW + SESSION_TTL_MS - 1).ok, true);

  const expired = checkApprovalSession(session, "s", NOW + SESSION_TTL_MS);
  assert.equal(expired.ok, false);
  assert.equal(expired.ok === false && expired.reason, "EXPIRED");
});

test("a consumed session is refused and cannot be revived", async () => {
  const { session } = await createApprovalSession("run-a", NOW);
  const spent = consumeSession(session, NOW + 1000);

  assert.equal(spent.consumedAt, NOW + 1000);

  const attempt = checkApprovalSession(spent, "s", NOW + 1001);
  assert.equal(attempt.ok, false);
  assert.equal(attempt.ok === false && attempt.reason, "ALREADY_CONSUMED");

  // Consumption is one-way: nothing clears consumedAt.
  const again = consumeSession(spent, NOW + 2000);
  assert.equal(again.consumedAt, NOW + 1000);
});

test("a missing session is refused", () => {
  for (const session of [null, undefined]) {
    const check = checkApprovalSession(session, "s", NOW);
    assert.equal(check.ok, false);
    assert.equal(check.ok === false && check.reason, "NO_SESSION");
  }
});

test("PKCE challenge is the S256 transform and is not plain", async () => {
  const { verifier, challenge } = await generatePkce();

  assert.equal(await s256Challenge(verifier), challenge);
  assert.notEqual(verifier, challenge);
  assert.equal(challenge, await s256Challenge(verifier));
});

test("timingSafeEqual compares exactly", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
  assert.equal(timingSafeEqual("abc", "abd"), false);
  assert.equal(timingSafeEqual("abc", "ab"), false);
  assert.equal(timingSafeEqual("", ""), true);
});