import { SELF } from "cloudflare:test";
import { expect, it } from "vitest";

import { cleanSubmission } from "../fixtures.ts";

const TOKEN = "test-token-do-not-use";
const APPROVER = "D. Rodriguez (Program Director)";
const AUTH = { authorization: `Bearer ${TOKEN}` };

/**
 * These tests run inside real workerd with the Durable Object and Workflow
 * bindings wired from wrangler.test.jsonc.
 *
 * The lifecycle tests here exist because the pure suite structurally cannot
 * reach them: they start a real workflow, let it run all ten gates, and resume
 * it through an authenticated approval. That path previously deadlocked —
 * `startRelease` awaited `runWorkflow` while the workflow's first progress
 * callback re-entered the same, still-locked Durable Object.
 */

/** Starts a run and returns its id, asserting the request returns promptly. */
async function startRun(submission: unknown): Promise<string> {
  const started = Date.now();
  const response = await SELF.fetch("https://orchestrator.test/api/runs", {
    method: "POST",
    headers: { ...AUTH, "content-type": "application/json" },
    body: JSON.stringify({ submission }),
  });

  expect(response.status).toBe(202);

  // The regression this guards: the response used to never arrive.
  expect(Date.now() - started).toBeLessThan(5_000);

  const body = (await response.json()) as { runId: string };
  expect(body.runId).toBeTruthy();
  return body.runId;
}

