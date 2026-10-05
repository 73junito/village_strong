/**
 * Cryptographic primitives for the approval session.
 *
 * Pure and provider-agnostic: nothing here knows about authorization endpoints,
 * clients or token exchange. It only generates and checks the values a PKCE
 * authorization-code exchange needs.
 *
 * Everything uses Web Crypto, which behaves identically in Node and workerd, so
 * these primitives are unit testable without a Workers runtime.
 */

/**
 * Base64url encoding (RFC 4648 §5), unpadded.
 *
 * Standard base64 is not URL-safe and its `+`/`/` would need escaping in query
 * strings and form posts.
 */
export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Generates a URL-safe random string with `bytes` of entropy. */
export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** SHA-256 of a UTF-8 string, hex encoded. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A PKCE verifier/challenge pair.
 *
 * `verifier` is a high-entropy random string the client keeps; `challenge` is
 * its S256 transform, which is what travels through the authorization server.
 *
 * The verifier is deliberately never hashed for storage: it must be recoverable
 * verbatim at token-exchange time. Its confidentiality comes from it existing
 * only in this run's ledger, not from being hashed.
 */
export interface PkcePair {
  verifier: string;
  challenge: string;
  method: "S256";
}

/**
 * Generates a PKCE verifier and its S256 challenge.
 *
 * 32 bytes of entropy for the verifier (RFC 7636 allows 43-128 characters after
 * base64url encoding). Plain is never used: it defeats the point of PKCE.
 */
export async function generatePkce(): Promise<PkcePair> {
  const verifier = randomToken(32);
  return { verifier, challenge: await s256Challenge(verifier), method: "S256" };
}

/** The S256 code challenge for a verifier: BASE64URL(SHA256(verifier)). */
export async function s256Challenge(verifier: string): Promise<string> {
  return base64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
}

/** Constant-time comparison, so a mismatch cannot be discovered byte by byte. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}