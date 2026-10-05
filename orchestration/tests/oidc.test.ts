import assert from "node:assert/strict";
import test from "node:test";

import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";

import { readOidcConfig, verifyApprovalIdentity, type OidcConfig } from "../src/oidc.ts";

/**
 * OIDC verification, proved offline.
 *
 * A real RSA keypair is generated in-process and a real JWKS is published from
 * it, so these tests exercise the same `jwtVerify` path production uses. Nothing
 * here contacts an identity provider, so CI never depends on one.
 */

const ISSUER = "https://idp.test.invalid/";
const AUDIENCE = "village-strong-orchestrator";
const NONCE = "nonce-run-0001";
const NOW = Date.parse("2026-10-05T09:00:00.000Z");

const keys = await generateKeyPair("RS256", { extractable: true });
const publicJwk: JWK = { ...(await exportJWK(keys.publicKey)), kid: "test-key-1", alg: "RS256", use: "sig" };

/**
 * A JWKS resolver over the local key, standing in for the remote one.
 *
 * `createLocalJWKSet` is jose's own resolver, so key selection by `kid`/`alg`/
 * `use` and the unknown-kid path behave exactly as `createRemoteJWKSet` does in
 * production. A hand-rolled stand-in would skip that logic and hide real bugs.
 */
const localJwks = createLocalJWKSet({ keys: [publicJwk] });

const CONFIG: OidcConfig = {
  issuer: ISSUER,
  audience: AUDIENCE,
  jwksUrl: "https://idp.test.invalid/.well-known/jwks.json",
  roleClaim: "roles",
  approverRoles: ["release-approver"],
};

/** Mints a token. Every field can be overridden to build a negative case. */
async function mint(overrides: Record<string, unknown> = {}, opts: { expiresIn?: number } = {}) {
  return new SignJWT({
    nonce: NONCE,
    roles: ["release-approver"],
    name: "Dana Rodriguez",
    email: "dana@village-strong.test",
    jti: "jti-1",
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
    .setIssuer(String(overrides.iss ?? ISSUER))
    .setAudience(String(overrides.aud ?? AUDIENCE))
    .setSubject(String(overrides.sub ?? "user-123"))
    .setIssuedAt(Math.floor(NOW / 1000))
    .setExpirationTime(Math.floor(NOW / 1000) + (opts.expiresIn ?? 3600))
    .sign(keys.privateKey);
}

async function verify(token: string | null, config: OidcConfig = CONFIG, nonce = NONCE) {
  return verifyApprovalIdentity({ token, config, getKey: localJwks, now: NOW, expectedNonce: nonce });
}

test("accepts a valid approver token and derives the actor from iss + sub", async () => {
  const outcome = await verify(await mint());

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  // The actor is built ONLY from registered claims. Email and name are display
  // data an issuer may let a user edit, so neither may appear in the actor.
  assert.equal(outcome.identity.actor, `${ISSUER}#user-123`);
  assert.equal(outcome.identity.issuer, ISSUER);
  assert.equal(outcome.identity.subject, "user-123");

  // Display fields are carried, but separately and clearly labelled.
  assert.equal(outcome.identity.displayName, "Dana Rodriguez");
  assert.equal(outcome.identity.email, "dana@village-strong.test");
  assert.equal(outcome.principal.actor, outcome.identity.actor);
  assert.equal(outcome.identity.authenticatedAt, new Date(NOW).toISOString());
});

test("refuses an expired token", async () => {
  // expiresIn -60 puts `exp` a minute before NOW.
  const outcome = await verify(await mint({}, { expiresIn: -60 }));

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "EXPIRED");
});

test("refuses a wrong issuer", async () => {
  const outcome = await verify(await mint({ iss: "https://evil.test.invalid/" }));

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "TOKEN_INVALID");
});

test("refuses a wrong audience", async () => {
  const outcome = await verify(await mint({ aud: "some-other-service" }));

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "TOKEN_INVALID");
});

