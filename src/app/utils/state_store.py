import os
import time
import asyncio
from typing import Any, Dict, Optional

REDIS_URL = os.environ.get("REDIS_URL")
_in_memory_store: Dict[str, Dict[str, Any]] = {}
_in_memory_lock = asyncio.Lock()
_DEFAULT_TTL = 600  # 10 minutes


try:
    import aioredis

    _redis = None

    async def _get_redis():
        global _redis
        if _redis is None:
            _redis = await aioredis.from_url(REDIS_URL)
        return _redis

    async def set_state(key: str, value: Dict[str, Any], ttl: int = _DEFAULT_TTL):
        r = await _get_redis()
        await r.set(key, str(value), ex=ttl)

    async def get_state(key: str) -> Optional[Dict[str, Any]]:
        r = await _get_redis()
        v = await r.get(key)
        if not v:
            return None
        # stored as str(dict) for simplicity; production should use JSON
        try:
            return eval(v)
        except Exception:
            return None

    async def delete_state(key: str):
        r = await _get_redis()
        await r.delete(key)

except Exception:
    # Fallback in-memory store
    async def set_state(key: str, value: Dict[str, Any], ttl: int = _DEFAULT_TTL):
        async with _in_memory_lock:
            _in_memory_store[key] = {"value": value, "expires_at": time.time() + ttl}

    async def get_state(key: str) -> Optional[Dict[str, Any]]:
        async with _in_memory_lock:
            entry = _in_memory_store.get(key)
            if not entry:
                return None
            if entry["expires_at"] < time.time():
                del _in_memory_store[key]
                return None
            return entry["value"]

    async def delete_state(key: str):
        async with _in_memory_lock:
            if key in _in_memory_store:
                del _in_memory_store[key]


async def consume_nonce(nonce_key: str) -> bool:
    """Return True if nonce existed and mark as consumed, False otherwise."""
    entry = await get_state(nonce_key)
    if not entry:
        return False
    await delete_state(nonce_key)
    return True
