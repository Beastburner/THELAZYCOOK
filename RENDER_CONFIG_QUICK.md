# Quick Render Configuration Reference

Based on your Render settings screen, here's what to configure:

## ✅ Current Settings (Correct)

- **Docker Build Context Directory:** `.` ✅ (repo root)
- **Dockerfile Path:** `Dockerfile` or `./Dockerfile` ✅
- **Docker Command:** (empty) ✅ (uses Dockerfile CMD)

## ⚠️ Change This

- **Health Check Path:** Change from `/healthz` to `/health`
  - Your FastAPI backend uses `/health` endpoint
  - Render will ping this to check if service is healthy

## 📁 Secret Files Section

1. **Click "+ Add Secret File"**
2. **Configure:**
   - **Name:** `serviceAccountKey.json`
   - **Path:** `/app/backend/serviceAccountKey.json`
3. **Upload** your `backend/serviceAccountKey.json` file
4. **Save**

**Note:** The file will be accessible at `/app/backend/serviceAccountKey.json` during build and runtime.

## 🔧 Environment Variables

Add these in the "Environment Variables" section:

```
GEMINI_API_KEY=your_key
GROK_API_KEY=your_key
CORS_ORIGINS=*
PORT=8000
FIREBASE_SERVICE_ACCOUNT_PATH=/app/backend/serviceAccountKey.json
```

## ✅ After Configuration

1. Click "Create Web Service" or "Save Changes"
2. Render will start building your Docker container
3. Watch the logs for progress
4. Once deployed, get your backend URL

---

**Full guide:** See `DEPLOY.md` for complete step-by-step instructions.

