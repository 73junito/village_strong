#!/usr/bin/env python3
"""
Verify an attempt exists and show grade-sync records.

This script connects directly to the app DB (uses the same `src` package)
and prints the latest attempt and associated `GradeSyncRecord` rows.

Usage: python scripts/verify_attempt.py [ATTEMPT_ID]
"""
import os
import sys
import asyncio

ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(ROOT, "src"))

from app.db import init_db, AsyncSessionLocal
from app import models
from sqlalchemy import select


async def main(attempt_id=None):
    await init_db()
    async with AsyncSessionLocal() as session:
        if attempt_id:
            q = select(models.Attempt).where(models.Attempt.id == int(attempt_id))
        else:
            q = select(models.Attempt).order_by(models.Attempt.id.desc()).limit(1)
        res = await session.execute(q)
        attempt = res.scalars().first()
        if not attempt:
            print("No attempt found")
            return 1
        print("Attempt:", attempt.id, getattr(attempt, "status", None))

        q2 = select(models.GradeSyncRecord).where(models.GradeSyncRecord.attempt_id == attempt.id)
        r2 = await session.execute(q2)
        rows = r2.scalars().all()
        print(f"Found {len(rows)} GradeSyncRecord(s)")
        for g in rows:
            print(g.id, g.status, getattr(g, "response_code", None))

    return 0


if __name__ == "__main__":
    aid = sys.argv[1] if len(sys.argv) > 1 else None
    raise SystemExit(asyncio.run(main(aid)))
