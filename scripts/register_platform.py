#!/usr/bin/env python3
"""
Admin script: register an LTI platform directly into the app DB.

Usage (example):
PLATFORM_ISSUER=https://moodle.local \
PLATFORM_CLIENT_ID=abc123 \
PLATFORM_JWKS_URL=https://moodle.local/mod/lti/auth/jwks.php \
PLATFORM_DEPLOYMENT_ID=deployment-1 \
python scripts/register_platform.py

This script imports the app DB and writes a simple LmsPlatform record.
It is intentionally small and syncs to the async DB via `AsyncSession`.
"""
import os
import sys
import asyncio

ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(ROOT, "src"))

from app.db import init_db, AsyncSessionLocal
from app import models


async def main():
    issuer = os.environ.get("PLATFORM_ISSUER")
    client_id = os.environ.get("PLATFORM_CLIENT_ID")
    jwks = os.environ.get("PLATFORM_JWKS_URL")
    deployment_id = os.environ.get("PLATFORM_DEPLOYMENT_ID", "default")

    if not issuer or not client_id:
        print("Set PLATFORM_ISSUER and PLATFORM_CLIENT_ID in the environment")
        return 2

    await init_db()

    async with AsyncSessionLocal() as session:
        platform = models.LmsPlatform(
            issuer=issuer,
            client_id=client_id,
            jwks_url=jwks,
            deployment_id=deployment_id,
        )
        session.add(platform)
        await session.commit()
        await session.refresh(platform)
        print("Registered platform id:", platform.id)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