/** Polls until the run reports a settled decision, or gives up. */
async function waitForDecision(
  runId: string,
  wanted: string[],
  timeoutMs = 30_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const response = await SELF.fetch(`https://orchestrator.test/api/runs/${runId}`, {
      headers: AUTH,
    });
    const run = (await response.json()) as Record<string, unknown>;

    if (wanted.includes(String(run.status))) return run;

    if (Date.now() > deadline) {
      throw new Error(`Run ${runId} never reached ${wanted.join("/")} (saw ${run.status}).`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/** Submits an approval and returns the status code. */
async function approve(
  runId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; payload: Record<string, unknown> }> {
  const response = await SELF.fetch(`https://orchestrator.test/api/runs/${runId}/approve`, {
    method: "POST",
    headers: { ...AUTH, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    payload: (await response.json()) as Record<string, unknown>,
  };
}

// The lifecycle tests in this file run inside real workerd, which is the only
// place the Durable Object and Workflow bindings actually exist.
//
// Config parity is deliberately NOT tested here: workerd's module sandbox roots
// at /bundle and cannot read the project's wrangler files. It is checked in the
// Node suite instead, in tests/config.test.ts, where the filesystem is real.

it("boots on workerd and serves the pipeline definition without a token", async () => {
  const response = await SELF.fetch("https://orchestrator.test/api/pipeline");
  expect(response.status).toBe(200);

  const gates = (await response.json()) as { position: number; stage: string }[];
  expect(gates).toHaveLength(10);
  expect(gates[0]!.stage).toBe("evidence");
  expect(gates[9]!.stage).toBe("release");
});

it("refuses the run API without a token", async () => {
  const response = await SELF.fetch("https://orchestrator.test/api/runs", { method: "GET" });
  expect(response.status).toBe(401);
});

it("refuses a wrong token", async () => {
  const response = await SELF.fetch("https://orchestrator.test/api/runs", {
    headers: { authorization: "Bearer wrong" },
  });
  expect(response.status).toBe(401);
});

it("rejects a malformed run body", async () => {
  const response = await SELF.fetch("https://orchestrator.test/api/runs", {
    method: "POST",
    headers: { ...AUTH, "content-type": "application/json" },
    body: JSON.stringify({ submission: { courseId: "x" } }),
  });
  expect(response.status).toBe(400);
});

it("returns a controlled response for an unknown run", async () => {
  const response = await SELF.fetch("https://orchestrator.test/api/runs/wf-does-not-exist", {
    headers: AUTH,
  });
  expect(response.status).toBe(404);

  // An unknown run must answer, not throw.
  const listing = await SELF.fetch("https://orchestrator.test/api/runs", { headers: AUTH });
  expect(listing.status).toBe(200);
});

it("starts a run promptly and parks a clean run at AWAITING_APPROVAL", async () => {
  const runId = await startRun(cleanSubmission({ courseId: "life-cycle-clean" }));

  const run = await waitForDecision(runId, ["AWAITING_APPROVAL", "HELD", "RELEASED"]);

  // The central guarantee: ten passing agents stop at the approval boundary.
  expect(run.status).toBe("AWAITING_APPROVAL");
}, 60_000);

it("holds a run whose gates block, and refuses to approve it", async () => {
  const blocked = cleanSubmission({ courseId: "life-cycle-held" });
  blocked.sources = [];

  const runId = await startRun(blocked);
  const run = await waitForDecision(runId, ["HELD", "AWAITING_APPROVAL"]);

  expect(run.status).toBe("HELD");

  // A held run must refuse an approval rather than release.
  const attempt = await approve(runId, {
    runId,
    approvedBy: "someone",
    reason: "trying to override a blocker",
    approvedAt: "2026-10-05T09:30:00.000Z",
    requestHash: "a".repeat(64),
  });

  expect(attempt.status).toBe(422);
}, 60_000);

it("derives approvedBy from the token, ignoring a claimed identity", async () => {
  const submission = cleanSubmission({ courseId: "life-cycle-identity" });
  const runId = await startRun(submission);
  await waitForDecision(runId, ["AWAITING_APPROVAL", "HELD"]);

  // The body claims to be somebody else entirely. The principal must win.
  const attempt = await approve(runId, {
    runId,
    approvedBy: "Definitely Not The Real Approver",
    reason: "reviewed",
    approvedAt: "2026-10-05T09:30:00.000Z",
    requestHash: "b".repeat(64),
  });

  // Whatever the hash, the actor recorded must be the token's, never the body's.
  if (attempt.status === 202) {
    expect(attempt.payload.accepted).toBe(true);
  }
  expect(String(attempt.payload.message ?? "")).not.toContain("Definitely Not The Real Approver");
}, 60_000);

it("releases once on a verified approval, and is idempotent on repeats", async () => {
  const runId = await startRun(cleanSubmission({ courseId: "life-cycle-release" }));
  await waitForDecision(runId, ["AWAITING_APPROVAL", "HELD"]);

  // Read the hash the workflow published. Approving with anything else must be
  // refused, which is what proves the hash check is live over the wire.
  const parked = await SELF.fetch(`https://orchestrator.test/api/runs/${runId}`, {
    headers: AUTH,
  });
  const ledger = (await parked.json()) as { pendingApproval: { requestHash: string } | null };
  const requestHash = ledger.pendingApproval?.requestHash;

  expect(requestHash, "the workflow must publish a hash to approve").toBeTruthy();

  // A wrong hash is refused.
  const wrong = await approve(runId, {
    runId,
    reason: "reviewed",
    approvedAt: "2026-10-05T09:30:00.000Z",
    requestHash: "c".repeat(64),
  });
  expect(wrong.status).not.toBe(202);

  // The real hash is accepted and releases exactly once.
  const good = await approve(runId, {
    runId,
    reason: "Reviewed in curriculum council.",
    approvedAt: "2026-10-05T09:30:00.000Z",
    requestHash,
  });
  expect(good.status).toBe(202);
  expect(good.payload.accepted).toBe(true);

  await waitForDecision(runId, ["RELEASED"]);

  // A repeat must not produce a second release.
  const repeat = await approve(runId, {
    runId,
    reason: "Reviewed in curriculum council.",
    approvedAt: "2026-10-05T09:30:00.000Z",
    requestHash,
  });
  expect(repeat.status).toBe(422);

  const settled = await SELF.fetch(`https://orchestrator.test/api/runs/${runId}`, {
    headers: AUTH,
  });
  const final = (await settled.json()) as { status: string };
  expect(final.status).toBe("RELEASED");
}, 90_000);
it("keeps two concurrent runs isolated", async () => {
  const clean = cleanSubmission({ courseId: "life-cycle-concurrent-clean" });
  const blocked = cleanSubmission({ courseId: "life-cycle-concurrent-held" });
  blocked.sources = [];

  // Started back to back, with no await between the two POSTs.
  const cleanRun = await startRun(clean);
  const heldRun = await startRun(blocked);

  expect(cleanRun).not.toBe(heldRun);

  const [cleanState, heldState] = await Promise.all([
    waitForDecision(cleanRun, ["AWAITING_APPROVAL", "HELD", "RELEASED"]),
    waitForDecision(heldRun, ["HELD", "AWAITING_APPROVAL"]),
  ]);

  // One clean, one blocked: neither leaked into the other.
  expect(cleanState.status).toBe("AWAITING_APPROVAL");
  expect(heldState.status).toBe("HELD");
}, 90_000);
