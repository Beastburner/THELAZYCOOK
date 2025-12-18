"""
plans.py

Single source of truth for subscription plan -> allowed AI routing.

STRICT RULES:
- GO    -> gemini()
- PRO   -> grok()
- ULTRA -> mixed()

No fallback. No partial access. Backend enforcement only.
"""

PLAN_TO_FUNCTION = {
    "GO": "gemini",
    "PRO": "grok",
    "ULTRA": "mixed",
}

PLANS = set(PLAN_TO_FUNCTION.keys())
FUNCTIONS = set(PLAN_TO_FUNCTION.values())


def allowed_function_for_plan(plan: str) -> str:
    try:
        return PLAN_TO_FUNCTION[plan]
    except KeyError as e:
        raise ValueError(f"Unknown plan: {plan}") from e


def normalize_requested_function(value: str) -> str:
    # Accept a few common client values, but backend remains authoritative.
    v = value.strip().lower()
    aliases = {
        "gemini": "gemini",
        "grok": "grok",
        "mixed": "mixed",
        "ai_type_1": "gemini",
        "ai_type_2": "grok",
        "ai_type_3": "mixed",
    }
    return aliases.get(v, v)
