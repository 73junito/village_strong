/**
 * Authentication and identity, as pure functions.
 *
 * Split out of the Worker entry so the fail-closed rules can be unit tested
 * directly, under `node --test`, with no Durable Object, no workerd and — most
 * importantly — no mutation of shared Miniflare bindings. An earlier version
 * proved the same rule by overriding `env` inside a workerd test, which leaked
 * into every other test in the file and made the suite order-dependent.
 */

import type { VerifiedIdentity } from "./oidc.ts";

/** The authenticated caller. */
export interface Principal {
  /**
   * The accountable identity written into `approvedBy`, or null when there is
   * no verified identity to attribute the release to.
   *
   * Null is meaningful: it means nobody can be held accountable, and the
   * approval path must refuse rather than invent a placeholder.
   */
  actor: string | null;
  /** The raw token. Never persisted; an audit record keeps claims, not this. */
  token: string;
  /** Present only when the caller authenticated with a verified OIDC token. */
  identity?: VerifiedIdentity;
}

/**
 * Compares two tokens without leaking their contents through timing.
 *
 * A token check that returns early on the first differing character lets an
 * attacker recover the expected value one character at a time, so the loop
 * always runs to completion and folds the difference into an accumulator.
 */
export function tokensMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** The configured approver, normalised to null when absent or blank. */
export function resolveActor(approver: string | undefined): string | null {
  return approver?.trim() || null;
}

/**
 * Why an approval must be refused, or null when it may proceed.
 *
 * Fails closed: with no configured approver there is no accountable person, so
 * an approval signed by a placeholder such as "token-holder" would attribute a
 * release to nobody — the same defect as letting the caller name themselves.
 *
 * Scoped to approval on purpose. Rejecting is always safe and needs no
 * identity, and status reads must stay available so an operator can diagnose
 * why a release is stuck.
 */
export function approvalRefusal(principal: Principal): string | null {
  if (principal.actor) return null;

  return "Approvals are disabled: ORCHESTRATOR_APPROVER is not configured, so no approval could be attributed to a person.";
}