"""
baby_final.py

Plan-based AI assistant router for LazyCook API.

Plan Mapping:
- GO    → Gemini (lazycook6.py)
- PRO   → Grok (lazycook7_grok.py)
- ULTRA → Grok + Gemini (lazycook_grok_gemini_2.py)

This module provides API-ready functions that can be called from HTTP endpoints.
All assistant creation logic is centralized here.
"""

import os
import sys
import asyncio
import traceback
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Set up logging
logger = logging.getLogger(__name__)

# Safe print function that won't fail if stdout/stderr is closed
def safe_print(*args, **kwargs):
    """Safely print to stderr, catching I/O errors"""
    try:
        print(*args, file=sys.stderr, **kwargs)
    except (ValueError, OSError):
        # If stderr is closed, try to log instead
        try:
            logger.error(" ".join(str(arg) for arg in args))
        except:
            pass  # If all else fails, silently ignore

# Load environment variables from .env file
load_dotenv()

# Helper function to get API keys (reloads from env each time to handle dynamic updates)
def get_api_keys():
    """Get API keys from environment, reloading .env if needed"""
    load_dotenv(override=True)  # Reload to pick up any changes
    gemini_key = os.getenv("GEMINI_API_KEY")
    grok_key = os.getenv("GROK_API_KEY")
    
    # Clean up keys: strip whitespace and remove surrounding quotes if present
    if gemini_key:
        gemini_key = gemini_key.strip().strip('"').strip("'")
    if grok_key:
        grok_key = grok_key.strip().strip('"').strip("'")
    
    return gemini_key, grok_key

# Plan to model mapping
PLAN_TO_MODEL = {
    "GO": "gemini",
    "PRO": "grok",
    "ULTRA": "mixed",
}


def gemini(
    prompt: str,
    conversation_limit: int = 70,
    document_limit: int = 2,
    user_id: str = "user_001"
) -> Dict[str, Any]:
    """
    Call Gemini-only implementation (lazycook6.py)
    
    Args:
        prompt: User query
        conversation_limit: Number of conversations to include in context
        document_limit: Not used for Gemini (kept for compatibility)
        user_id: Unique user identifier
        
    Returns:
        Dictionary with model info, response, and metadata
    """
    gemini_key, _ = get_api_keys()
    if not gemini_key:
        return {
            "model": "gemini",
            "error": "GEMINI_API_KEY not found in environment. Please set it in your .env file or environment variables."
        }
    
    try:
        import lazycook6
        
        # Create configured assistant factory
        config = lazycook6.create_assistant(
            gemini_key,
            conversation_limit=conversation_limit
        )
        assistant = config.create_assistant()
        
        # Process query - use process_user_message instead of run_cli
        response = asyncio.run(
            assistant.process_user_message(user_id, prompt)
        )
        
        # Get quality metrics
        insights = assistant.get_user_insights(user_id)
        
        return {
            "model": "gemini",
            "response": response,
            "metadata": {
                "quality_score": insights.get("average_quality_score", 0),
                "iterations": insights.get("average_iterations", 0),
                "conversation_limit": conversation_limit,
                "user_id": user_id,
                "note": "Uses Gemini-only approach via lazycook6.py"
            }
        }
        
    except Exception as e:
        error_details = traceback.format_exc()
        safe_print(f"ERROR in gemini(): {e}")
        safe_print(f"Traceback: {error_details}")
        return {
            "model": "gemini",
            "error": str(e),
            "error_details": error_details
        }


def grok(
    prompt: str,
    conversation_limit: int = 70,
    document_limit: int = 2,
    user_id: str = "user_001"
) -> Dict[str, Any]:
    """
    Call Grok-only implementation (lazycook7_grok.py)
    
    Args:
        prompt: User query
        conversation_limit: Number of conversations to include in context
        document_limit: Number of documents to include in context
        user_id: Unique user identifier
        
    Returns:
        Dictionary with model info, response, and metadata
    """
    _, grok_key = get_api_keys()
    if not grok_key:
        return {
            "model": "grok",
            "error": "GROK_API_KEY not found in environment. Please set it in your .env file or environment variables."
        }
    
    try:
        import lazycook7_grok
        
        # Create configured assistant with custom limits
        config = lazycook7_grok.create_assistant(
            grok_key,
            conversation_limit=conversation_limit,
            document_limit=document_limit
        )
        assistant = config.create_assistant()
        
        # Process query - use process_user_message instead of run_cli
        response = asyncio.run(
            assistant.process_user_message(user_id, prompt)
        )
        
        # Get quality metrics
        insights = assistant.get_user_insights(user_id)
        
        return {
            "model": "grok",
            "response": response,
            "metadata": {
                "quality_score": insights.get("average_quality_score", 0),
                "iterations": insights.get("average_iterations", 0),
                "conversation_limit": conversation_limit,
                "document_limit": document_limit,
                "user_id": user_id,
                "note": "Uses Grok-only approach via lazycook7_grok.py"
            }
        }
        
    except Exception as e:
        error_details = traceback.format_exc()
        safe_print(f"ERROR in grok(): {e}")
        safe_print(f"Traceback: {error_details}")
        return {
            "model": "grok",
            "error": str(e),
            "error_details": error_details
        }


