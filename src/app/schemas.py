from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class LtiLaunchResponse(BaseModel):
    session_id: str
    user_id: str
    role: str
    course_id: Optional[str]


class DeepLinkReturnRequest(BaseModel):
    deployment_id: str
    selection: Dict[str, Any]


class ItemOut(BaseModel):
    id: int
    type: str
    stem: str
    options: Dict[str, Any]


class AssessmentOut(BaseModel):
    id: int
    course_id: int
    title: str
    description: Optional[str]
    items: List[ItemOut] = []


class CreateAttemptRequest(BaseModel):
    assessment_id: int
    user_id: int
    attempt_meta: Optional[Dict[str, Any]] = None


class AttemptOut(BaseModel):
    id: int
    assessment_id: int
    user_id: int
    status: str
    started_at: Optional[str]


class AutosaveRequest(BaseModel):
    responses: Dict[str, Any]
    checkpoint: Optional[Dict[str, Any]] = None


class SubmitResponse(BaseModel):
    attempt_id: int
    status: str
    score: Optional[float]


class GradeRequest(BaseModel):
    grader_id: int
    item_scores: Dict[int, float]
    feedback: Optional[Dict[int, str]] = None


class AGSSyncResponse(BaseModel):
    attempt_id: int
    status: str
    message: Optional[str] = None
