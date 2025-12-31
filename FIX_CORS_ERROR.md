# Fix CORS Error: Backend Not Allowing Vercel Frontend

## 🔴 Problem

**Error:** 
```
Access to fetch at 'https://lazycook-backend.onrender.com/ai/run' from origin 'https://thelazycook-ai.vercel.app' has been blocked by CORS policy
```

**Frontend URL:** `https://thelazycook-ai.vercel.app`  
**Backend URL:** `https://lazycook-backend.onrender.com`

## ✅ Solution: Update CORS_ORIGINS in Render

The backend needs to allow requests from your Vercel frontend URL.

### Step 1: Go to Render Dashboard

1. **Go to [dashboard.render.com](https://dashboard.render.com)**
2. **Click on your service:** `lazycook-backend`
3. **Go to "Environment" tab**

### Step 2: Update CORS_ORIGINS

1. **Find the `CORS_ORIGINS` environment variable**
2. **Update it to:**
   ```
   https://thelazycook-ai.vercel.app
   ```
   **Or if you want to allow multiple origins (comma-separated):**
   ```
   https://thelazycook-ai.vercel.app,https://thelazycook-ai-git-main.vercel.app,https://thelazycook-ai-*.vercel.app
   ```
   **Or to allow all Vercel preview deployments:**
   ```
   https://thelazycook-ai.vercel.app,https://*.vercel.app
   ```

3. **Click "Save Changes"**
4. **Render will automatically redeploy** (takes 2-3 minutes)

### Step 3: Verify

1. **Wait for Render to finish redeploying**
2. **Check Render logs** to make sure it started successfully
3. **Test from your frontend:**
   - Visit: `https://thelazycook-ai.vercel.app`
   - Try sending a message
   - Should now work without CORS errors!

---

## 🔧 Alternative: Allow All Origins (Less Secure)

If you want to allow all origins (for testing only):

1. **Set `CORS_ORIGINS` to:**
   ```
   *
   ```
2. **Save and redeploy**

**⚠️ Warning:** This is less secure. Only use for development/testing.

---

## 📋 Quick Fix Summary

1. Render → Your service → Environment tab
2. Find `CORS_ORIGINS`
3. Set to: `https://thelazycook-ai.vercel.app`
4. Save → Auto-redeploys
5. Test!

---

## 🧪 Test After Fix

1. **Visit your frontend:** `https://thelazycook-ai.vercel.app`
2. **Open browser console** (F12)
3. **Try sending a message**
4. **Should NOT see CORS errors anymore**
5. **Should successfully connect to backend**

---

## 🐛 If Still Not Working

1. **Check Render logs:**
   - Service → Logs tab
   - Make sure service restarted after CORS change
   - Look for any errors

2. **Verify CORS_ORIGINS value:**
   - Make sure there are no extra spaces
   - Make sure URL starts with `https://`
   - Make sure no trailing slash

3. **Check backend health:**
   - Visit: `https://lazycook-backend.onrender.com/health`
   - Should return: `{"ok": true}`

4. **Clear browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

---

## ✅ Expected Result

After updating CORS, your frontend should successfully make API calls to your Render backend without CORS errors!

