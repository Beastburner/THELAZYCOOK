# Quick Deployment Steps

## 🚀 Fastest Way to Deploy

### Frontend → Vercel (5 minutes)

1. **Push to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/lazycook.git
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com) → Sign up/Login
   - Click "New Project" → Import your GitHub repo
   - **Root Directory:** Set to `lazycook-ui`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

3. **Add Environment Variables:**
   - In Vercel project → Settings → Environment Variables
   - Add all `VITE_*` variables from your `.env` file
   - **Important:** Add `VITE_API_BASE` pointing to your backend URL (you'll get this after backend deployment)

4. **Deploy!** → Vercel will auto-deploy

---

### Backend → Railway (10 minutes)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Deploy:**
   ```bash
   cd backend
   railway init
   railway up
   ```

3. **Add Environment Variables:**
   - Go to Railway dashboard → Your project → Variables
   - Add:
     ```
     GEMINI_API_KEY=your_key
     GROK_API_KEY=your_key
     CORS_ORIGINS=*
     PORT=8000
     ```
   - For Firebase service account:
     - Option 1: Upload `serviceAccountKey.json` as a file
     - Option 2: Convert to base64 and set as env var, then decode in code

4. **Get Backend URL:**
   - Railway provides: `https://your-app.railway.app`
   - Copy this URL

5. **Update Frontend:**
   - Go back to Vercel → Environment Variables
   - Update `VITE_API_BASE` with your Railway URL
   - Redeploy frontend

---

## ✅ Final Steps

1. **Update Firebase:**
   - Firebase Console → Authentication → Settings → Authorized domains
   - Add: `your-app.vercel.app`

2. **Test:**
   - Visit your Vercel URL
   - Sign up/Sign in
   - Test AI chat

---

## 🎯 Recommended: Vercel + Railway

- **Frontend:** Vercel (best for React/Vite)
- **Backend:** Railway (easy Docker deployment)

Both have free tiers and are beginner-friendly!

