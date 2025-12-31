# Deploy LazyCook: Render (Backend) + Vercel (Frontend)

Complete step-by-step guide to deploy your LazyCook application.

---

## 🎯 Overview

- **Backend (FastAPI):** Deploy to Render
- **Frontend (React/Vite):** Deploy to Vercel
- **Database:** Firebase Firestore (already configured)

---

## 📦 Part 1: Deploy Backend to Render

### Step 1: Prepare Your Code

1. **Make sure your code is on GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

### Step 2: Create Render Account

1. **Go to [render.com](https://render.com)**
2. **Sign up** (free account works, no credit card needed for free tier)
3. **Login** to your account

### Step 3: Create Web Service

1. **Click "New +"** (top right)
2. **Select "Web Service"**
3. **Connect GitHub** (if not already connected):
   - Authorize Render to access your GitHub
   - Select your repository: `Beastburner/THELAZYCOOK`

### Step 4: Configure Service

1. **Basic Settings:**
   - **Name:** `lazycook-backend`
   - **Environment:** `Docker`
   - **Region:** Choose closest to your users (e.g., `Oregon (US West)`)
   - **Branch:** `main` (or your default branch)
   - **Root Directory:** Leave empty (root of repo)

2. **Docker Settings (scroll down to find these sections):**
   - **Docker Build Context Directory:** `.` (single dot - means repo root) ✅
   - **Dockerfile Path:** `Dockerfile` or `./Dockerfile` (should auto-detect) ✅
   - **Docker Command:** Leave empty (uses Dockerfile CMD) ✅
   - **Health Check Path:** Change from `/healthz` to `/health` ⚠️ **IMPORTANT:** Your FastAPI uses `/health` endpoint
   - **Registry Credential:** Leave as "No credential" (unless using private images)

3. **Plan:**
   - Select **"Free"** plan (or "Starter" if you want always-on)

### Step 5: Set Environment Variables

1. **Scroll to "Environment Variables" section**
2. **Click "Add Environment Variable"** for each:

   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   GROK_API_KEY=your_grok_api_key_here
   CORS_ORIGINS=*
   PORT=8000
   FIREBASE_SERVICE_ACCOUNT_PATH=/app/backend/serviceAccountKey.json
   ```

3. **Click "Save Changes"** after adding each variable

### Step 6: Upload Firebase Service Account Key

**Option A: Secret Files (Recommended)**

1. **Scroll to "Secret Files" section** (you should see it in the settings)
2. **Click "+ Add Secret File"** button
3. **In the "Secret File" modal that opens:**
   - **Filename:** Change from `file.txt` to `serviceAccountKey.json`
   - **File Contents:** 
     - Open your `backend/serviceAccountKey.json` file in a text editor
     - Copy the entire JSON content
     - Paste it into the "File Contents" text area
   - **Click "Save"** button
4. **The file will be accessible at:** `/app/backend/serviceAccountKey.json` during build and runtime

**Option B: Environment Variable (Base64)**

If Secret Files don't work:

1. **Convert JSON to base64:**
   ```bash
   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("backend/serviceAccountKey.json"))
   ```
2. **Add environment variable:**
   ```
   FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=<your_base64_string>
   ```
3. **Update `backend/firebase_config.py`** to decode it (if needed)

### Step 7: Deploy

1. **Click "Create Web Service"**
2. **Render will:**
   - Build your Docker container
   - Install dependencies
   - Start your FastAPI server
3. **Wait for deployment** (5-10 minutes)
4. **Watch the logs** for any errors

### Step 8: Get Your Backend URL

1. **Once deployed**, Render provides a URL:
   - Format: `https://lazycook-backend.onrender.com`
   - Or custom domain if configured
2. **Copy this URL** - you'll need it for frontend!

### Step 9: Test Backend

1. **Visit:** `https://your-backend.onrender.com/health`
2. **Should return:** `{"ok": true}`
3. **Visit:** `https://your-backend.onrender.com/docs`
4. **Should show:** FastAPI documentation

---

## 🎨 Part 2: Deploy Frontend to Vercel

### Step 1: Create Vercel Account

