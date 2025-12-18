# lazycook_caller.py
import os
import asyncio
from typing import Optional, Dict, Any, Literal
from lazycook_grok_gemini import (
    MultiAgentAssistantConfig as MixedConfig,
    AutonomousMultiAgentAssistant as MixedAssistant,
)
from LazyCook5_Foundational import (
    MultiAgentAssistantConfig as GeminiConfig,
    AutonomousMultiAgentAssistant as GeminiAssistant,
)

# Initialize API keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROK_API_KEY = os.getenv("GROK_API_KEY")


def gemini(
    prompt: str,
    conversation_limit: int = 70,
    document_limit: int = 2,
    user_id: str = "user_001"
) -> Dict[str, Any]:
    """
    Call LazyCook with Gemini only (LazyCook5_Foundational1.py)
    
    Args:
        prompt: User query
        conversation_limit: Number of conversations to include in context
        document_limit: Number of documents to include in context
        user_id: Unique user identifier
        
    Returns:
        Dictionary with model info and response
    """
    if not GEMINI_API_KEY:
        return {
            "model": "gemini",
            "error": "GEMINI_API_KEY not found in environment"
        }
    
    try:
        # Create assistant with Gemini only
        config = GeminiConfig(
            api_key=GEMINI_API_KEY,
            conversation_limit=conversation_limit
        )
        assistant = config.create_assistant()
        
        # Process query
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
                "user_id": user_id
            }
        }
        
    except Exception as e:
        return {
            "model": "gemini",
            "error": str(e)
        }


def grok(
    prompt: str,
    conversation_limit: int = 70,
    document_limit: int = 2,
    user_id: str = "user_001"
) -> Dict[str, Any]:
    """
    Call LazyCook with Grok for optimization (lazycook_grok_gemini.py)
    Note: Uses Gemini for generation/analysis, Grok for optimization/validation
    
    Args:
        prompt: User query
        conversation_limit: Number of conversations to include in context
        document_limit: Number of documents to include in context
        user_id: Unique user identifier
        
    Returns:
        Dictionary with model info and response
    """
    if not GEMINI_API_KEY or not GROK_API_KEY:
        return {
            "model": "grok",
            "error": "GEMINI_API_KEY and GROK_API_KEY required"
        }
    
    try:
        # Create assistant with mixed models
        config = MixedConfig(
            gemini_api_key=GEMINI_API_KEY,
            grok_api_key=GROK_API_KEY,
            conversation_limit=conversation_limit,
            document_limit=document_limit
        )
        assistant = config.create_assistant()
        
        # Process query
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
                "note": "Uses Gemini + Grok hybrid approach"
            }
        }
        
    except Exception as e:
        return {
            "model": "grok",
            "error": str(e)
        }


def mixed(
    prompt: str,
    conversation_limit: int = 70,
    document_limit: int = 2,
    user_id: str = "user_001",
    run_parallel: bool = False
) -> Dict[str, Any]:
    """
    Call both Gemini-only and Gemini+Grok versions
    
    Args:
        prompt: User query
        conversation_limit: Number of conversations to include in context
        document_limit: Number of documents to include in context
        user_id: Unique user identifier
        run_parallel: If True, run both in parallel (faster but uses more resources)
        
    Returns:
        Dictionary with responses from both models
    """
    if run_parallel:
        # Run both concurrently
        gemini_response, grok_response = asyncio.run(
            asyncio.gather(
                _async_gemini(prompt, conversation_limit, document_limit, user_id),
                _async_grok(prompt, conversation_limit, document_limit, user_id)
            )
        )
    else:
        # Run sequentially
        gemini_response = gemini(prompt, conversation_limit, document_limit, user_id)
        grok_response = grok(prompt, conversation_limit, document_limit, user_id)
    
    return {
        "model": "mixed",
        "responses": {
            "gemini": gemini_response,
            "grok": grok_response
        },
        "comparison": _compare_responses(gemini_response, grok_response)
    }


