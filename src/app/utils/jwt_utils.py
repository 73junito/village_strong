import time
from typing import Dict, Any
import httpx
from jose import jwt

JWKS_CACHE: Dict[str, Dict[str, Any]] = {}


async def fetch_jwks(jwks_url: str) -> Dict[str, Any]:
    """Fetch JWKS and cache it in memory with simple TTL.
    Returns the parsed JWKS dict.
    """
    now = time.time()
    entry = JWKS_CACHE.get(jwks_url)
    if entry and entry.get("expires_at", 0) > now:
        return entry["jwks"]

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(jwks_url)
        r.raise_for_status()
        jwks = r.json()

    # cache for 1 hour
    JWKS_CACHE[jwks_url] = {"jwks": jwks, "expires_at": now + 3600}
    return jwks


def get_key_from_jwks(jwks: Dict[str, Any], kid: str) -> Dict[str, Any]:
    keys = jwks.get("keys", [])
    for k in keys:
        if k.get("kid") == kid:
            return k
    raise KeyError(f"kid {kid} not found in jwks")


async def validate_jwt(id_token: str, expected_issuer: str = None, expected_audience: str = None, jwks_url: str = None) -> Dict[str, Any]:
    """Validate an LTI id_token (JWT) against JWKS and basic claims.
    Returns the decoded claims on success.

    For LTI 1.3, the id_token is posted as a form field. This helper fetches
    JWKS, verifies signature, and checks iss/aud claims. It does NOT enforce
    nonce/state persistence — that must be handled by caller.
    """
    unverified_header = jwt.get_unverified_header(id_token)
    kid = unverified_header.get("kid")
    if not kid:
        raise ValueError("JWT missing kid header")

    if not jwks_url:
        raise ValueError("jwks_url is required to validate token")

    jwks = await fetch_jwks(jwks_url)
    jwk = get_key_from_jwks(jwks, kid)

    # jose.jwt.decode will verify signature and exp by default
    claims = jwt.decode(id_token, jwk, algorithms=[jwk.get("alg", "RS256")], audience=expected_audience)

    if expected_issuer and claims.get("iss") != expected_issuer:
        raise ValueError("invalid issuer")

    return claims