def mixed(
    prompt: str,
    conversation_limit: int = 70,
    document_limit: int = 2,
    user_id: str = "user_001",
    run_parallel: bool = False
) -> Dict[str, Any]:
    """
    Call Grok+Gemini mixed implementation (lazycook_grok_gemini_2.py)
    
    Args:
        prompt: User query
        conversation_limit: Number of conversations to include in context
        document_limit: Number of documents to include in context
        user_id: Unique user identifier
        run_parallel: Not used (kept for compatibility)
        
    Returns:
        Dictionary with unified mixed model response
    """
    gemini_key, grok_key = get_api_keys()
    if not gemini_key or not grok_key:
        missing = []
        if not gemini_key:
            missing.append("GEMINI_API_KEY")
        if not grok_key:
            missing.append("GROK_API_KEY")
        return {
            "model": "mixed",
            "error": f"Missing required API keys: {', '.join(missing)}. Please set them in your .env file or environment variables."
        }
    
    try:
        import lazycook_grok_gemini_2
        
        # Create configured assistant with custom limits
        config = lazycook_grok_gemini_2.create_assistant(
            gemini_api_key=gemini_key,
            grok_api_key=grok_key,
            conversation_limit=conversation_limit,
            document_limit=document_limit
        )
        assistant = config.create_assistant()
        
        # Process query - use process_user_message instead of run_cli
        response = asyncio.run(
            assistant.process_user_message(user_id, prompt)
        )
        
        # Get quality metrics
        insights = assistant.get_user_insights(user_id)
        
        return {
            "model": "mixed",
            "response": response,  # Unified response from lazycook_grok_gemini_2.py
            "metadata": {
                "quality_score": insights.get("average_quality_score", 0),
                "iterations": insights.get("average_iterations", 0),
                "conversation_limit": conversation_limit,
                "document_limit": document_limit,
                "user_id": user_id,
                "note": "Uses Gemini + Grok hybrid approach via lazycook_grok_gemini_2.py"
            }
        }
        
    except Exception as e:
        error_details = traceback.format_exc()
        safe_print(f"ERROR in mixed(): {e}")
        safe_print(f"Traceback: {error_details}")
        return {
            "model": "mixed",
            "error": str(e),
            "error_details": error_details
        }


def run_assistant_by_plan(
    plan: str,
    prompt: str,
    user_id: str = "user_001",
    conversation_limit: int = 70,
    document_limit: int = 2
) -> Dict[str, Any]:
    """
    Main entry function: Route to the correct assistant based on plan.
    
    This is the primary function to call from HTTP endpoints.
    It maps plans to the appropriate AI model and returns structured responses.
    
    Args:
        plan: Subscription plan ("GO", "PRO", or "ULTRA")
        prompt: User query/message
        user_id: Unique user identifier
        conversation_limit: Number of conversations to include in context
        document_limit: Number of documents to include in context
        
    Returns:
        Dictionary with model info, response, and metadata
        
    Raises:
        ValueError: If plan is not recognized
    """
    plan_upper = plan.upper().strip()
    
    if plan_upper not in PLAN_TO_MODEL:
        raise ValueError(
            f"Unknown plan: {plan}. Supported plans: {list(PLAN_TO_MODEL.keys())}"
        )
    
    model = PLAN_TO_MODEL[plan_upper]
    
    # Route to the appropriate function
    if model == "gemini":
        return gemini(prompt, conversation_limit, document_limit, user_id)
    elif model == "grok":
        return grok(prompt, conversation_limit, document_limit, user_id)
    elif model == "mixed":
        return mixed(prompt, conversation_limit, document_limit, user_id)
    else:
        raise ValueError(f"Unknown model: {model}")


# CLI support (for backward compatibility and testing)
def run_cli_by_plan(plan: str):
    """
    Run CLI interface for a specific plan.
    
    This function is kept for backward compatibility and testing.
    For production API use, prefer run_assistant_by_plan().
    
    Args:
        plan: Subscription plan ("GO", "PRO", or "ULTRA")
    """
    plan_upper = plan.upper().strip()
    
    if plan_upper not in PLAN_TO_MODEL:
        safe_print(f"Unknown plan: {plan}. Supported plans: {list(PLAN_TO_MODEL.keys())}")
        return
    
    model = PLAN_TO_MODEL[plan_upper]
    
    try:
        gemini_key, grok_key = get_api_keys()
        
        if model == "gemini":
            if not gemini_key:
                safe_print("ERROR: GEMINI_API_KEY not found in environment")
                return
            import lazycook6
            config = lazycook6.create_assistant(
                gemini_key,
                conversation_limit=70
            )
            asyncio.run(config.run_cli())
            
        elif model == "grok":
            if not grok_key:
                safe_print("ERROR: GROK_API_KEY not found in environment")
                return
            import lazycook7_grok
            config = lazycook7_grok.create_assistant(
                grok_key,
                conversation_limit=70,
                document_limit=2
            )
            asyncio.run(config.run_cli())
            
        elif model == "mixed":
            if not gemini_key or not grok_key:
                missing = []
                if not gemini_key:
                    missing.append("GEMINI_API_KEY")
                if not grok_key:
                    missing.append("GROK_API_KEY")
                safe_print(f"ERROR: Missing required API keys: {', '.join(missing)}")
                return
            import lazycook_grok_gemini_2
            config = lazycook_grok_gemini_2.create_assistant(
                gemini_api_key=gemini_key,
                grok_api_key=grok_key,
                conversation_limit=70,
                document_limit=2
            )
            asyncio.run(config.run_cli())
            
    except Exception as e:
        safe_print(f"ERROR running CLI for plan {plan}: {e}")
        try:
            traceback.print_exc(file=sys.stderr)
        except (ValueError, OSError):
            pass


if __name__ == "__main__":
    # CLI mode: Allow running with plan as command-line argument
    import sys
    
    if len(sys.argv) > 1:
        plan = sys.argv[1]
        run_cli_by_plan(plan)
    else:
        safe_print("Usage: python baby_final.py <PLAN>")
        safe_print("Plans: GO, PRO, ULTRA")
        safe_print("\nExample: python baby_final.py GO")
