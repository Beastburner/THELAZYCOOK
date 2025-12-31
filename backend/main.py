from __future__ import annotations

import os
import importlib
import logging
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict

import auth
from plans import FUNCTIONS, allowed_function_for_plan, normalize_requested_function

load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# IMPORTANT:
# `baby_final.py` implements the full AI logic with plan-based routing.
# It uses lazy imports to only load the needed module based on plan selection.
# We import it lazily inside the request handler so the API can still boot even if
# the AI module's optional dependencies aren't installed yet.


app = FastAPI(title="LazyCook API", version="1.0.0")


# CORS Configuration
_origins_env = os.getenv("CORS_ORIGINS", "*").strip()
if not _origins_env or _origins_env == "*":
    _allow_origins = ["*"]
    _allow_credentials = False
    logger.info("CORS: Allowing all origins (*)")
else:
    _allow_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    # Remove trailing slashes and normalize origins
    _allow_origins = [origin.rstrip('/') for origin in _allow_origins]
    # Dev convenience: React often runs on localhost but people paste 127.0.0.1 into env (or vice‑versa).
    for dev_origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
        if dev_origin not in _allow_origins:
            _allow_origins.append(dev_origin)
    # Production frontend (Vercel)
    for prod_origin in ("https://lazycook-ai.vercel.app", "https://lazycook-ai.vercel.app/"):
        if prod_origin.rstrip('/') not in [o.rstrip('/') for o in _allow_origins]:
            _allow_origins.append(prod_origin.rstrip('/'))
    _allow_credentials = True
    logger.info(f"CORS: Allowing origins: {_allow_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/debug/firestore-status")
def firestore_status():
    """
    Debug endpoint to check Firestore connection status.
    """
    try:
        from firebase_config import get_db
        db = get_db()
        
        if db is None:
            return {
                "status": "not_configured",
                "message": "Firestore client not initialized. Check Firebase credentials.",
                "check": "Verify FIREBASE_SERVICE_ACCOUNT_PATH in .env points to valid service account key"
            }
        
        # Try a simple read operation
        test_ref = db.collection('_test').document('connection')
        test_ref.set({'timestamp': 'test', 'status': 'connected'}, merge=True)
        test_doc = test_ref.get()
        
        return {
            "status": "connected",
            "message": "Firestore is working correctly",
            "test_write": "success",
            "test_read": "success" if test_doc.exists else "failed"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "error_type": type(e).__name__
        }


@app.get("/debug/plan-routing")
def debug_plan_routing(
    user: Dict[str, Any] = Depends(auth.get_current_user),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-ID"),
    x_user_plan: Optional[str] = Header(default=None, alias="X-User-Plan"),
):
    """
    Debug endpoint to check plan routing.
    Returns information about which plan is detected and which file will be called.
    Uses the same logic as baby_final.py to determine routing.
    """
    user_plan = (x_user_plan or user.get("plan") or "GO").upper().strip()
    expected_model = allowed_function_for_plan(user_plan)
    
    # Map model to file name based on actual imports in baby_final.py
    # This mirrors the exact logic from baby_final.py:
    # - gemini() function (line 90) imports lazycook6
    # - grok() function (line 157) imports lazycook7_grok
    # - mixed() function (line 232) imports lazycook_grok_gemini_2
    model_to_file = {
        "gemini": "lazycook6.py",
        "grok": "lazycook7_grok.py",
        "mixed": "lazycook_grok_gemini_2.py"
    }
    expected_file = model_to_file.get(expected_model, "unknown")
    
    # Show the routing chain from baby_final.py
    routing_chain = {
        "GO": {
            "plan": "GO",
            "plan_to_model": "PLAN_TO_MODEL['GO'] = 'gemini' (line 58)",
            "function_called": "gemini() (line 312)",
            "import_statement": "import lazycook6 (line 90)",
            "file_called": "lazycook6.py"
        },
        "PRO": {
            "plan": "PRO",
            "plan_to_model": "PLAN_TO_MODEL['PRO'] = 'grok' (line 59)",
            "function_called": "grok() (line 314)",
            "import_statement": "import lazycook7_grok (line 157)",
            "file_called": "lazycook7_grok.py"
        },
        "ULTRA": {
            "plan": "ULTRA",
            "plan_to_model": "PLAN_TO_MODEL['ULTRA'] = 'mixed' (line 60)",
            "function_called": "mixed() (line 316)",
            "import_statement": "import lazycook_grok_gemini_2 (line 232)",
            "file_called": "lazycook_grok_gemini_2.py"
        }
    }
    
    return {
        "detected_plan": user_plan,
        "calling_file": expected_file,
        "ai_model": expected_model,
        "plan_source": "X-User-Plan header" if x_user_plan else ("user dict" if user.get("plan") else "default (GO)"),
        "user_id": x_user_id or user.get("user_id", "unknown"),
        "routing_chain": routing_chain.get(user_plan, {}),
        "routing_info": f"Plan {user_plan} → Model {expected_model} → File {expected_file}",
        "verification": "Based on baby_final.py PLAN_TO_MODEL mapping and function imports"
    }


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
    chat_id: Optional[str] = None  # Link conversation to a specific chat


