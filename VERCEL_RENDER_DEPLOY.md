# Deploy to Vercel (Frontend) + Render (Backend)

Step-by-step guide to deploy your LazyCook app.

---

## 🎯 Part 1: Deploy Backend to Render

### Step 1: Prepare Your Code

1. **Make sure your code is on GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

### Step 2: Deploy to Render

1. **Go to [render.com](https://render.com)** and sign up/login

2. **Create a New Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

3. **Configure the Service:**
   - **Name:** `lazycook-backend`
   - **Environment:** `Docker`
   - **Region:** Choose closest to your users (e.g., `Oregon (US West)`)
   - **Branch:** `main` (or your default branch)
   - **Root Directory:** Leave empty (root of repo)
   - **Dockerfile Path:** `Dockerfile` (should auto-detect)
   - **Docker Build Context:** `.` (root directory)

4. **Set Environment Variables:**
   Click "Advanced" → "Add Environment Variable" and add:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   GROK_API_KEY=your_grok_api_key_here
   CORS_ORIGINS=*
   PORT=8000
   FIREBASE_SERVICE_ACCOUNT_PATH=/app/backend/serviceAccountKey.json
   ```

5. **Handle Firebase Service Account Key:**
   
   **Option A: Upload as Secret File (Recommended)**
   - In Render dashboard → Your service → "Environment" tab
   - Scroll to "Secret Files"
   - Click "Add Secret File"
   - **Name:** `serviceAccountKey.json`
   - **Path:** `/app/backend/serviceAccountKey.json`
   - Upload your `backend/serviceAccountKey.json` file
   
   **Option B: Use Environment Variable**
   - Convert your JSON file to base64:
     ```bash
     # On Windows (PowerShell)
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("backend/serviceAccountKey.json"))
     ```
   - Add environment variable:
     ```
     FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=<your_base64_string>
     ```
   - Update `backend/firebase_config.py` to decode it (we'll do this if needed)

6. **Deploy:**
   - Click "Create Web Service"
   - Render will build and deploy your Docker container
   - Wait for deployment to complete (5-10 minutes)

7. **Get Your Backend URL:**
   - Once deployed, Render will provide a URL like:
     `https://lazycook-backend.onrender.com`
   - **Copy this URL** - you'll need it for the frontend!

8. **Test Backend:**
   - Visit: `https://your-backend-url.onrender.com/health`
   - Should return: `{"ok": true}`

---

## 🎨 Part 2: Deploy Frontend to Vercel

### Step 1: Prepare Frontend

1. **Make sure `lazycook-ui/vercel.json` exists** (already created ✅)

2. **Push latest code to GitHub** (if not already done)

### Step 2: Deploy to Vercel

1. **Go to [vercel.com](https://vercel.com)** and sign up/login with GitHub

2. **Create New Project:**
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Select your repository

3. **Configure Project:**
   - **Framework Preset:** `Vite` (should auto-detect)
   - **Root Directory:** Click "Edit" → Set to `lazycook-ui`
   - **Build Command:** `npm run build` (should auto-fill)
   - **Output Directory:** `dist` (should auto-fill)
   - **Install Command:** `npm install` (should auto-fill)

4. **Set Environment Variables:**
   Click "Environment Variables" and add:
   ```
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   VITE_API_BASE=https://your-backend-url.onrender.com
   ```
   
   **Important:** Replace `your-backend-url.onrender.com` with the actual Render URL from Part 1!

5. **Deploy:**
   - Click "Deploy"
   - Vercel will build and deploy your frontend
   - Wait for deployment (2-3 minutes)

6. **Get Your Frontend URL:**
   - Vercel will provide a URL like:
     `https://lazycook-ui.vercel.app`
   - **Copy this URL**

---

## ✅ Part 3: Final Configuration

### Step 1: Update Backend CORS

1. **Go back to Render dashboard:**
   - Your backend service → "Environment" tab
   - Update `CORS_ORIGINS` environment variable:
     ```
     CORS_ORIGINS=https://your-frontend.vercel.app,https://your-frontend.vercel.app
     ```
   - Replace with your actual Vercel URL
   - Click "Save Changes"
   - Render will automatically redeploy

### Step 2: Update Firebase Authorized Domains

1. **Go to [Firebase Console](https://console.firebase.google.com)**
2. **Select your project**
3. **Authentication → Settings → Authorized domains**
4. **Click "Add domain"**
5. **Add your Vercel domain:** `your-frontend.vercel.app`
6. **Save**

### Step 3: Update Frontend API URL (if needed)

If you need to update the backend URL later:
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Update `VITE_API_BASE` with your Render backend URL
3. Redeploy (Vercel will auto-redeploy on next push, or click "Redeploy")

---

## 🧪 Testing Your Deployment

1. **Test Frontend:**
   - Visit your Vercel URL
   - Should load the login page

2. **Test Authentication:**
   - Sign up with email/password or Google
   - Should successfully authenticate

3. **Test API Connection:**
   - After login, try sending a message
   - Check browser console (F12) for any errors
   - Check Render logs for backend activity

4. **Test Backend Health:**
   - Visit: `https://your-backend.onrender.com/health`
   - Should return: `{"ok": true}`

---

## 🐛 Troubleshooting

### CORS Errors
- **Symptom:** Browser console shows CORS errors
- **Fix:** 
  - Update `CORS_ORIGINS` in Render to include your Vercel URL
  - Make sure there's no trailing slash
  - Format: `https://your-app.vercel.app`

### Backend Not Starting
- **Check Render logs:**
  - Render dashboard → Your service → "Logs" tab
  - Look for error messages
- **Common issues:**
  - Missing environment variables
  - Firebase service account key not found
  - Port configuration issues

### Frontend Build Fails
- **Check Vercel build logs:**
  - Vercel dashboard → Your project → "Deployments" → Click failed deployment
- **Common issues:**
  - Missing environment variables (must start with `VITE_`)
  - TypeScript errors
  - Missing dependencies

### Firebase Service Account Key Issues
- **If using Secret File in Render:**
  - Make sure path is: `/app/backend/serviceAccountKey.json`
  - File should be valid JSON
- **If using base64:**
  - Make sure you decode it correctly in `firebase_config.py`

### Environment Variables Not Working
- **Frontend:** Variables must start with `VITE_` prefix
- **Backend:** Restart service after adding variables
- **Both:** Make sure no typos, check for extra spaces

---

## 📊 Monitoring

### Render Dashboard
- View logs: Service → "Logs" tab
- View metrics: Service → "Metrics" tab
- View environment variables: Service → "Environment" tab

### Vercel Dashboard
- View deployments: Project → "Deployments" tab
- View logs: Click on a deployment → "Functions" tab
- View analytics: Project → "Analytics" tab

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
- ✅ Free tier available
- ⚠️ Service sleeps after 15 minutes of inactivity
- ⚠️ First request after sleep takes ~30 seconds (cold start)
- 💡 Consider upgrading to paid plan for always-on service

### Vercel (Frontend)
- ✅ Generous free tier
- ✅ 100GB bandwidth/month
- ✅ Automatic HTTPS
- ✅ No sleep/wake issues

---

## 🎉 You're Done!

Your app should now be live at:
- **Frontend:** `https://your-app.vercel.app`
- **Backend:** `https://your-backend.onrender.com`

Share your frontend URL with users!

