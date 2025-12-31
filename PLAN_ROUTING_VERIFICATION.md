# Plan Routing Verification Guide

This guide helps you verify that the correct AI model is being called based on the selected plan.

## Plan to AI Model Mapping

| Plan  | AI Model | Implementation File |
|-------|----------|---------------------|
| **GO**    | Gemini   | `lazycook6.py` |
| **PRO**   | Grok     | `lazycook7_grok.py` |
| **ULTRA** | Mixed    | `lazycook_grok_gemini_2.py` (Grok + Gemini) |

## How to Verify Plan Routing

### Method 1: Check Backend Logs (Recommended)

When you make an AI request, the backend will log detailed routing information:

1. **Start your backend server:**
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   uvicorn main:app --reload
   ```

2. **Make a request from the frontend** (select a plan and send a message)

3. **Check the terminal output** - You'll see logs like:
   ```
   🔍 Plan Routing Debug:
      - X-User-Plan header: PRO
      - User dict plan: None
      - Final resolved plan: PRO
      - User ID: <firebase_uid>
      - Requested model: grok
      - Allowed model for plan PRO: grok
      - Requested model: grok
      ✅ Routing to: grok (for plan PRO)
      ✅ Response received from: grok
   ```

### Method 2: Use Debug Endpoint

Call the debug endpoint to see which plan is detected:

**In Browser or Postman:**
```
GET http://localhost:8000/debug/plan-routing
Headers:
  Authorization: Bearer <your_firebase_token>
  X-User-ID: <your_firebase_uid>
  X-User-Plan: PRO
```

**Response:**
```json
{
  "detected_plan": "PRO",
  "expected_ai_model": "grok",
  "plan_source": "X-User-Plan header",
  "user_id": "<your_uid>",
  "plan_mapping": {
    "GO": "gemini (lazycook6.py)",
    "PRO": "grok (lazycook7_grok.py)",
    "ULTRA": "mixed (lazycook_grok_gemini_2.py)"
  },
  "your_plan_routes_to": "grok for plan PRO"
}
```

### Method 3: Check API Response

The API response now includes a `_debug` field with routing information:

```json
{
  "model": "grok",
  "response": "...",
  "_debug": {
    "plan": "PRO",
    "expected_model": "grok",
    "actual_model": "grok",
    "user_id": "<your_uid>"
  }
}
```

### Method 4: Check Frontend Console

Open browser DevTools (F12) → Console tab. When you send a message, check:
- Network tab → Find `/ai/run` request → Check Request Headers:
  - `X-User-Plan: PRO` (should match your selected plan)
  - `Authorization: Bearer <token>`
  - `X-User-ID: <firebase_uid>`

## Expected Behavior

### GO Plan:
- ✅ Should route to `gemini`
- ✅ Uses `lazycook6.py`
- ✅ Response should have `"model": "gemini"` in metadata

### PRO Plan:
- ✅ Should route to `grok`
- ✅ Uses `lazycook7_grok.py`
- ✅ Response should have `"model": "grok"` in metadata

### ULTRA Plan:
- ✅ Should route to `mixed`
- ✅ Uses `lazycook_grok_gemini_2.py`
- ✅ Response should have `"model": "mixed"` in metadata
- ✅ Combines both Grok and Gemini responses

## Troubleshooting

### Issue: "Upgrade plan to access this AI" error

**Check:**
1. Is `X-User-Plan` header being sent? (Check Network tab)
2. Is the plan value correct? (GO, PRO, or ULTRA - case insensitive)
3. Does the requested model match the plan? (GO→gemini, PRO→grok, ULTRA→mixed)

### Issue: Wrong AI model being called

**Check:**
1. Backend logs - what plan is detected?
2. Frontend - what plan is selected in the UI?
3. Firestore - what plan is stored for the user?

### Issue: Plan shows as "GO" when you selected "PRO"

**Check:**
1. Did you complete the plan selection? (Click "Continue with Selected Plan")
2. Check Firestore - is the plan saved correctly?
3. Check backend logs - what plan is in the `X-User-Plan` header?

## Quick Test Commands

### Test GO Plan:
```bash
curl -X POST http://localhost:8000/ai/run \
  -H "Authorization: Bearer <token>" \
  -H "X-User-ID: test_user" \
  -H "X-User-Plan: GO" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "model": "gemini"}'
```

### Test PRO Plan:
```bash
curl -X POST http://localhost:8000/ai/run \
  -H "Authorization: Bearer <token>" \
  -H "X-User-ID: test_user" \
  -H "X-User-Plan: PRO" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "model": "grok"}'
```

### Test ULTRA Plan:
```bash
curl -X POST http://localhost:8000/ai/run \
  -H "Authorization: Bearer <token>" \
  -H "X-User-ID: test_user" \
  -H "X-User-Plan: ULTRA" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "model": "mixed"}'
```

## Verification Checklist

- [ ] Backend logs show correct plan detection
- [ ] Debug endpoint returns correct plan and model mapping
- [ ] API response includes `_debug` field with correct info
- [ ] Frontend sends `X-User-Plan` header correctly
- [ ] Selected plan matches the AI model being used
- [ ] No "Upgrade plan" errors when using correct plan

