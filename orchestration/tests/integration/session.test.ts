import { SELF } from "cloudflare:test";
import { expect, it } from "vitest";

import { cleanSubmission } from "../fixtures.ts";

/**
 * Approval-session ledger, on a real Durable Object.
 *
 * The session primitives are pure and unit tested under `node --test`. What only
 * workerd can prove is the ledger's behaviour on a real Durable Object: that a
 * session is minted only for a parked run, that two concurrent consumptions
 * resolve to exactly one winner, and that a failed attempt leaves the session
 * spendable.
 *
 * Kept separate from `orchestrator.test.ts` so these cases cannot destabilise
 * the lifecycle suite.
 *
 * There is deliberately no authorization URL, callback route or token exchange
 * here — those arrive with the real identity provider.
 */

const TOKEN = "test-token-do-not-use";
const AUTH = { authorization: `Bearer ${TOKEN}` };

/** Starts a run and waits until it stops moving. */
async function run(courseId: string, sources = true) {
  const submission = cleanSubmission({ courseId });
  if (!sources) submission.sources = [];

  const response = await SELF.fetch("https://orchestrator.test/api/runs", {
    method: "POST",
    headers: { ...AUTH, "content-type": "application/json" },
    body: JSON.stringify({ submission }),
  });
  expect(response.status).toBe(202);

  const { runId } = (await response.json()) as { runId: string };

  const deadline = Date.now() + 30_000;
  for (;;) {
    const status = (await (
      await SELF.fetch(`https://orchestrator.test/api/runs/${runId}`, { headers: AUTH })
    ).json()) as { status: string };

    if (status.status !== "queued" && status.status !== "running") return { runId, status: status.status };

    if (Date.now() > deadline) throw new Error(`${runId} never settled (saw ${status.status}).`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

const mint = (runId: string) =>
  SELF.fetch(`https://orchestrator.test/api/runs/${runId}/session`, {
    method: "POST",
    headers: AUTH,
  });

const attempt = (
  runId: string,
  body: Record<string, unknown>,
) =>
  SELF.fetch(`https://orchestrator.test/api/runs/${runId}/approve-session`, {
    method: "POST",
    headers: { ...AUTH, "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.status);

it("mints a run-bound session only for a run awaiting approval", async () => {
  const { runId, status } = await run("session-clean");
  expect(status).toBe("AWAITING_APPROVAL");

  const response = await mint(runId);
  expect(response.status).toBe(200);

  const issued = (await response.json()) as { nonce: string; state: string; pkceChallenge: string };
  expect(issued.nonce.length).toBeGreaterThanOrEqual(43);
  expect(issued.state.length).toBeGreaterThanOrEqual(43);
  expect(issued.pkceChallenge).toMatch(/^[A-Za-z0-9_-]+$/);

  // Re-minting replaces the session rather than leaving two live nonces.
  const again = (await (await mint(runId)).json()) as { nonce: string; state: string };
  expect(again.nonce).not.toBe(issued.nonce);
  expect(again.state).not.toBe(issued.state);
}, 60_000);

it("refuses to mint a session for a held run", async () => {
  const { runId, status } = await run("session-held", false);
  expect(status).toBe("HELD");

  // No nonce for a run nobody may approve.
  expect((await mint(runId)).status).toBe(422);
}, 60_000);

it("refuses to mint a session for an unknown run", async () => {
  expect((await mint("wf-nope")).status).toBe(404);
});

it("a wrong state and a cross-run nonce are both refused", async () => {
  const { runId } = await run("session-crossrun");
  const issued = (await (await mint(runId)).json()) as { nonce: string; state: string };

  expect(await attempt(runId, { state: "wrong-state", nonce: issued.nonce, consume: true })).toBe(422);
  expect(await attempt(runId, { state: issued.state, nonce: "nonce-from-another-run", consume: true })).toBe(422);
}, 60_000);

it("concurrent consumptions resolve to exactly one winner", async () => {
  const { runId } = await run("session-race");
  const issued = (await (await mint(runId)).json()) as { nonce: string; state: string };

  const body = { state: issued.state, nonce: issued.nonce, consume: true };

  // Two callbacks racing for one session, issued together with no await between.
  const results = await Promise.all([attempt(runId, body), attempt(runId, body)]);

  // Exactly one may win; the loser is refused, never silently accepted.
  expect(results.filter((s) => s === 200)).toHaveLength(1);
  expect(results.filter((s) => s === 422)).toHaveLength(1);
}, 60_000);

it("a failed attempt leaves the session spendable so a correct retry succeeds", async () => {
  const { runId } = await run("session-retry");
  const issued = (await (await mint(runId)).json()) as { nonce: string; state: string };

  // Fail first: wrong state, then a foreign nonce.
  expect(await attempt(runId, { state: "wrong", nonce: issued.nonce, consume: true })).toBe(422);
  expect(await attempt(runId, { state: issued.state, nonce: "foreign", consume: true })).toBe(422);

  // The session survived both, so the correct attempt still works...
  expect(await attempt(runId, { state: issued.state, nonce: issued.nonce, consume: true })).toBe(200);

  // ...and is then closed for good.
  expect(await attempt(runId, { state: issued.state, nonce: issued.nonce, consume: true })).toBe(422);
}, 60_000);

it("an expired session is refused", async () => {
  const { runId } = await run("session-expiry");
  const issued = (await (await mint(runId)).json()) as { nonce: string; state: string };

  // Well past the session TTL.
  const farFuture = Date.now() + 60 * 60 * 1000;
  const status = await attempt(runId, {
    state: issued.state,
    nonce: issued.nonce,
    consume: true,
    now: farFuture,
  });

  expect(status).toBe(422);
}, 60_000);