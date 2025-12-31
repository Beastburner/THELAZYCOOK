# Quick Start: Deploy to Vercel + Render

## 🚀 Backend → Render (5 minutes)

1. **Go to [render.com](https://render.com)** → Sign up/Login
2. **New +** → **Web Service** → Connect GitHub repo
3. **Settings:**
   - Name: `lazycook-backend`
   - Environment: `Docker`
   - Branch: `main`
4. **Environment Variables:**
   ```
   GEMINI_API_KEY=your_key
   GROK_API_KEY=your_key
   CORS_ORIGINS=*
   PORT=8000
   ```
5. **Secret Files:**
   - Add `serviceAccountKey.json` → Path: `/app/backend/serviceAccountKey.json`
6. **Deploy** → Copy backend URL: `https://your-backend.onrender.com`

---

## 🎨 Frontend → Vercel (3 minutes)

1. **Go to [vercel.com](https://vercel.com)** → Sign up/Login with GitHub
2. **Add New Project** → Import GitHub repo
3. **Settings:**
   - Root Directory: `lazycook-ui`
   - Framework: `Vite` (auto-detected)
4. **Environment Variables:**
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_MEASUREMENT_ID=...
   VITE_API_BASE=https://your-backend.onrender.com
   ```
5. **Deploy** → Copy frontend URL: `https://your-app.vercel.app`

---

## ✅ Final Steps (2 minutes)

1. **Update Render CORS:**
   - Render → Environment → `CORS_ORIGINS` → `https://your-app.vercel.app`
   
2. **Update Firebase:**
   - Firebase Console → Auth → Settings → Add domain: `your-app.vercel.app`

---

## 🧪 Test

- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-backend.onrender.com/health` → Should return `{"ok": true}`

---

**Full guide:** See `VERCEL_RENDER_DEPLOY.md` for detailed instructions.

