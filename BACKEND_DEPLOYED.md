# ✅ Backend Deployed Successfully!

Your backend is now live at: **https://lazycook-backend.onrender.com**

---

## 🧪 Test Your Backend

### 1. Health Check
Visit: **https://lazycook-backend.onrender.com/health**
- Should return: `{"ok": true}`

### 2. API Documentation
Visit: **https://lazycook-backend.onrender.com/docs**
- Should show FastAPI Swagger UI
- You can test API endpoints here

### 3. Test API Endpoint
Visit: **https://lazycook-backend.onrender.com/health**
- Should return JSON: `{"ok": true}`

---

## 🎨 Next Step: Deploy Frontend to Vercel

Now that your backend is running, deploy the frontend:

### Quick Steps:

1. **Go to [vercel.com](https://vercel.com)** → Sign up/Login with GitHub

2. **Create New Project:**
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Select your repo

3. **Configure:**
   - **Root Directory:** `lazycook-ui`
   - **Framework:** `Vite` (auto-detected)

4. **Add Environment Variables:**
   ```
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   VITE_API_BASE=https://lazycook-backend.onrender.com
   ```
   **Important:** Use your actual Render backend URL: `https://lazycook-backend.onrender.com`

5. **Deploy** → Get your frontend URL

---

## ✅ After Frontend Deployment

1. **Update Render CORS:**
   - Render dashboard → Your service → Environment tab
   - Update `CORS_ORIGINS` to your Vercel frontend URL
   - Example: `https://your-frontend.vercel.app`

2. **Update Firebase:**
   - Firebase Console → Auth → Settings → Authorized domains
   - Add your Vercel domain

---

## 📋 Backend URL Reference

**Backend URL:** `https://lazycook-backend.onrender.com`

Use this URL in:
- Frontend `VITE_API_BASE` environment variable
- CORS configuration
- Testing API endpoints

---

**Full deployment guide:** See `DEPLOY.md` Part 2 for detailed frontend deployment instructions.

