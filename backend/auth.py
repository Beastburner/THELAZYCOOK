from __future__ import annotations

from typing import Any, Dict, Optional
import logging

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from firebase_config import verify_firebase_token, get_user_plan, get_user_from_firestore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Default plan for new users
DEFAULT_PLAN = "GO"

# Keep in-memory users as fallback for backward compatibility (will be removed later)
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


def get_current_user(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-ID"),
    x_user_plan: Optional[str] = Header(default=None, alias="X-User-Plan"),
) -> Dict[str, Any]:
    """
    Get current authenticated user from Firebase token or headers.
    
    Priority:
    1. Verify Firebase ID token from Authorization header
    2. Use X-User-ID and X-User-Plan headers (if token verification fails)
    3. Fallback to old email-based system (backward compatibility)
    """
    # Priority 1: Verify Firebase ID token
    if authorization:
        token = _extract_bearer_token(authorization)
        if token and len(token) > 100:  # Firebase tokens are long, email tokens are short
            try:
                decoded_token = verify_firebase_token(token)
                user_id = decoded_token.get('uid')
                user_email = decoded_token.get('email', '')
                
                if not user_id:
                    raise HTTPException(status_code=401, detail="Invalid token: missing uid")
                
                # Fetch plan from Firestore
                plan = get_user_plan(user_id)
                if not plan or plan not in ["GO", "PRO", "ULTRA"]:
                    plan = DEFAULT_PLAN
                    logger.warning(f"Invalid plan for user {user_id}, defaulting to {DEFAULT_PLAN}")
                
                logger.info(f"Authenticated user: {user_id} (plan: {plan})")
                return {
                    "user_id": user_id,
                    "email": user_email,
                    "plan": plan
                }
            except ValueError as e:
                # Token verification failed, try other methods
                logger.warning(f"Token verification failed: {e}")
            except Exception as e:
                logger.error(f"Unexpected error during token verification: {e}")
                raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
    
    # Priority 2: Use X-User-ID and X-User-Plan headers (for cases where token is not provided)
    if x_user_id:
        # If plan is provided in header, use it; otherwise fetch from Firestore
        if x_user_plan:
            plan = x_user_plan.upper().strip()
            if plan not in ["GO", "PRO", "ULTRA"]:
                plan = DEFAULT_PLAN
        else:
            # Fetch plan from Firestore
            plan = get_user_plan(x_user_id)
            if not plan or plan not in ["GO", "PRO", "ULTRA"]:
                plan = DEFAULT_PLAN
        
        logger.info(f"Using header-based auth: {x_user_id} (plan: {plan})")
        return {"user_id": x_user_id, "plan": plan}
    
    # Priority 3: Fallback to old email-based system (backward compatibility)
    email = _email_from_auth(authorization)
    if email:
        logger.warning(f"Using legacy email-based auth for: {email}")
        USERS.setdefault(email, {"plan": _plan_for_email(email) or DEFAULT_PLAN})
        plan = USERS[email]["plan"]
        return {"user_id": email, "plan": plan}
    
    # No valid authentication found
    raise HTTPException(
        status_code=401,
        detail="Missing or invalid authentication. Please provide a valid Firebase ID token or user headers."
    )


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    """Extract bearer token from Authorization header."""
    if not authorization:
        return None
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


@router.get("/me")
def me(authorization: Optional[str] = Header(default=None, alias="Authorization")) -> Dict[str, Any]:
    return get_current_user(authorization)
