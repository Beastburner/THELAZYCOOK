# ✅ Environment Variable Verification

## Current Status

I can see that `FIREBASE_SERVICE_ACCOUNT_PATH` is already set in Render. Let's verify it's correct:

## Step 1: Verify FIREBASE_SERVICE_ACCOUNT_PATH Value

1. **Click the eye icon** next to `FIREBASE_SERVICE_ACCOUNT_PATH` to reveal the value
2. **It should be exactly:**
   ```
   /app/backend/serviceAccountKey.json
   ```
3. **If it's correct:** You're good! ✅
4. **If it's wrong or empty:**
   - Click to edit
   - Set it to: `/app/backend/serviceAccountKey.json`
   - Save

## Step 2: Check CORS_ORIGINS (Critical!)

While you're in the Environment tab:

1. **Scroll down** to find `CORS_ORIGINS`
2. **Check if it exists:**
   - If **missing**: Add it
   - If **exists**: Verify the value

3. **Set `CORS_ORIGINS` to:**
   ```
   https://thelazycook-ai.vercel.app
   ```
   **OR** (for testing, less secure):
   ```
   *
   ```

4. **Save if you made changes**

## Step 3: Verify All Required Environment Variables

Make sure these are all set:

- ✅ `FIREBASE_SERVICE_ACCOUNT_PATH` = `/app/backend/serviceAccountKey.json` (✅ Already set!)
- ⚠️ `CORS_ORIGINS` = `https://thelazycook-ai.vercel.app` (Check this!)
- ✅ `GEMINI_API_KEY` = (your Gemini API key)
- ✅ `GROK_API_KEY` = (your Grok API key)
- ✅ `PORT` = `8000` (optional, Render handles this)

## Step 4: After Making Changes

1. **Render will automatically redeploy** (takes 2-3 minutes)
2. **Wait for deployment to complete**
3. **Check Logs tab:**
   - Should see: `CORS: Allowing origins: [...]`
   - Should see: `Firebase Admin initialized with service account: /app/backend/serviceAccountKey.json`
   - Should NOT see: `Firestore client initialization failed`

## Step 5: Test Everything

### Test 1: Backend Health
```
https://lazycook-backend.onrender.com/health
```
**Expected:** `{"ok": true}`

### Test 2: Frontend Connection
1. Visit: https://thelazycook-ai.vercel.app
2. Open browser console (F12)
3. Try sending a message
4. **Should work without CORS errors!**

---

## ✅ Quick Checklist

- [x] `FIREBASE_SERVICE_ACCOUNT_PATH` is set (✅ You have this!)
- [ ] `FIREBASE_SERVICE_ACCOUNT_PATH` value is `/app/backend/serviceAccountKey.json` (verify with eye icon)
- [ ] `CORS_ORIGINS` is set (check this!)
- [ ] Secret file `serviceAccountKey.json` exists (✅ Already uploaded!)
- [ ] All API keys are set (GEMINI_API_KEY, GROK_API_KEY)
- [ ] Backend redeployed after any changes
- [ ] Tested frontend connection

---

## 🎯 Most Important Next Step

**Check `CORS_ORIGINS`** - This is critical for your frontend to work!

If `CORS_ORIGINS` is missing or wrong, your frontend will get CORS errors when trying to connect to the backend.

---

## 🐛 If You See CORS Errors After This

1. **Verify `CORS_ORIGINS` is set correctly**
2. **Check Render logs** for the CORS message
3. **Clear browser cache** (hard refresh: Ctrl+Shift+R)
4. **Try in incognito window**

---

## ✅ Expected Result

Once `CORS_ORIGINS` is set correctly:
- ✅ Frontend can connect to backend
- ✅ No CORS errors in browser console
- ✅ Messages send successfully
- ✅ AI responses work correctly

