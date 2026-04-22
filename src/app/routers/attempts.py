from fastapi import APIRouter, HTTPException
from app.schemas import (
    CreateAttemptRequest,
    AttemptOut,
    AutosaveRequest,
    SubmitResponse,
    GradeRequest,
    AGSSyncResponse,
)
from app.services import (
    create_attempt,
    autosave_attempt,
    submit_attempt,
    grade_attempt,
    ags_sync_attempt,
)

router = APIRouter()


@router.post("", response_model=AttemptOut)
async def create_attempt_endpoint(req: CreateAttemptRequest):
    """Start an attempt for a user on an assessment.
    TODO: validate LTI session / user context.
    """
    attempt = await create_attempt(req)
    return attempt


@router.patch("/{attempt_id}/autosave")
async def autosave(attempt_id: int, req: AutosaveRequest):
    """Autosave responses for an attempt.
    TODO: validate attempt ownership and schema of responses.
    """
    ok = await autosave_attempt(attempt_id, req)
    if not ok:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return {"status": "ok"}


@router.post("/{attempt_id}/submit", response_model=SubmitResponse)
async def submit(attempt_id: int):
    """Submit an attempt for grading.
    TODO: run auto-grader and mark attempt submitted.
    """
    res = await submit_attempt(attempt_id)
    if not res:
        raise HTTPException(status_code=404, detail="Attempt not found or cannot submit")
    return res


@router.post("/{attempt_id}/grade")
async def grade(attempt_id: int, req: GradeRequest):
    """Manual grading endpoint for graders/instructors.
    TODO: enforce instructor role.
    """
    ok = await grade_attempt(attempt_id, req)
    if not ok:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return {"status": "ok"}


@router.post("/ags/sync/{attempt_id}", response_model=AGSSyncResponse)
async def ags_sync(attempt_id: int):
    """Force an AGS sync for an attempt.
    TODO: use stored lineitem and LTI credentials to POST score.
    """
    out = await ags_sync_attempt(attempt_id)
    if not out:
        raise HTTPException(status_code=404, detail="Attempt not found or AGS info missing")
    return out
