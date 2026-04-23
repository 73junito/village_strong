from typing import Any, Dict, Optional
import time
import uuid
import httpx
from jose import jwt

from app.schemas import (
    LtiLaunchResponse,
    DeepLinkReturnRequest,
    CreateAttemptRequest,
    AttemptOut,
    AutosaveRequest,
    SubmitResponse,
    GradeRequest,
    AGSSyncResponse,
)
from app.utils.jwt_utils import validate_jwt
from app.utils.token_cache import get_token, set_token
from app.db import get_session
from app.models import LmsPlatform, AuditLog
from sqlalchemy import select
from sqlalchemy.exc import NoResultFound
import json
from typing import List


async def register_platform(tenant_id: int, lms_type: str, issuer: str, client_id: str, auth_url: str, token_url: str, jwks_url: str, deployment_ids: List[str] = None, redirect_uris: List[str] = None):
    """Register a new LTI platform in the DB (development helper).
    NOTE: This endpoint should be protected in production.
    """
    deployment_ids = deployment_ids or []
    redirect_uris = redirect_uris or []
    async with get_session() as session:
        platform = LmsPlatform(
            tenant_id=tenant_id,
            lms_type=lms_type,
            issuer=issuer,
            client_id=client_id,
            auth_url=auth_url,
            token_url=token_url,
            jwks_url=jwks_url,
            deployment_ids=deployment_ids,
            redirect_uris=redirect_uris,
            config={},
        )
        session.add(platform)
        await session.commit()
        await session.refresh(platform)
        return platform

# NOTE: In a production system, secrets (private keys) must be stored in a secure
# vault. For this example we read a PEM from an environment variable or file path
# (TODO). The functions below provide AGS token exchange and score posting.


async def validate_and_handle_lti_launch(id_token: str, jwks_url: str, expected_audience: str = None) -> LtiLaunchResponse:
    """Validate an LTI id_token and return a mapped launch response.

    This function uses `validate_jwt` to verify signature and claims, then
    performs minimal resolution (tenant/platform/course/user). Database
    upserts are left as TODOs to be implemented when SQLAlchemy is wired.
    """
    # Basic validate signature and exp using provided jwks_url
    claims = await validate_jwt(id_token, expected_audience=expected_audience, jwks_url=jwks_url)

    # Extract common LTI claims
    sub = claims.get("sub")
    roles = claims.get("https://purl.imsglobal.org/spec/lti/claim/roles")
    context = claims.get("https://purl.imsglobal.org/spec/lti/claim/context")
    resource_link = claims.get("https://purl.imsglobal.org/spec/lti/claim/resource_link")

    # AGS and NRPS endpoints (if present)
    ags = claims.get("https://purl.imsglobal.org/spec/lti-ags/claim/endpoint")
    nrps = claims.get("https://purl.imsglobal.org/spec/lti-nrps/claim/endpoint")

    # DB-backed platform check: ensure issuer and audience match registered platform
    issuer = claims.get("iss")
    aud = claims.get("aud")
    # aud may be str or list
    aud_list = aud if isinstance(aud, list) else [aud]

    async with get_session() as session:
        stmt = select(LmsPlatform).where(LmsPlatform.issuer == issuer)
        result = await session.execute(stmt)
        platform = result.scalar_one_or_none()
        if not platform:
            # audit and reject
            await session.execute(
                AuditLog.__table__.insert().values(action="launch_failed", resource={"reason": "unknown_issuer", "issuer": issuer})
            )
            await session.commit()
            raise ValueError("issuer not registered")

        # check audience contains registered client_id
        if platform.client_id and platform.client_id not in aud_list:
            await session.execute(
                AuditLog.__table__.insert().values(action="launch_failed", resource={"reason": "aud_mismatch", "issuer": issuer, "aud": aud_list, "expected_client": platform.client_id})
            )
            await session.commit()
            raise ValueError("token audience does not match registered platform client_id")

        # All good for now; return mapped minimal launch response
        return LtiLaunchResponse(session_id=str(uuid.uuid4()), user_id=sub or "", role=','.join(roles) if roles else "", course_id=(context or {}).get("id"))