1. **Go to [vercel.com](https://vercel.com)**
2. **Sign up/Login** with GitHub (recommended for auto-deployments)

### Step 2: Create New Project

1. **Click "Add New..."** → **"Project"**
2. **Import Git Repository:**
   - If you see your repo, click "Import"
   - If not, click "Adjust GitHub App Permissions" and authorize

### Step 3: Configure Project

1. **Framework Preset:** Should auto-detect as `Vite` ✅
2. **Root Directory:** Click "Edit" → Change to `lazycook-ui`
3. **Build Command:** Should auto-fill as `npm run build` ✅
4. **Output Directory:** Should auto-fill as `dist` ✅
5. **Install Command:** Should auto-fill as `npm install` ✅

### Step 4: Set Environment Variables

**Before deploying**, click "Environment Variables" section and add:

**Firebase Configuration (7 variables):**
```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

**Backend API URL (1 variable):**
```
VITE_API_BASE=https://lazycook-backend.onrender.com
```
**Important:** Use your actual Render backend URL. If yours is different, replace with your URL.

**For each variable:**
- Select "Production", "Preview", and "Development"
- Click "Save"

### Step 5: Deploy

1. **Click "Deploy"** button
2. **Vercel will:**
   - Install dependencies
   - Build your React app
   - Deploy to CDN
3. **Wait for deployment** (2-3 minutes)
4. **Watch build logs** for any errors

### Step 6: Get Your Frontend URL

1. **Once deployed**, Vercel provides a URL:
   - Format: `https://lazycook-ui.vercel.app`
   - Or custom domain if configured
2. **Copy this URL**

---

## ✅ Part 3: Final Configuration

### Step 1: Update Backend CORS

1. **Go to Render dashboard:**
   - Open your `lazycook-backend` service
   - Go to "Environment" tab
2. **Find `CORS_ORIGINS` variable**
3. **Update it to:**
   ```
   https://your-frontend.vercel.app
   ```
   Replace with your actual Vercel URL
4. **Click "Save Changes"**
5. **Render will automatically redeploy**

### Step 2: Update Firebase Authorized Domains

1. **Go to [Firebase Console](https://console.firebase.google.com)**
2. **Select your project**
3. **Navigate to:** Authentication → Settings → Authorized domains
4. **Click "Add domain"**
5. **Enter:** `your-frontend.vercel.app` (your actual Vercel domain)
6. **Click "Add"**

### Step 3: Update Frontend API URL (if needed)

If you need to change the backend URL later:

1. **Vercel dashboard** → Your project → **Settings** → **Environment Variables**
2. **Update `VITE_API_BASE`** with your Render backend URL
3. **Redeploy** (Vercel auto-redeploys on next push, or click "Redeploy")

---

## 🧪 Part 4: Testing

### Test Backend

1. **Health Check:**
   - Visit: `https://your-backend.onrender.com/health`
   - Should return: `{"ok": true}`

2. **API Documentation:**
   - Visit: `https://your-backend.onrender.com/docs`
   - Should show FastAPI Swagger UI

### Test Frontend

1. **Load Frontend:**
   - Visit: `https://your-frontend.vercel.app`
   - Should load the login page

2. **Test Authentication:**
   - Sign up with email/password
   - Or sign in with Google
   - Should work without errors

3. **Test API Connection:**
   - After login, try sending a message to the AI
   - Check browser console (F12) for errors
   - Should successfully connect to Render backend

---

## 🐛 Troubleshooting

### Backend Issues

**Service Won't Start:**
- **Check Render logs:**
  - Service → "Logs" tab
  - Look for error messages
- **Common issues:**
  - Missing environment variables
  - Firebase service account key not found
  - Port configuration issues
  - Docker build failures

**CORS Errors:**
- **Symptom:** Browser console shows CORS errors
- **Fix:**
  - Update `CORS_ORIGINS` in Render to include your Vercel URL
  - No trailing slash
  - Format: `https://your-app.vercel.app`
  - Redeploy after updating

**Service Sleeps (Free Tier):**
- **Problem:** Service sleeps after 15 minutes of inactivity
- **First request takes ~30 seconds** (cold start)
- **Solution:**
  - Upgrade to "Starter" plan ($7/month) for always-on
  - Or accept cold starts (free tier limitation)

### Frontend Issues

**Build Fails:**
- **Check Vercel build logs:**
  - Project → "Deployments" → Click failed deployment
- **Common issues:**
  - Missing environment variables (must start with `VITE_`)
  - TypeScript errors
  - Missing dependencies
  - Build timeout

**Environment Variables Not Working:**
- **Frontend:** Variables must start with `VITE_` prefix
- **Check:** Vercel dashboard → Settings → Environment Variables
- **Redeploy:** After adding variables, trigger a new deployment

**Frontend Can't Connect to Backend:**
- **Check:** `VITE_API_BASE` is set correctly in Vercel
- **Check:** Render backend is running (visit `/health` endpoint)
- **Check:** CORS is configured correctly in Render
- **Check:** Browser console for specific error messages

### Firebase Issues

**Service Account Key Not Found:**
- **If using Secret File in Render:**
  - Make sure path is: `/app/backend/serviceAccountKey.json`
  - File should be valid JSON
- **If using base64:**
  - Make sure you decode it correctly in `firebase_config.py`

**Authentication Not Working:**
- **Check:** Firebase authorized domains include your Vercel URL
- **Check:** Firebase environment variables are correct in Vercel
- **Check:** Browser console for Firebase errors

---

## 📊 Monitoring

### Render Dashboard
- **View logs:** Service → "Logs" tab
- **View metrics:** Service → "Metrics" tab
- **View environment variables:** Service → "Environment" tab
- **View deployments:** Service → "Events" tab

### Vercel Dashboard
- **View deployments:** Project → "Deployments" tab
- **View logs:** Click on a deployment → "Functions" tab
- **View analytics:** Project → "Analytics" tab
- **View environment variables:** Project → Settings → Environment Variables

---

## 🔄 Updating Your App

### Update Backend
1. Make changes to your code
2. Commit and push to GitHub
3. Render will automatically redeploy

### Update Frontend
1. Make changes to your code
2. Commit and push to GitHub
3. Vercel will automatically redeploy

### Update Environment Variables
- **Render:** Service → Environment → Edit variables → Save (auto-redeploys)
- **Vercel:** Project → Settings → Environment Variables → Edit → Redeploy

---

## 💰 Free Tier Limits

### Render (Backend)
- ✅ **Free tier available**
- ⚠️ **Service sleeps after 15 minutes** of inactivity
- ⚠️ **First request after sleep takes ~30 seconds** (cold start)
- 💡 **Upgrade to "Starter" ($7/month)** for always-on service

### Vercel (Frontend)
- ✅ **Generous free tier**
- ✅ **100GB bandwidth/month**
- ✅ **Automatic HTTPS**
- ✅ **No sleep/wake issues**

---

## 📋 Deployment Checklist

Use this checklist to ensure everything is configured correctly:

### Pre-Deployment
- [ ] Code is pushed to GitHub
- [ ] All environment variables are documented
- [ ] Firebase project is set up
- [ ] API keys are ready (Gemini, Grok)

### Backend (Render)
- [ ] Render account created
- [ ] Web service created from GitHub repo
- [ ] Docker environment selected
- [ ] Environment variables set:
  - [ ] `GEMINI_API_KEY`
  - [ ] `GROK_API_KEY`
  - [ ] `CORS_ORIGINS` (set to `*` initially, update after frontend deploy)
  - [ ] `PORT=8000`
  - [ ] `FIREBASE_SERVICE_ACCOUNT_PATH=/app/backend/serviceAccountKey.json`
- [ ] Firebase service account key uploaded as Secret File
- [ ] Backend deployed successfully
- [ ] Backend URL copied (e.g., `https://lazycook-backend.onrender.com`)

### Frontend (Vercel)
- [ ] Vercel account created (GitHub login)
- [ ] Project created from GitHub repo
- [ ] Root directory set to `lazycook-ui`
- [ ] Framework preset: Vite
- [ ] Environment variables set:
  - [ ] `VITE_FIREBASE_API_KEY`
  - [ ] `VITE_FIREBASE_AUTH_DOMAIN`
  - [ ] `VITE_FIREBASE_PROJECT_ID`
  - [ ] `VITE_FIREBASE_STORAGE_BUCKET`
  - [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - [ ] `VITE_FIREBASE_APP_ID`
  - [ ] `VITE_FIREBASE_MEASUREMENT_ID`
  - [ ] `VITE_API_BASE` (your Render backend URL)
- [ ] Frontend deployed successfully
- [ ] Frontend URL copied (e.g., `https://lazycook-ui.vercel.app`)

### Post-Deployment
- [ ] Backend CORS updated with frontend URL
- [ ] Firebase authorized domains updated with frontend URL
- [ ] Backend health check: `https://your-backend.onrender.com/health` returns `{"ok": true}`
- [ ] Frontend loads correctly
- [ ] Authentication works (sign up/sign in)
- [ ] API calls work (test sending a message)
- [ ] No CORS errors in browser console
- [ ] No errors in Render logs
- [ ] No errors in Vercel build logs

### Testing
- [ ] Sign up with email/password
- [ ] Sign in with Google
- [ ] Plan selection works
- [ ] AI chat works (all 3 plans: GO, PRO, ULTRA)
- [ ] Chat history persists
- [ ] New chat creation works
- [ ] Chat deletion works
- [ ] Profile updates work

---

## 🎉 You're Done!

Your app is now live at:
- **Frontend:** `https://your-frontend.vercel.app`
- **Backend:** `https://your-backend.onrender.com`

Share your frontend URL with users!

---

## 🔗 Quick Links

- [Render Dashboard](https://dashboard.render.com)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Firebase Console](https://console.firebase.google.com)
- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)

---

## 💡 Tips

1. **Keep Render service awake:** Upgrade to Starter plan ($7/month) or accept cold starts
2. **Monitor usage:** Check Render and Vercel dashboards regularly
3. **Set up alerts:** Configure notifications for deployment failures
4. **Use custom domains:** Both Render and Vercel support custom domains
5. **Enable auto-deploy:** Both platforms auto-deploy on git push (default)

---

**Need help?** Check the troubleshooting section or platform documentation.