test("refuses an invalid signature (identity forgery)", async () => {
  // Signed by a different key: every claim is well formed but the signature
  // does not verify.
  const other = await generateKeyPair("RS256", { extractable: true });
  const forged = await new SignJWT({ nonce: NONCE, roles: ["release-approver"] })
    .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject("attacker")
    .setIssuedAt(Math.floor(NOW / 1000))
    .setExpirationTime(Math.floor(NOW / 1000) + 3600)
    .sign(other.privateKey);

  const outcome = await verify(forged);

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "SIGNATURE_INVALID");
});

test("refuses an unknown kid rather than falling back to any key", async () => {
  const unknownKey = await new SignJWT({ nonce: NONCE, roles: ["release-approver"] })
    .setProtectedHeader({ alg: "RS256", kid: "unknown-key" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject("user-123")
    .setExpirationTime(Math.floor(NOW / 1000) + 3600)
    .sign(keys.privateKey);

  const outcome = await verify(unknownKey);

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "SIGNATURE_INVALID");
});

test("refuses a subject without the approver role", async () => {
  const outcome = await verify(await mint({ roles: ["mentor"] }));

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "ROLE_MISSING");
});

test("refuses a subject with no role claim at all", async () => {
  const outcome = await verify(await mint({ roles: undefined }));

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "ROLE_MISSING");
});

test("refuses a token whose nonce belongs to another run (replay)", async () => {
  const outcome = await verify(await mint(), CONFIG, "nonce-run-different");

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "NONCE_MISMATCH");
});

test("refuses a token carrying no nonce", async () => {
  const outcome = await verify(await mint({ nonce: undefined }));

  assert.equal(outcome.ok, false);
  assert.equal(outcome.ok === false && outcome.reason, "NONCE_MISMATCH");
});

test("refuses a missing or malformed token", async () => {
  assert.equal((await verify(null)).ok, false);
  assert.equal((await verify("")).ok, false);
  assert.equal((await verify("not-a-jwt")).ok, false);

  const missing = await verify(null);
  assert.equal(missing.ok === false && missing.reason, "TOKEN_MISSING");
});

test("configuration fails closed when any OIDC setting is absent", () => {
  const full = {
    OIDC_ISSUER: ISSUER,
    OIDC_AUDIENCE: AUDIENCE,
    OIDC_JWKS_URL: "https://idp.test.invalid/jwks",
    OIDC_ROLE_CLAIM: "roles",
    OIDC_APPROVER_ROLES: "release-approver",
  };

  assert.equal(readOidcConfig(full).kind, "OK");

  for (const key of Object.keys(full)) {
    const result = readOidcConfig({ ...full, [key]: undefined });
    assert.equal(result.kind, "CONFIG_MISSING", `missing ${key} must fail closed`);
    if (result.kind === "CONFIG_MISSING") {
      assert.ok(result.missing.includes(key), `${key} must be named in the refusal`);
    }
  }
});

test("an empty approver allowlist fails closed rather than allowing everyone", () => {
  // The dangerous default: no configured roles must mean nobody, not anybody.
  const result = readOidcConfig({
    OIDC_ISSUER: ISSUER,
    OIDC_AUDIENCE: AUDIENCE,
    OIDC_JWKS_URL: "https://idp.test.invalid/jwks",
    OIDC_ROLE_CLAIM: "roles",
    OIDC_APPROVER_ROLES: "  ,  ",
  });

  assert.equal(result.kind, "CONFIG_MISSING");
  if (result.kind === "CONFIG_MISSING") {
    assert.ok(result.missing.includes("OIDC_APPROVER_ROLES"));
  }
});

test("a non-array role claim is still accepted when it matches", async () => {
  // Some providers emit a single string rather than an array.
  const outcome = await verify(await mint({ roles: "release-approver" }));

  assert.equal(outcome.ok, true);
});

test("the published JWKS fixture exposes no private key material", () => {
  assert.equal(publicJwk.use, "sig");
  assert.equal(publicJwk.kid, "test-key-1");
  assert.equal("d" in publicJwk, false);
  assert.equal("p" in publicJwk, false);
});
