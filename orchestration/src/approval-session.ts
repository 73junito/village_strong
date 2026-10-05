/**
 * Run-bound approval sessions.
 *
 * A session is the durable state one approval attempt needs: a nonce, an OAuth
 * `state`, a PKCE verifier, and when it was created and when it lapses.
 *
 * Two controls are deliberately separate and neither replaces the other:
 *
 *  - This session stops an authenticated approval being replayed: a nonce is
 *    bound to one run and may be spent once.
 *  - The reviewed-artifact hash (in `approval.ts`) proves *what* the person
 *    approved. A valid session authorises the act, not the content.
 *
 * Pure logic only — no Durable Object, no provider, no HTTP. The ledger that
 * stores a session is `agent.ts`.
 */
import { generatePkce, randomToken, sha256Hex, timingSafeEqual, type PkcePair } from "./pkce.ts";

/** How long a freshly created session stays usable. */
export const SESSION_TTL_MS = 10 * 60 * 1000;

/**
 * A session as stored in the ledger.
 *
 * Only hashes of `nonce` and `state` are kept. Both are secrets in transit: `state`
 * must be unguessable to stop an attacker injecting their own authorization
 * response, and the nonce must be unguessable to stop replay. Hashing means a
 * ledger read cannot reconstruct them.
 *
 * `pkceVerifier` is stored in the clear because the token exchange must send it
 * verbatim; its protection is that it exists only here.
 */
export interface ApprovalSession {
  runId: string;
  nonceHash: string;
  stateHash: string;
  pkceVerifier: string;
  pkceChallenge: string;
  createdAt: number;
  expiresAt: number;
  /** Set on first successful consumption. A second attempt is then refused. */
  consumedAt: number | null;
}

/** The plaintext values handed to the approver once, at session creation. */
export interface IssuedApprovalSession {
  nonce: string;
  state: string;
  pkceChallenge: string;
  expiresAt: number;
}

/** Why a session cannot be used. Every value means no approval proceeds. */
export type SessionRejection =
  | "NO_SESSION"
  | "EXPIRED"
  | "ALREADY_CONSUMED"
  | "STATE_MISMATCH"
  | "NONCE_MISMATCH";

export type SessionCheck =
  | { ok: true; session: ApprovalSession }
  | { ok: false; reason: SessionRejection; message: string };

/**
 * Creates a fresh session bound to `runId`.
 *
 * A new session replaces any previous one, so a restarted attempt invalidates
 * whatever was in flight rather than leaving two live nonces for one run.
 */
export async function createApprovalSession(runId: string, now: number): Promise<{
  session: ApprovalSession;
  issued: IssuedApprovalSession;
}> {
  const nonce = randomToken(32);
  const state = randomToken(32);
  const pkce: PkcePair = await generatePkce();

  const session: ApprovalSession = {
    runId,
    nonceHash: await sha256Hex(nonce),
    stateHash: await sha256Hex(state),
    pkceVerifier: pkce.verifier,
    pkceChallenge: pkce.challenge,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    consumedAt: null,
  };

  return { session, issued: { nonce, state, pkceChallenge: pkce.challenge, expiresAt: session.expiresAt } };
}

/**
 * Checks whether a session may be used right now.
 *
 * `presentedState` is accepted for symmetry with callers but is NOT examined
 * here: a wrong `state` must leave the session spendable so a reviewer can
 * correct the flow and retry, so it is verified separately by `verifyState`.
 *
 * Ordered so the most specific refusal wins. Expiry and prior consumption are
 * checked first, so a spent session cannot be probed.
 */
export function checkApprovalSession(
  session: ApprovalSession | null | undefined,
  _presentedState: string,
  now: number,
): SessionCheck {
  if (!session) {
    return { ok: false, reason: "NO_SESSION", message: "No approval session exists for this run." };
  }

  if (session.consumedAt !== null) {
    return {
      ok: false,
      reason: "ALREADY_CONSUMED",
      message: "This approval session was already used.",
    };
  }

  if (now >= session.expiresAt) {
    return { ok: false, reason: "EXPIRED", message: "This approval session has expired." };
  }

  return { ok: true, session };
}

/**
 * Verifies the presented `state` against the session.
 *
 * Compared by hash and in constant time, so the stored value is never the one
 * that has to be protected and a mismatch cannot be discovered byte by byte.
 *
 * This is deliberately separate from `checkApprovalSession` so a caller can
 * reject a wrong `state` without consuming the session: a reviewer who mistypes
 * the flow must be able to retry.
 */
export async function verifyState(session: ApprovalSession, presentedState: string): Promise<boolean> {
  return timingSafeEqual(session.stateHash, await sha256Hex(presentedState));
}

/**
 * Confirms a returned nonce belongs to this session.
 *
 * Guards cross-run replay: a token minted for run A cannot approve run B, even
 * if it is otherwise perfectly valid.
 */
export async function verifyNonce(session: ApprovalSession, presentedNonce: string): Promise<boolean> {
  return timingSafeEqual(session.nonceHash, await sha256Hex(presentedNonce));
}

/**
 * Marks a session consumed and returns the stored copy.
 *
 * Idempotent and one-way. `consumedAt` is only ever set, never rewritten, so
 * calling this twice cannot move the timestamp, and nothing can clear it. That
 * matters because the ledger's atomicity guarantee means a second caller
 * *reaches* this function with an already-consumed session whenever two
 * callbacks race.
 */
export function consumeSession(session: ApprovalSession, now: number): ApprovalSession {
  if (session.consumedAt !== null) return session;

  return { ...session, consumedAt: now };
}