# Helper async functions for parallel execution
async def _async_gemini(
    prompt: str,
    conversation_limit: int,
    document_limit: int,
    user_id: str
) -> Dict[str, Any]:
    """Async wrapper for Gemini-only call"""
    return gemini(prompt, conversation_limit, document_limit, user_id)


async def _async_grok(
    prompt: str,
    conversation_limit: int,
    document_limit: int,
    user_id: str
) -> Dict[str, Any]:
    """Async wrapper for Grok call"""
    return grok(prompt, conversation_limit, document_limit, user_id)


def _compare_responses(gemini_resp: Dict, grok_resp: Dict) -> Dict[str, Any]:
    """Compare responses from both models"""
    comparison = {
        "both_successful": (
            "error" not in gemini_resp and "error" not in grok_resp
        )
    }
    
    if comparison["both_successful"]:
        gemini_meta = gemini_resp.get("metadata", {})
        grok_meta = grok_resp.get("metadata", {})
        
        comparison.update({
            "quality_scores": {
                "gemini": gemini_meta.get("quality_score", 0),
                "grok": grok_meta.get("quality_score", 0)
            },
            "iterations": {
                "gemini": gemini_meta.get("iterations", 0),
                "grok": grok_meta.get("iterations", 0)
            },
            "response_lengths": {
                "gemini": len(gemini_resp.get("response", "")),
                "grok": len(grok_resp.get("response", ""))
            }
        })
        
        # Determine which performed better
        if gemini_meta.get("quality_score", 0) > grok_meta.get("quality_score", 0):
            comparison["better_quality"] = "gemini"
        elif grok_meta.get("quality_score", 0) > gemini_meta.get("quality_score", 0):
            comparison["better_quality"] = "grok"
        else:
            comparison["better_quality"] = "equal"
    
    return comparison


# Advanced features
def lazycook_with_documents(
    prompt: str,
    document_paths: list[str],
    model: Literal["gemini", "grok", "mixed"] = "gemini",
    user_id: str = "user_001"
) -> Dict[str, Any]:
    """
    Process query with document upload
    
    Args:
        prompt: User query
        document_paths: List of file paths to upload
        model: Which model to use
        user_id: Unique user identifier
        
    Returns:
        Response with document processing info
    """
    try:
        # Choose config based on model
        if model == "grok" or model == "mixed":
            config = MixedConfig(
                gemini_api_key=GEMINI_API_KEY,
                grok_api_key=GROK_API_KEY
            )
        else:
            config = GeminiConfig(api_key=GEMINI_API_KEY)
        
        assistant = config.create_assistant()
        
        # Upload documents
        uploaded_docs = []
        for doc_path in document_paths:
            doc = assistant.file_manager.process_uploaded_file(doc_path, user_id)
            if doc:
                uploaded_docs.append({
                    "filename": doc.filename,
                    "size": doc.file_size,
                    "type": doc.file_type
                })
        
        # Process query
        response = asyncio.run(
            assistant.process_user_message(user_id, prompt)
        )
        
        return {
            "model": model,
            "response": response,
            "documents_uploaded": len(uploaded_docs),
            "document_details": uploaded_docs
        }
        
    except Exception as e:
        return {
            "model": model,
            "error": str(e)
        }


# Usage examples
if __name__ == "__main__":
    # Example 1: Simple Gemini call
    result = gemini("Explain quantum computing")
    print(f"Gemini: {result['response'][:100]}...")
    
    # Example 2: Grok (hybrid) call
    result = grok("Write a Python function for binary search")
    print(f"Grok: {result['response'][:100]}...")
    
    # Example 3: Mixed comparison
    result = mixed("What are the pros and cons of microservices?")
    print(f"Gemini quality: {result['comparison']['quality_scores']['gemini']}")
    print(f"Grok quality: {result['comparison']['quality_scores']['grok']}")
    
    # Example 4: With documents
    result = lazycook_with_documents(
        prompt="Summarize the main points from these documents",
        document_paths=["report.pdf", "notes.txt"],
        model="gemini"
    )
    print(f"Processed {result['documents_uploaded']} documents")