import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import type { Principal } from "./auth.ts";

/**
 * OIDC verification for per-person approvals.
 *
 * Everything here is provider-agnostic: issuer, audience, JWKS URL, permitted
 * algorithms and the approver claim all come from configuration, so moving to a
 * different identity provider needs no code change.
 *
 * All signature, issuer, audience and expiry checking is delegated to `jose`.
 * The security-sensitive part we deliberately do NOT hand-roll is JWKS
 * resolution: key selection by `kid`, `alg`, `use` and `key_ops`, plus refetch on
 * an unknown key so rotation works without a redeploy.
 *
 * The key resolver is injected. Production passes `createRemoteJWKSet`; tests
 * pass an offline fixture, so CI never depends on a live identity provider.
 */

/**
 * Signature algorithms we accept. Narrow on purpose: never `none`, and never a
 * symmetric algorithm, because a shared secret would let anyone who knows it
 * mint an approval.
 */
export const PERMITTED_ALGS = ["RS256", "RS384", "RS512", "ES256", "ES384"] as const;

/** Verified identity, derived only from the token's registered claims. */
export interface VerifiedIdentity {
  /** Immutable identity: `<issuer>#<subject>`. Never display data. */
  actor: string;
  /** OIDC `iss` — the issuer that authenticated this person. */
  issuer: string;
  /** OIDC `sub` — the stable, immutable subject id within that issuer. */
  subject: string;
  /** Display-only. Never used for authorisation or as the actor. */
  displayName?: string;
  /** Display-only. Never used for authorisation or as the actor. */
  email?: string;
  /** When the token authenticated (epoch ms), for the audit record. */
  authenticatedAt: string;
  /** `jti`, when present. Recorded for replay investigation. */
  jti?: string;
  /** The `nonce` claim, which must equal the run-bound approval nonce. */
  nonce?: string;
}

/** Why a token was refused. Every value means no approval was produced. */
export type OidcRejection =
  | "CONFIG_MISSING"
  | "TOKEN_MISSING"
  | "TOKEN_INVALID"
  | "SIGNATURE_INVALID"
  | "EXPIRED"
  | "ALGORITHM_NOT_PERMITTED"
  | "ROLE_MISSING"
  | "NONCE_MISMATCH";

export type OidcOutcome =
  | { ok: true; identity: VerifiedIdentity; principal: Principal }
  | { ok: false; reason: OidcRejection; message: string };

/** OIDC settings, all required. Absence is a refusal, never a default. */
export interface OidcConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
  /** Claim carrying the approver role/group, e.g. `roles` or `groups`. */
  roleClaim: string;
  /** Values in `roleClaim` that may approve. Empty means nobody may. */
  approverRoles: string[];
}

/** Reads OIDC settings from an env bag, failing closed on anything missing. */
export function readOidcConfig(
  env: Record<string, string | undefined>,
): { kind: "OK"; config: OidcConfig } | { kind: "CONFIG_MISSING"; missing: string[] } {
  const issuer = env.OIDC_ISSUER?.trim();
  const audience = env.OIDC_AUDIENCE?.trim();
  const jwksUrl = env.OIDC_JWKS_URL?.trim();
  const roleClaim = env.OIDC_ROLE_CLAIM?.trim();
  const approverRoles = (env.OIDC_APPROVER_ROLES ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  const missing: string[] = [];
  if (!issuer) missing.push("OIDC_ISSUER");
  if (!audience) missing.push("OIDC_AUDIENCE");
  if (!jwksUrl) missing.push("OIDC_JWKS_URL");
  if (!roleClaim) missing.push("OIDC_ROLE_CLAIM");
  // An empty allowlist must never mean "everyone": that would make any valid
  // token an approver.
  if (approverRoles.length === 0) missing.push("OIDC_APPROVER_ROLES");

  if (missing.length > 0) return { kind: "CONFIG_MISSING", missing };

  return {
    kind: "OK",
    config: {
      issuer: issuer!,
      audience: audience!,
      jwksUrl: jwksUrl!,
      roleClaim: roleClaim!,
      approverRoles,
    },
  };
}

/** Extracts the bearer token, if present. */
export function bearerToken(authorization: string | null): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  return match?.[1]?.trim() || null;
}
/**
 * Verifies a token and authorises the holder.
 *
 * `now` is injected so expiry behaviour is testable without waiting, and
 * `getKey` is injected so tests never reach the network.
 */
