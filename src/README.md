Village Strong — Assessment Service (FastAPI) stubs

Quick start:

1. Create a virtualenv and install requirements:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r src/requirements.txt
```

2. Run the app (development):

```bash
uvicorn app.main:app --reload --port 8000
```

Notes:
- The routers and services are stubs with TODOs for JWT/LTI validation, DB wiring, and AGS posting.
- Next steps: implement SQLAlchemy models, Alembic migrations, and proper LTI JWT verification.
