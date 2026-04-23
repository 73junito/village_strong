# Walkthrough Checklist — Moodle Sandbox

Short operational checklist for the first end-to-end test.

- [ ] Start sandbox
  - `cd sandbox && docker compose up -d`
- [ ] Start app
  - Create venv, install deps, run `uvicorn app.main:app --reload`
- [ ] Initialize DB
  - `python -c "import asyncio; from app.db import init_db; asyncio.run(init_db())"`
- [ ] Register platform
  - Set `PLATFORM_ISSUER`, `PLATFORM_CLIENT_ID`, `PLATFORM_JWKS_URL`, `PLATFORM_DEPLOYMENT_ID`
  - `python scripts/register_platform.py`
- [ ] Configure Moodle external tool
  - Add tool → set issuer, client_id, JWKS, token URL, deployment_id, redirect `http://localhost:8000/lti/launch`
- [ ] Instructor launch
  - Add activity to course, launch as instructor, verify `User`/`Course` rows
- [ ] Student launch
  - Launch as student, start attempt
- [ ] Submit attempt
  - Use UI or `APP_URL=http://localhost:8000 python scripts/create_test_data.py`
- [ ] Verify `GradeSyncRecord`
  - `python scripts/verify_attempt.py <attempt_id>`
- [ ] Confirm Moodle gradebook result
  - Check gradebook for the student entry or error noted in `GradeSyncRecord`
