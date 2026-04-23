from fastapi import APIRouter, HTTPException
from app.schemas import AssessmentOut
from app.services import get_assessment

router = APIRouter()


@router.get("/{assessment_id}", response_model=AssessmentOut)
async def read_assessment(assessment_id: int):
    """Return assessment metadata and structure.
    TODO: enforce tenant scoping from auth / LTI session.
    """
    a = get_assessment(assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return a