def _ai_run_handler(
    payload: AIRunIn,
    user: Dict[str, Any] = Depends(auth.get_current_user),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-ID"),
    x_user_plan: Optional[str] = Header(default=None, alias="X-User-Plan"),
) -> Any:
    try:
        baby_final = importlib.import_module("baby_final")
    except ModuleNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"AI module import failed: {e}") from e

    # Get user's plan - prefer header, then user dict, then default
    user_plan = (x_user_plan or user.get("plan") or "GO").upper().strip()
    
    # Log plan and routing info for debugging
    logger.info(f"🔍 Plan Routing Debug:")
    logger.info(f"   - X-User-Plan header: {x_user_plan}")
    logger.info(f"   - User dict plan: {user.get('plan')}")
    logger.info(f"   - Final resolved plan: {user_plan}")
    logger.info(f"   - User ID: {x_user_id or user.get('user_id')}")
    logger.info(f"   - Requested model: {payload.model}")
    
    # If client provides a model, validate it strictly (no frontend choosing higher tiers)
    if payload.model is not None:
        requested = normalize_requested_function(payload.model)
        if requested not in FUNCTIONS:
            raise HTTPException(status_code=400, detail="Invalid model")
        # Check if requested model matches the plan's allowed model
        allowed_fn_name = allowed_function_for_plan(user_plan)
        logger.info(f"   - Allowed model for plan {user_plan}: {allowed_fn_name}")
        logger.info(f"   - Requested model: {requested}")
        if requested != allowed_fn_name:
            logger.warning(f"   ⚠️ Plan mismatch! Plan {user_plan} allows {allowed_fn_name}, but {requested} was requested")
            raise HTTPException(status_code=403, detail="Upgrade plan to access this AI")
    
    user_id = (x_user_id or user["user_id"]).strip() or user["user_id"]
    
    # Determine which AI will be called using the same logic as baby_final.py
    expected_model = allowed_function_for_plan(user_plan)
    
    # Map model to file name based on actual imports in baby_final.py
    # This mirrors the exact logic: gemini() imports lazycook6, grok() imports lazycook7_grok, mixed() imports lazycook_grok_gemini_2
    model_to_file = {
        "gemini": "lazycook6.py",           # From gemini() function line 90: import lazycook6
        "grok": "lazycook7_grok.py",        # From grok() function line 157: import lazycook7_grok
        "mixed": "lazycook_grok_gemini_2.py" # From mixed() function line 232: import lazycook_grok_gemini_2
    }
    expected_file = model_to_file.get(expected_model, "unknown")
    
    logger.info(f"   ✅ Plan {user_plan} → Model {expected_model} → Calling {expected_file}")

    # Route to the plan-based AI implementation using the main entry function
    try:
        # Reduce conversation limit for Groq-based plans (PRO, ULTRA) to avoid token limits
        # Groq has lower token limits (12000 TPM) compared to Gemini
        if user_plan in ["PRO", "ULTRA"]:
            conversation_limit = 15  # Reduced for Groq API limits
        else:
            conversation_limit = 30  # Reduced from 70 for better performance
        
        logger.info(f"📥 [BACKEND] Received chat_id from payload: {payload.chat_id}")
        logger.info(f"📥 [BACKEND] Payload contents: prompt={payload.prompt[:50]}..., model={payload.model}, chat_id={payload.chat_id}")
        
        result = baby_final.run_assistant_by_plan(
            plan=user_plan,
            prompt=payload.prompt,
            user_id=user_id,
            conversation_limit=conversation_limit,
            document_limit=2,
            chat_id=payload.chat_id  # Pass chat_id to filter context by chat
        )
        
        # Map model to file name based on actual imports in baby_final.py
        model_to_file = {
            "gemini": "lazycook6.py",           # From gemini() function line 90: import lazycook6
            "grok": "lazycook7_grok.py",        # From grok() function line 157: import lazycook7_grok
            "mixed": "lazycook_grok_gemini_2.py" # From mixed() function line 232: import lazycook_grok_gemini_2
        }
        actual_model = result.get("model", "unknown")
        actual_file = model_to_file.get(actual_model, "unknown")
        
        # Add debug info to response
        if isinstance(result, dict):
            result["_debug"] = {
                "plan": user_plan,
                "calling_file": expected_file,
                "actual_file_called": actual_file,
                "expected_model": expected_model,
                "actual_model": actual_model,
                "user_id": user_id,
                "routing_info": f"Plan {user_plan} → Model {expected_model} → File {expected_file}",
                "verification": "Based on baby_final.py: PLAN_TO_MODEL mapping → function call → import statement"
            }
            logger.info(f"   ✅ Response received from: {actual_file} (model: {actual_model})")
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


# Register both endpoints for backward compatibility
@app.post("/chat")(_ai_run_handler)
@app.post("/ai/run")(_ai_run_handler)  # Keep old endpoint for backward compatibility
