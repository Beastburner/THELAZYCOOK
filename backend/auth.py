from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel


router = APIRouter(prefix="/auth", tags=["auth"])


# TEMP (per your request): no JWT.
# We treat the token as the email itself:
#   Authorization: Bearer you@example.com
# Later we can swap this for real JWT + AWS without changing frontend shape.

DEFAULT_PLAN = "PRO"  # lets you use gemini + grok while we finish billing/JWT

# In-memory users for now (AWS-ready placeholder)
# USERS[email] = {"plan": "GO"|"PRO"|"ULTRA"}
USERS: Dict[str, Dict[str, Any]] = {}


class LoginIn(BaseModel):
    email: str
    password: Optional[str] = None  # ignored for now


class LoginOut(BaseModel):
    access_token: str  # TEMP: equals email
    token_type: str = "bearer"
    user_id: str
    plan: str


def _plan_for_email(email: str) -> str:
    e = email.lower()
    if "ultra" in e:
        return "ULTRA"
    if "pro" in e:
        return "PRO"
    return "GO"


def _email_from_auth(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    if authorization.lower().startswith("bearer "):
        v = authorization[7:].strip()
        return v.lower() if v else None
    return None


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn) -> LoginOut:
    email = (payload.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email required")

    # Assign plan server-side (frontend not trusted)
    USERS.setdefault(email, {"plan": _plan_for_email(email) or DEFAULT_PLAN})
    plan = USERS[email]["plan"]

    return LoginOut(access_token=email, user_id=email, plan=plan)


def get_current_user(authorization: Optional[str] = Header(default=None, alias="Authorization")) -> Dict[str, Any]:
    # TEMP token scheme (no JWT): Authorization: Bearer <email>
    # For plan routing, we require the token (email) to be present.
    email = _email_from_auth(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Missing token")

    USERS.setdefault(email, {"plan": _plan_for_email(email) or DEFAULT_PLAN})
    plan = USERS[email]["plan"]
    return {"user_id": email, "plan": plan}


@router.get("/me")
def me(authorization: Optional[str] = Header(default=None, alias="Authorization")) -> Dict[str, Any]:
    return get_current_user(authorization)