export async function verifyApprovalIdentity(options: {
  token: string | null;
  config: OidcConfig;
  getKey: JWTVerifyGetKey;
  /** Epoch milliseconds. Injected for deterministic expiry tests. */
  now: number;
  /** The run-bound approval nonce this token must carry. */
  expectedNonce: string;
}): Promise<OidcOutcome> {
  const { token, config, getKey, now, expectedNonce } = options;

  if (!token) {
    return { ok: false, reason: "TOKEN_MISSING", message: "No bearer token was presented." };
  }

  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, getKey, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: [...PERMITTED_ALGS],
      currentDate: new Date(now),
    });
    payload = verified.payload as Record<string, unknown>;
  } catch (cause) {
    // jose's error codes are stable and specific; mapping them keeps the refusal
    // reason useful without re-implementing any of the checking.
    const code = (cause as { code?: string })?.code;
    const message = cause instanceof Error ? cause.message : String(cause);

    if (code === "ERR_JWT_EXPIRED") {
      return { ok: false, reason: "EXPIRED", message };
    }
    if (code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || code === "ERR_JWKS_NO_MATCHING_KEY") {
      return { ok: false, reason: "SIGNATURE_INVALID", message };
    }
    if (code === "ERR_JOSE_ALG_NOT_ALLOWED") {
      return { ok: false, reason: "ALGORITHM_NOT_PERMITTED", message };
    }
    return { ok: false, reason: "TOKEN_INVALID", message };
  }

  const subject = typeof payload.sub === "string" ? payload.sub : "";
  if (!subject) {
    return {
      ok: false,
      reason: "TOKEN_INVALID",
      message: "The token carries no `sub` claim, so it identifies no person.",
    };
  }

  // Role/allowlist is checked AFTER authentication, never before: an
  // unauthenticated claim proves nothing.
  const rawRoles = payload[config.roleClaim];
  const roles = Array.isArray(rawRoles)
    ? rawRoles.map(String)
    : typeof rawRoles === "string"
      ? [rawRoles]
      : [];

  if (!roles.some((role) => config.approverRoles.includes(role))) {
    return {
      ok: false,
      reason: "ROLE_MISSING",
      message: `Subject "${subject}" does not hold an approver role (${config.roleClaim}).`,
    };
  }

  // Replay control: the token must carry the nonce this run issued. Without it
  // a captured token could authorise a different run, or be reused.
  const nonce = typeof payload.nonce === "string" ? payload.nonce : undefined;
  if (!nonce || nonce !== expectedNonce) {
    return {
      ok: false,
      reason: "NONCE_MISMATCH",
      message: "The token's nonce does not match this run's approval nonce.",
    };
  }

  const issuer = typeof payload.iss === "string" ? payload.iss : config.issuer;

  const identity: VerifiedIdentity = {
    // The actor is built from registered claims only. Never the email or name:
    // an issuer may let a user change both, so neither is an identity.
    actor: `${issuer}#${subject}`,
    issuer,
    subject,
    authenticatedAt: new Date(now).toISOString(),
    ...(typeof payload.name === "string" ? { displayName: payload.name } : {}),
    ...(typeof payload.email === "string" ? { email: payload.email } : {}),
    ...(typeof payload.jti === "string" ? { jti: payload.jti } : {}),
    ...(nonce ? { nonce } : {}),
  };

  return { ok: true, identity, principal: { actor: identity.actor, token, identity } };
}

/**
 * Builds the cached remote JWKS resolver, once per Worker isolate.
 *
 * `createRemoteJWKSet` caches keys and refetches when it meets an unknown
 * `kid`, so key rotation works without a redeploy or a manual cache flush.
 */
export function remoteJwks(config: OidcConfig): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(config.jwksUrl));
}