def make_client_assertion(client_id: str, token_url: str, private_key_pem: str) -> str:
    now = int(time.time())
    payload = {
        "iss": client_id,
        "sub": client_id,
        "aud": token_url,
        "iat": now,
        "exp": now + 300,
        "jti": str(uuid.uuid4()),
    }
    assertion = jwt.encode(payload, private_key_pem, algorithm="RS256")
    return assertion


async def request_client_token(token_url: str, client_id: str, scope: str, private_key_pem: str) -> str:
    cached = get_token(token_url, client_id, scope)
    if cached:
        return cached

    client_assertion = make_client_assertion(client_id, token_url, private_key_pem)

    data = {
        "grant_type": "client_credentials",
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": client_assertion,
        "scope": scope,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(token_url, data=data)
        r.raise_for_status()
        j = r.json()

    access_token = j.get("access_token")
    if not isinstance(access_token, str) or not access_token.strip():
        raise ValueError("Token endpoint response did not include a valid access_token")
    expires_in = int(j.get("expires_in", 3600))
    set_token(token_url, client_id, scope, access_token, expires_in)
    return access_token


async def post_score_to_ags(lineitem_score_url: str, access_token: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(lineitem_score_url, json=payload, headers=headers)
    if r.status_code >= 400:
        return {"ok": False, "status_code": r.status_code, "text": r.text}
    return {"ok": True, "status_code": r.status_code, "json": r.json() if r.content else {}}


def handle_lti_login(form_raw: bytes) -> Dict[str, Any]:
    # TODO: implement OIDC login handler: validate state, construct redirect
    return {"status": "ok"}


def handle_lti_launch(raw_body: bytes) -> Optional[LtiLaunchResponse]:
    # Deprecated synchronous stub. Use `validate_and_handle_lti_launch` async helper.
    return LtiLaunchResponse(session_id="sess-123", user_id="user-123", role="Learner", course_id="course-1")


def handle_deep_link_return(req: DeepLinkReturnRequest) -> Dict[str, Any]:
    # TODO: create assessment if needed and return deep link JWT response
    return {"status": "ok", "deployment_id": req.deployment_id}


def get_assessment(assessment_id: int) -> Optional[Dict[str, Any]]:
    # TODO: fetch from DB
    # example mock
    return {
        "id": assessment_id,
        "course_id": 1,
        "title": "Sample Quiz",
        "description": "Mock assessment",
        "items": [],
    }


async def create_attempt(req: CreateAttemptRequest) -> AttemptOut:
    """Create an Attempt row, snapshot assessment item ids into attempt.meta.

    Basic enforcement: creates attempt if assessment exists. Does not enforce attempt limits yet.
    """
    from app.models import Assessment, AssessmentItem, Attempt

    async with get_session() as session:
        stmt = select(Assessment).where(Assessment.id == req.assessment_id)
        res = await session.execute(stmt)
        assessment = res.scalar_one_or_none()
        if not assessment:
            raise ValueError("assessment not found")

        # snapshot item ids
        stmt_items = select(AssessmentItem).where(AssessmentItem.assessment_id == assessment.id).order_by(AssessmentItem.order_idx)
        res_items = await session.execute(stmt_items)
        items = res_items.scalars().all()
        item_ids = [int(ai.item_id) for ai in items]

        attempt = Attempt(
            assessment_id=assessment.id,
            user_id=req.user_id,
            status="in_progress",
            meta={"snapshot_item_ids": item_ids},
        )
        session.add(attempt)
        await session.commit()
        await session.refresh(attempt)
        return AttemptOut(id=attempt.id, assessment_id=attempt.assessment_id, user_id=attempt.user_id, status=attempt.status, started_at=attempt.started_at.isoformat())


async def autosave_attempt(attempt_id: int, req: AutosaveRequest) -> bool:
    """Upsert AttemptItem rows for the given attempt.

    `req.responses` expected to be a mapping of item_id -> response payload.
    """
    from app.models import Attempt, AttemptItem, Item
    import datetime

    async with get_session() as session:
        stmt = select(Attempt).where(Attempt.id == attempt_id)
        res = await session.execute(stmt)
        attempt = res.scalar_one_or_none()
        if not attempt or attempt.status != "in_progress":
            return False

        # upsert each response
        for sid, resp in (req.responses or {}).items():
            try:
                item_id = int(sid)
            except Exception:
                continue
            # check if an AttemptItem exists
            stmt_ai = select(AttemptItem).where(AttemptItem.attempt_id == attempt_id, AttemptItem.item_id == item_id)
            res_ai = await session.execute(stmt_ai)
            attempt_item = res_ai.scalar_one_or_none()
            now = datetime.datetime.utcnow()
            if attempt_item:
                attempt_item.response = resp
                attempt_item.answered_at = now
                attempt_item.updated_at = now
            else:
                new = AttemptItem(
                    attempt_id=attempt_id,
                    item_id=item_id,
                    response=resp,
                    answered_at=now,
                )
                session.add(new)

        # update checkpoint
        meta = attempt.meta or {}
        meta["last_autosave_at"] = datetime.datetime.utcnow().isoformat()
        attempt.meta = meta
        await session.commit()
        return True


async def submit_attempt(attempt_id: int) -> Optional[SubmitResponse]:
    """Finalize an attempt: auto-grade objective items and set status.

    Returns SubmitResponse with computed score.
    """
    import datetime as _dt
    from app.models import Attempt, AttemptItem, Item, Assessment, AssessmentItem, GradeSyncRecord

    async with get_session() as session:
        stmt = select(Attempt).where(Attempt.id == attempt_id)
        res = await session.execute(stmt)
        attempt = res.scalar_one_or_none()
        if not attempt or attempt.status != "in_progress":
            return None

        # fetch related attempt items and corresponding items
        stmt_items = select(AttemptItem).where(AttemptItem.attempt_id == attempt_id)
        res_items = await session.execute(stmt_items)
        attempt_items = res_items.scalars().all()

        total_score = 0.0
        total_max = 0.0

        for ai in attempt_items:
            # load question
            stmt_q = select(Item).where(Item.id == ai.item_id)
            qr = await session.execute(stmt_q)
            q = qr.scalar_one_or_none()
            if not q:
                continue
            max_score = 1.0
            # find associated assessment_item to get points if present
            stmt_ass_item = select(AssessmentItem).where(AssessmentItem.item_id == q.id, AssessmentItem.assessment_id == attempt.assessment_id)
            rai = await session.execute(stmt_ass_item)
            ass_item = rai.scalar_one_or_none()
            if ass_item and ass_item.points:
                max_score = float(ass_item.points)

            score = None
            # simple auto-grader rules
            try:
                sol = q.solution or {}
                resp = ai.response
                if q.type == "mcq":
                    # assume sol['correct'] holds single value
                    if isinstance(sol.get("correct"), list):
                        correct = sol.get("correct")[0]
                    else:
                        correct = sol.get("correct")
                    score = max_score if resp == correct else 0.0
                elif q.type == "msq":
                    # assume lists
                    correct = set(sol.get("correct") or [])
                    got = set(resp or [])
                    score = max_score if got == correct else 0.0
                elif q.type == "numeric":
                    val = float(sol.get("value")) if sol.get("value") is not None else None
                    tol = float(sol.get("tolerance", 0))
                    try:
                        rnum = float(resp)
                        if val is not None and abs(rnum - val) <= tol:
                            score = max_score
                        else:
                            score = 0.0
                    except Exception:
                        score = 0.0
                else:
                    # non-auto gradable
                    score = None
            except Exception:
                score = None

            ai.score = score
            ai.max_score = max_score
            if score is not None:
                total_score += float(score)
            total_max += float(max_score)

        # update attempt totals
        attempt.score = total_score
        attempt.max_score = total_max
        attempt.status = "submitted"
        attempt.submitted_at = _dt.datetime.utcnow()
        await session.commit()

        return SubmitResponse(attempt_id=attempt.id, status=attempt.status, score=float(attempt.score or 0.0))


async def grade_attempt(attempt_id: int, req: GradeRequest) -> bool:
    # TODO: apply manual scores, update attempt and attempt_items
    from app.models import AttemptItem, Attempt
    async with get_session() as session:
        for item_id, sc in req.item_scores.items():
            stmt = select(AttemptItem).where(AttemptItem.attempt_id == attempt_id, AttemptItem.item_id == item_id)
            res = await session.execute(stmt)
            ai = res.scalar_one_or_none()
            if ai:
                ai.score = sc
                # optionally write feedback
        # recompute attempt total
        stmt2 = select(Attempt).where(Attempt.id == attempt_id)
        res2 = await session.execute(stmt2)
        attempt = res2.scalar_one_or_none()
        if not attempt:
            return False
        # sum scores
        stmt_sum = select(AttemptItem).where(AttemptItem.attempt_id == attempt_id)
        res_sum = await session.execute(stmt_sum)
        ais = res_sum.scalars().all()
        total = 0.0
        max_total = 0.0
        for a in ais:
            if a.score is not None:
                total += float(a.score)
            if a.max_score:
                max_total += float(a.max_score)
        attempt.score = total
        attempt.max_score = max_total
        attempt.status = "graded"
        await session.commit()
        return True


async def ags_sync_attempt(attempt_id: int) -> Optional[AGSSyncResponse]:
    from app.models import Attempt, Assessment, Course, LmsPlatform, GradeSyncRecord

    async with get_session() as session:
        stmt = select(Attempt).where(Attempt.id == attempt_id)
        res = await session.execute(stmt)
        attempt = res.scalar_one_or_none()
        if not attempt:
            return None

        # find assessment -> course -> platform
        stmt_ass = select(Assessment).where(Assessment.id == attempt.assessment_id)
        res_ass = await session.execute(stmt_ass)
        assessment = res_ass.scalar_one_or_none()
        if not assessment:
            return AGSSyncResponse(attempt_id=attempt_id, status="failed", message="assessment not found")

        stmt_course = select(Course).where(Course.id == assessment.course_id)
        res_course = await session.execute(stmt_course)
        course = res_course.scalar_one_or_none()
        if not course:
            return AGSSyncResponse(attempt_id=attempt_id, status="failed", message="course not found")

        if not course.lms_platform_id:
            return AGSSyncResponse(attempt_id=attempt_id, status="failed", message="no platform linked to course")

        stmt_plat = select(LmsPlatform).where(LmsPlatform.id == course.lms_platform_id)
        res_plat = await session.execute(stmt_plat)
        platform = res_plat.scalar_one_or_none()
        if not platform:
            return AGSSyncResponse(attempt_id=attempt_id, status="failed", message="platform not found")

        lineitem_url = assessment.lineitem_url
        if not lineitem_url:
            return AGSSyncResponse(attempt_id=attempt_id, status="failed", message="no lineitem_url configured for assessment")

        # need private key in platform.config['private_key'] for client_assertion
        private_key = (platform.config or {}).get("private_key")
        if not private_key:
            return AGSSyncResponse(attempt_id=attempt_id, status="failed", message="no private key configured for platform")

        client_id = platform.client_id
        token_url = platform.token_url
        if not client_id or not token_url:
            return AGSSyncResponse(attempt_id=attempt_id, status="failed", message="platform missing client_id or token_url")

        # build payload
        payload = {
            "userId": attempt.user_id,
            "scoreGiven": float(attempt.score or 0.0),
            "scoreMaximum": float(attempt.max_score or 0.0),
            "activityProgress": "Completed",
            "gradingProgress": "FullyGraded",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        # request token
        try:
            access_token = await request_client_token(token_url, client_id, "https://purl.imsglobal.org/spec/lti-ags/scope/score", private_key)
        except Exception as exc:
            # record failed sync
            rec = GradeSyncRecord(attempt_id=attempt_id, lineitem_url=lineitem_url, score_sent=attempt.score or 0.0, status="failed", last_error=str(exc))
            session.add(rec)
            await session.commit()
            return AGSSyncResponse(attempt_id=attempt_id, status="failed", message=str(exc))

        # post score
        result = await post_score_to_ags(lineitem_url, access_token, payload)
        if not result.get("ok"):
            rec = GradeSyncRecord(attempt_id=attempt_id, lineitem_url=lineitem_url, score_sent=attempt.score or 0.0, status="failed", last_error=result.get("text"))
            session.add(rec)
            await session.commit()
            return AGSSyncResponse(attempt_id=attempt_id, status="failed", message=result.get("text"))

        # success
        rec = GradeSyncRecord(attempt_id=attempt_id, lineitem_url=lineitem_url, score_sent=attempt.score or 0.0, status="success")
        attempt.lms_grade_synced = True
        session.add(rec)
        await session.commit()
        return AGSSyncResponse(attempt_id=attempt_id, status="success", message="posted")
