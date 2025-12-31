# Fix: Frontend Using localhost Instead of Render Backend

## 🔴 Problem

Your frontend is trying to connect to `http://localhost:8000` instead of your Render backend URL `https://lazycook-backend.onrender.com`.

**Error:** `POST http://localhost:8000/ai/run net::ERR_BLOCKED_BY_CLIENT`

## ✅ Solution: Add Environment Variable in Vercel

The `VITE_API_BASE` environment variable is missing or not set correctly in Vercel.

### Step 1: Go to Vercel Dashboard

1. **Go to [vercel.com](https://vercel.com)** → Login
2. **Select your project** (lazycook-ui or your project name)
3. **Go to Settings** → **Environment Variables**

### Step 2: Add VITE_API_BASE

1. **Click "Add New"** or **"Add Environment Variable"**
2. **Enter:**
   - **Key:** `VITE_API_BASE`
   - **Value:** `https://lazycook-backend.onrender.com`
   - **Environment:** Select all three:
     - ✅ Production
     - ✅ Preview  
     - ✅ Development
3. **Click "Save"**

### Step 3: Redeploy

**Option A: Automatic Redeploy**
- Vercel should automatically detect the new environment variable
- Or trigger a new deployment by:
  - Making a small commit and pushing to GitHub, OR
  - Going to Deployments tab → Click "..." on latest deployment → "Redeploy"

**Option B: Manual Redeploy**
1. Go to **Deployments** tab
2. Click **"..."** (three dots) on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete

### Step 4: Verify

1. **Visit your Vercel frontend URL**
2. **Open browser console** (F12)
3. **Look for:** `🔗 [FRONTEND] API_BASE: https://lazycook-backend.onrender.com`
4. **Try sending a message** - should now connect to Render backend

---

## 📋 Complete Environment Variables Checklist

Make sure ALL these are set in Vercel:

### Firebase (7 variables):
```
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Backend API (1 variable - THIS IS MISSING!):
```
VITE_API_BASE=https://lazycook-backend.onrender.com
```

**Important:** Replace with your actual Render backend URL if different!

---

## 🧪 Test After Fix

1. **Visit your Vercel frontend URL**
2. **Open browser console** (F12)
3. **Check console logs:**
   - Should see: `🔗 [FRONTEND] API_BASE: https://lazycook-backend.onrender.com`
   - Should NOT see: `http://localhost:8000`
4. **Try sending a message:**
   - Should successfully connect to Render backend
   - Should NOT show `ERR_BLOCKED_BY_CLIENT` error

---

## 🐛 If Still Not Working

1. **Clear browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache completely

2. **Check Vercel build logs:**
   - Vercel dashboard → Deployments → Click latest deployment
   - Check if build succeeded
   - Look for any errors

3. **Verify environment variable:**
   - Vercel → Settings → Environment Variables
   - Make sure `VITE_API_BASE` is listed
   - Make sure it's set for Production environment
   - Value should be: `https://lazycook-backend.onrender.com`

4. **Check Render backend:**
   - Visit: `https://lazycook-backend.onrender.com/health`
   - Should return: `{"ok": true}`
   - If not, backend might be sleeping (free tier) - wait 30 seconds and try again

---

## ⚠️ Note About MetaMask Errors

The MetaMask errors in console are harmless - they're just browser extension warnings. You can ignore them:
```
Uncaught (in promise) i: Failed to connect to MetaMask
```

This is not related to your app - it's just the MetaMask browser extension trying to connect.

---

## ✅ Quick Fix Summary

1. Vercel → Settings → Environment Variables
2. Add: `VITE_API_BASE` = `https://lazycook-backend.onrender.com`
3. Select: Production, Preview, Development
4. Save
5. Redeploy
6. Test!

