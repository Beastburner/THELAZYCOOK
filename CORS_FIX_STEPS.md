# 🔧 Fix CORS Error - Step by Step

## Current Error
```
Access to fetch at 'https://lazycook-backend.onrender.com/ai/run' from origin 'https://thelazycook-ai.vercel.app' has been blocked by CORS policy
```

## ✅ Solution: Update CORS_ORIGINS in Render

### Step 1: Go to Render Dashboard
1. Visit: https://dashboard.render.com
2. Click on your service: **`lazycook-backend`**

### Step 2: Navigate to Environment Tab
1. Click on **"Environment"** tab (left sidebar)
2. Scroll down to find **`CORS_ORIGINS`** variable

### Step 3: Update CORS_ORIGINS Value

**Option A: Allow only your Vercel frontend (Recommended)**
```
https://thelazycook-ai.vercel.app
```

**Option B: Allow all Vercel deployments (if you have preview deployments)**
```
https://thelazycook-ai.vercel.app,https://*.vercel.app
```

**Option C: Allow all origins (for testing only - less secure)**
```
*
```

### Step 4: Save and Wait
1. Click **"Save Changes"** button
2. Render will automatically redeploy (takes 2-3 minutes)
3. Wait for deployment to complete (check "Events" or "Logs" tab)

### Step 5: Verify Deployment
1. Go to **"Logs"** tab
2. Look for: `CORS: Allowing origins: [...]` in the startup logs
3. Make sure service shows **"Live"** status

### Step 6: Test
1. Visit your frontend: https://thelazycook-ai.vercel.app
2. Open browser console (F12)
3. Try sending a message
4. **Should NOT see CORS errors anymore!**

---

## 🐛 Troubleshooting

### If CORS error persists:

1. **Check Render Logs:**
   - Service → Logs tab
   - Look for CORS configuration message
   - Verify the service restarted after environment change

2. **Verify CORS_ORIGINS value:**
   - No extra spaces
   - URL starts with `https://`
   - No trailing slash
   - Exact match with your Vercel URL

3. **Check Backend Health:**
   - Visit: https://lazycook-backend.onrender.com/health
   - Should return: `{"ok": true}`

4. **Clear Browser Cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache completely

5. **Check Network Tab:**
   - Open browser DevTools → Network tab
   - Try sending a message
   - Look at the failed request
   - Check "Response Headers" - should have `Access-Control-Allow-Origin`

---

## 📋 Quick Checklist

- [ ] Updated `CORS_ORIGINS` in Render Environment tab
- [ ] Saved changes
- [ ] Waited for Render to redeploy (2-3 minutes)
- [ ] Checked Render logs for CORS message
- [ ] Service status is "Live"
- [ ] Tested from frontend
- [ ] No CORS errors in browser console

---

## ✅ Expected Result

After updating CORS_ORIGINS and redeploying:
- ✅ Frontend can successfully make API calls to backend
- ✅ No CORS errors in browser console
- ✅ Messages send successfully
- ✅ AI responses work correctly

---

## 🔍 Debug Info

**Frontend URL:** `https://thelazycook-ai.vercel.app`  
**Backend URL:** `https://lazycook-backend.onrender.com`  
**CORS_ORIGINS should be:** `https://thelazycook-ai.vercel.app`

