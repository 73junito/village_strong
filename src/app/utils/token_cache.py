import time
from typing import Dict, Any, Optional

_TOKEN_CACHE: Dict[str, Dict[str, Any]] = {}


def cache_key(issuer: str, client_id: str, scope: str) -> str:
    return f"{issuer}::{client_id}::{scope}"


def set_token(issuer: str, client_id: str, scope: str, token: str, expires_in: int):
    key = cache_key(issuer, client_id, scope)
    _TOKEN_CACHE[key] = {"token": token, "expires_at": time.time() + expires_in - 10}


def get_token(issuer: str, client_id: str, scope: str) -> Optional[str]:
    key = cache_key(issuer, client_id, scope)
    entry = _TOKEN_CACHE.get(key)
    if not entry:
        return None
    if entry["expires_at"] < time.time():
        del _TOKEN_CACHE[key]
        return None
    return entry["token"]
