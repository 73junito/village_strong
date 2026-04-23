from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from jose import jwt as jose_jwt
from typing import Optional
from urllib.parse import urlencode

from app.schemas import (
    LtiLaunchResponse,
    DeepLinkReturnRequest,
)
from app.services import (
    handle_lti_login,
    handle_deep_link_return,
    validate_and_handle_lti_launch,
)
from app.utils.state_store import set_state, get_state, delete_state, consume_nonce
import secrets
import httpx

router = APIRouter()


@router.post("/login")
async def lti_login(request: Request):
    """Initiate OIDC login request back to platform.

    Expected query parameters from LMS: `iss`, `login_hint`, `target_link_uri`, `lti_message_hint`, `client_id`.
    This endpoint will fetch the platform's OpenID config to find the authorization endpoint,
    generate `state` and `nonce`, store them, and redirect the user to the platform's auth URL.
    """
    params = dict(request.query_params)
    iss = params.get("iss")
    login_hint = params.get("login_hint")
    target_link_uri = params.get("target_link_uri")
    lti_message_hint = params.get("lti_message_hint")
    client_id = params.get("client_id")

    if not iss or not login_hint or not target_link_uri:
        raise HTTPException(status_code=400, detail="missing required OIDC params")

    # Look up registered platform by issuer in DB to obtain auth endpoint and client_id
    from app.db import get_session
    from app.models import LmsPlatform
    from sqlalchemy import select

    async with get_session() as session:
        stmt = select(LmsPlatform).where(LmsPlatform.issuer == iss)
        res = await session.execute(stmt)
        platform = res.scalar_one_or_none()

    if platform:
        authorization_endpoint = platform.auth_url
        registered_client_id = platform.client_id
    else:
        # fallback: try to fetch openid config from issuer
        oidc_conf_url = iss.rstrip("/") + "/.well-known/openid-configuration"
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(oidc_conf_url)
            if r.status_code != 200:
                raise HTTPException(status_code=400, detail="cannot fetch oidc configuration from issuer and platform not registered")
            oidc_conf = r.json()
        authorization_endpoint = oidc_conf.get("authorization_endpoint")
        registered_client_id = client_id

    # generate state and nonce
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)

    # store state with nonce and launch params
    await set_state(f"state::{state}", {"nonce": nonce, "iss": iss, "client_id": client_id, "target_link_uri": target_link_uri}, ttl=600)
    # also store nonce key to prevent replay; separate key makes consume simple
    await set_state(f"nonce::{nonce}", {"created": True}, ttl=600)

    # build auth request (OIDC request for LTI uses response_mode=form_post and response_type=id_token)
    redirect_uri = request.url_for("lti_launch")
    auth_params = {
        "response_type": "id_token",
        "response_mode": "form_post",
        "client_id": registered_client_id or client_id,
        "redirect_uri": str(redirect_uri),
        "scope": "openid",
        "state": state,
        "nonce": nonce,
        "login_hint": login_hint,
        "prompt": "none",
    }
    # enforce redirect_uri allowed if platform registered
    if platform and platform.redirect_uris:
        allowed = platform.redirect_uris
        if str(redirect_uri) not in allowed:
            raise HTTPException(status_code=400, detail="redirect_uri not allowed for this platform")
    if lti_message_hint:
        auth_params["lti_message_hint"] = lti_message_hint

    url = authorization_endpoint + "?" + urlencode(auth_params)
    return RedirectResponse(url)


@router.post("/register")
async def register_platform_endpoint(payload: dict):
    """Development helper to register a platform. MUST be protected in production."""
    from app.services import register_platform

    required = ["tenant_id", "lms_type", "issuer", "client_id", "auth_url", "token_url", "jwks_url"]
    for k in required:
        if k not in payload:
            raise HTTPException(status_code=400, detail=f"missing {k}")
    plat = await register_platform(
        tenant_id=int(payload["tenant_id"]),
        lms_type=payload["lms_type"],
        issuer=payload["issuer"],
        client_id=payload["client_id"],
        auth_url=payload["auth_url"],
        token_url=payload["token_url"],
        jwks_url=payload["jwks_url"],
        deployment_ids=payload.get("deployment_ids", []),
        redirect_uris=payload.get("redirect_uris", []),
    )
    return {"status": "ok", "platform_id": plat.id}


@router.post("/launch", response_model=LtiLaunchResponse)
async def lti_launch(request: Request):
    """LTI 1.3 launch endpoint. Validate JWT, create tenant/course/user, return session.
    TODO: validate JWT, verify nonce, resolve deployment.
    """
    form = await request.form()
    id_token = form.get("id_token")
    state = form.get("state")
    if not id_token or not state:
        raise HTTPException(status_code=400, detail="missing id_token or state")

    # fetch stored state and validate
    stored = await get_state(f"state::{state}")
    if not stored:
        raise HTTPException(status_code=400, detail="invalid or expired state")

    # Validate JWT signature and claims first (issuer / aud)
    try:
        unverified = jose_jwt.get_unverified_claims(id_token)
        issuer = unverified.get("iss")
        if not issuer:
            raise ValueError("iss missing in id_token")
        jwks_url = issuer.rstrip("/") + "/.well-known/jwks.json"
        # use validate_jwt via service helper
        launch = await validate_and_handle_lti_launch(id_token, jwks_url=jwks_url, expected_audience=None)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid id_token: {exc}")

    # verify nonce matches stored nonce and consume it
    nonce = unverified.get("nonce")
    stored_nonce = stored.get("nonce")
    if not nonce or nonce != stored_nonce:
        raise HTTPException(status_code=400, detail="invalid nonce")

    # consume nonce to prevent replay
    consumed = await consume_nonce(f"nonce::{nonce}")
    if not consumed:
        raise HTTPException(status_code=400, detail="nonce already used or expired")

    # state consumed; delete to prevent reuse
    await delete_state(f"state::{state}")

    # create a short-lived launch session (store in state store)
    launch_session_id = secrets.token_urlsafe(24)
    session_data = {
        "session_id": launch_session_id,
        "user_sub": unverified.get("sub"),
        "roles": unverified.get("https://purl.imsglobal.org/spec/lti/claim/roles"),
        "context": unverified.get("https://purl.imsglobal.org/spec/lti/claim/context"),
        "resource_link": unverified.get("https://purl.imsglobal.org/spec/lti/claim/resource_link"),
        "ags": unverified.get("https://purl.imsglobal.org/spec/lti-ags/claim/endpoint"),
        "nrps": unverified.get("https://purl.imsglobal.org/spec/lti-nrps/claim/endpoint"),
    }
    await set_state(f"launch::{launch_session_id}", session_data, ttl=1800)

    # return mapped launch response including our internal session id
    # incorporate session id into LtiLaunchResponse
    resp = LtiLaunchResponse(session_id=launch_session_id, user_id=session_data.get("user_sub") or "", role=','.join(session_data.get("roles") or []) if session_data.get("roles") else "", course_id=(session_data.get("context") or {}).get("id"))
    return resp


@router.post("/deep-link/return")
async def deep_link_return(req: DeepLinkReturnRequest):
    """Handle an instructor deep-link return (selection complete).
    TODO: issue deep-link JWT response to LMS.
    """
    return handle_deep_link_return(req)
