from fastapi import APIRouter, HTTPException
from app.schemas import AGSSyncResponse
from app.services import ags_sync_attempt

router = APIRouter()


@router.post("/sync/{attempt_id}", response_model=AGSSyncResponse)
async def ags_sync(attempt_id: int):
    out = await ags_sync_attempt(attempt_id)
    if not out:
        raise HTTPException(status_code=404, detail="Attempt not found or AGS info missing")
    return out
