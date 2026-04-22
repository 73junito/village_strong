from fastapi import FastAPI

from app.routers import lti, assessments, attempts, ags

app = FastAPI(title="Village Strong Assessment Service")

app.include_router(lti.router, prefix="/lti", tags=["lti"])
app.include_router(assessments.router, prefix="/assessments", tags=["assessments"])
app.include_router(attempts.router, prefix="/attempts", tags=["attempts"])
app.include_router(ags.router, prefix="/ags", tags=["ags"])


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
