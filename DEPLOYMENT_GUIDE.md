# Deployment Guide for LazyCook

This guide covers deploying the **FastAPI backend** and **React/Vite frontend** separately.

---

## 🎯 Recommended Deployment Options

### **Frontend (React/Vite)** → **Vercel** (Recommended)
- ✅ Best for React/Vite apps
- ✅ Automatic HTTPS
- ✅ Free tier with generous limits
- ✅ Easy environment variable management
- ✅ Automatic deployments from Git

### **Backend (FastAPI)** → **Railway** or **Render**
- ✅ Easy Docker deployment
- ✅ Environment variable management
- ✅ Free tier available
- ✅ Good for Python/FastAPI

---

## 📦 Frontend Deployment (Vercel)

### Step 1: Prepare Frontend

1. **Create `vercel.json`** in `lazycook-ui/` directory:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

2. **Set Environment Variables in Vercel:**
   - Go to your project → Settings → Environment Variables
   - Add all your Firebase and API variables:
     ```
     VITE_FIREBASE_API_KEY=your_key
     VITE_FIREBASE_AUTH_DOMAIN=your_domain
     VITE_FIREBASE_PROJECT_ID=your_project_id
     VITE_FIREBASE_STORAGE_BUCKET=your_bucket
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
     VITE_API_BASE=https://your-backend-url.railway.app
     ```

### Step 2: Deploy to Vercel

**Option A: Via Vercel CLI**
```bash
cd lazycook-ui
npm install -g vercel
vercel login
vercel --prod
```

**Option B: Via GitHub (Recommended)**
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Set root directory to `lazycook-ui`
6. Add environment variables
7. Deploy!

---

## 🚀 Backend Deployment (Railway)

### Step 1: Prepare Backend

1. **Update `Dockerfile`** (already exists, but verify it's correct)

2. **Create `railway.json`** (optional, for Railway-specific config):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

3. **Create `.railwayignore`** (optional):
```
venv/
__pycache__/
*.pyc
*.log
multi_agent_data/
serviceAccountKey.json
.env
```

### Step 2: Deploy to Railway

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Initialize Railway project:**
   ```bash
   cd backend
   railway init
   ```

3. **Set Environment Variables:**
   ```bash
   railway variables set GEMINI_API_KEY=your_key
   railway variables set GROK_API_KEY=your_key
   railway variables set FIREBASE_SERVICE_ACCOUNT_PATH=/app/backend/serviceAccountKey.json
   railway variables set CORS_ORIGINS=*
   ```

4. **Upload Firebase Service Account Key:**
   - Go to Railway dashboard → Your project → Variables
   - Add `serviceAccountKey.json` as a file variable, OR
   - Use Railway's file upload feature

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Get your backend URL:**
   - Railway will provide a URL like: `https://your-app.railway.app`
   - Update your frontend's `VITE_API_BASE` with this URL

---

## 🔄 Alternative Backend Options

### **Option 2: Render**

1. **Create `render.yaml`** in project root:
```yaml
services:
  - type: web
    name: lazycook-backend
    env: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    envVars:
      - key: GEMINI_API_KEY
        sync: false
      - key: GROK_API_KEY
        sync: false
      - key: FIREBASE_SERVICE_ACCOUNT_PATH
        value: /app/backend/serviceAccountKey.json
      - key: CORS_ORIGINS
        value: *
    healthCheckPath: /health
```

2. **Deploy:**
   - Push to GitHub
   - Connect repository to Render
   - Render will auto-detect and deploy

### **Option 3: Fly.io**

1. **Create `fly.toml`**:
```toml
app = "lazycook-backend"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8000"

[[services]]
  internal_port = 8000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

2. **Deploy:**
   ```bash
   flyctl launch
   flyctl secrets set GEMINI_API_KEY=your_key
   flyctl secrets set GROK_API_KEY=your_key
   flyctl deploy
   ```

---

## 🔄 Alternative Frontend Options

### **Option 2: Netlify**

1. **Create `netlify.toml`** in `lazycook-ui/`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

2. **Deploy:**
   - Connect GitHub repo to Netlify
   - Set build directory to `lazycook-ui`
   - Add environment variables
   - Deploy!

### **Option 3: Cloudflare Pages**

1. **Build settings:**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `lazycook-ui`

2. **Deploy:**
   - Connect GitHub repo
   - Configure build settings
   - Add environment variables
   - Deploy!

---

## 🔐 Environment Variables Checklist

### Frontend (`.env` or Vercel/Netlify dashboard):
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_API_BASE=https://your-backend-url.railway.app
```

### Backend (Railway/Render/Fly.io dashboard):
```
GEMINI_API_KEY=
GROK_API_KEY=
FIREBASE_SERVICE_ACCOUNT_PATH=/app/backend/serviceAccountKey.json
CORS_ORIGINS=https://your-frontend.vercel.app,https://your-frontend.netlify.app
PORT=8000
```

---

## ✅ Post-Deployment Checklist

1. ✅ Update Firebase Auth authorized domains:
   - Go to Firebase Console → Authentication → Settings → Authorized domains
   - Add your frontend domain (e.g., `your-app.vercel.app`)

2. ✅ Update Firestore Security Rules:
   - Deploy `firestore.rules` to Firebase Console
   - Test rules in Firebase Console

3. ✅ Test CORS:
   - Verify backend accepts requests from frontend domain
   - Check browser console for CORS errors

4. ✅ Test Authentication:
   - Sign up/Sign in should work
   - Firebase tokens should be generated correctly

5. ✅ Test API Calls:
   - Frontend should successfully call backend API
   - Check backend logs for incoming requests

---

## 🐛 Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGINS` includes your frontend URL
- Check backend logs for CORS-related errors

### Environment Variables Not Working
- Frontend: Variables must start with `VITE_` to be accessible
- Backend: Restart service after adding variables

### Firebase Service Account Key
- Upload as file in Railway/Render dashboard
- Or use base64 encoding and decode in code

### Build Failures
- Check build logs in deployment platform
- Verify all dependencies are in `requirements.txt` / `package.json`
- Ensure Dockerfile is correct

---

## 📊 Cost Comparison

| Platform | Frontend | Backend | Free Tier |
|----------|----------|---------|-----------|
| **Vercel** | ✅ Best | ❌ | 100GB bandwidth/month |
| **Railway** | ⚠️ | ✅ Best | $5 credit/month |
| **Render** | ✅ Good | ✅ Good | Free tier (sleeps after inactivity) |
| **Netlify** | ✅ Best | ❌ | 100GB bandwidth/month |
| **Fly.io** | ⚠️ | ✅ Good | 3 shared VMs free |

**Recommended Combo: Vercel (Frontend) + Railway (Backend)**

---

## 🔗 Quick Links

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Render Documentation](https://render.com/docs)
- [Firebase Console](https://console.firebase.google.com)

