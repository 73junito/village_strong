#!/usr/bin/env python3
"""
Minimal end-to-end test runner (HTTP) against a running app instance.

This script expects the FastAPI app to be running (default http://localhost:8000).
It will:
 - create an attempt
 - autosave a sample response
 - submit the attempt

Environment variables:
 - APP_URL (default: http://localhost:8000)

Note: endpoint paths are best-effort and may need small edits to match your app.
"""
import os
import sys
import json
import httpx

APP_URL = os.environ.get("APP_URL", "http://localhost:8000")


def _url(path: str) -> str:
    return APP_URL.rstrip("/") + path


def main():
    client = httpx.Client()

    # 1) Create attempt (adjust payload to match your API)
    payload = {
        "assessment_id": 1,
        "user_id": 1001,
        "resource_link_id": "test-resource-1",
    }
    print("Creating attempt...")
    r = client.post(_url("/attempts"), json=payload)
    print(r.status_code, r.text)
    if r.status_code not in (200, 201):
        print("Failed to create attempt; adjust endpoint or start app")
        return 2
    attempt = r.json()
    attempt_id = attempt.get("id") or attempt.get("attempt_id")
    print("Attempt id:", attempt_id)

    # 2) Autosave a sample
    autosave_payload = {"answers": {"q1": "A", "q2": "42"}}
    print("Autosaving...")
    r = client.post(_url(f"/attempts/{attempt_id}/autosave"), json=autosave_payload)
    print(r.status_code, r.text)

    # 3) Submit
    print("Submitting...")
    r = client.post(_url(f"/attempts/{attempt_id}/submit"))
    print(r.status_code, r.text)

    return 0


if __name__ == "__main__":
    sys.exit(main())
