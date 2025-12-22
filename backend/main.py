from __future__ import annotations

import os
import importlib
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict

import auth
from plans import FUNCTIONS, allowed_function_for_plan, normalize_requested_function

load_dotenv()

# IMPORTANT:
# `baby_final.py` implements the full AI logic with plan-based routing.
# It uses lazy imports to only load the needed module based on plan selection.
# We import it lazily inside the request handler so the API can still boot even if
# the AI module's optional dependencies aren't installed yet.


app = FastAPI(title="LazyCook API", version="1.0.0")


_origins_env = os.getenv("CORS_ORIGINS", "*").strip()
if not _origins_env or _origins_env == "*":
    _allow_origins = ["*"]
    _allow_credentials = False
else:
    _allow_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    # Dev convenience: React often runs on localhost but people paste 127.0.0.1 into env (or vice‑versa).
    for dev_origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
        if dev_origin not in _allow_origins:
            _allow_origins.append(dev_origin)
    _allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(auth.router)


# ---------------- AI routing (TEMP: no JWT/plan gating) ----------------
# Later:
# - Re-enable JWT enforcement (Depends(auth.get_current_user))
# - Enforce plan -> model routing using plans.py (GO->gemini, PRO->grok, ULTRA->mixed)
# - Add AWS persistence for conversations/usage/payments

class AIRunIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    prompt: str
    # Client may send a model; backend will validate against plan.
    model: Optional[str] = None


@app.post("/ai/run")
def ai_run(
    payload: AIRunIn,
    user: Dict[str, Any] = Depends(auth.get_current_user),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-ID"),
) -> Any:
    try:
        baby_final = importlib.import_module("baby_final")
    except ModuleNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"AI module import failed: {e}") from e

    # Get user's plan and validate
    user_plan = user.get("plan", "GO").upper().strip()
    
    # If client provides a model, validate it strictly (no frontend choosing higher tiers)
    if payload.model is not None:
        requested = normalize_requested_function(payload.model)
        if requested not in FUNCTIONS:
            raise HTTPException(status_code=400, detail="Invalid model")
        # Check if requested model matches the plan's allowed model
        allowed_fn_name = allowed_function_for_plan(user_plan)
        if requested != allowed_fn_name:
            raise HTTPException(status_code=403, detail="Upgrade plan to access this AI")

    user_id = (x_user_id or user["user_id"]).strip() or user["user_id"]

    # Route to the plan-based AI implementation using the main entry function
    try:
        result = baby_final.run_assistant_by_plan(
            plan=user_plan,
            prompt=payload.prompt,
            user_id=user_id,
            conversation_limit=70,
            document_limit=2
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}") from e

    # AWS-ready integration points (NOT IMPLEMENTED YET):
    # - Store conversation history (user prompt + assistant response)
    # - Store AI quality/metadata returned by LazyCook
    # - Store usage metrics & enforcement
    # - Store payment/subscription history and plan changes

    return result
