# Deployment Checklist

Use this checklist to ensure everything is configured correctly.

## ✅ Pre-Deployment

- [ ] Code is pushed to GitHub
- [ ] All environment variables are documented
- [ ] Firebase project is set up
- [ ] API keys are ready (Gemini, Grok)

## ✅ Backend (Render)

- [ ] Render account created
- [ ] Web service created from GitHub repo
- [ ] Docker environment selected
- [ ] Environment variables set:
  - [ ] `GEMINI_API_KEY`
  - [ ] `GROK_API_KEY`
  - [ ] `CORS_ORIGINS` (set to `*` initially, update after frontend deploy)
  - [ ] `PORT=8000`
  - [ ] `FIREBASE_SERVICE_ACCOUNT_PATH=/app/backend/serviceAccountKey.json`
- [ ] Firebase service account key uploaded as Secret File OR set as base64 env var
- [ ] Backend URL copied (e.g., `https://lazycook-backend.onrender.com`)

## ✅ Frontend (Vercel)

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
- [ ] Frontend URL copied (e.g., `https://lazycook-ui.vercel.app`)

## ✅ Post-Deployment

- [ ] Backend CORS updated with frontend URL
- [ ] Firebase authorized domains updated with frontend URL
- [ ] Backend health check: `https://your-backend.onrender.com/health` returns `{"ok": true}`
- [ ] Frontend loads correctly
- [ ] Authentication works (sign up/sign in)
- [ ] API calls work (test sending a message)
- [ ] No CORS errors in browser console
- [ ] No errors in Render logs
- [ ] No errors in Vercel build logs

## ✅ Testing

- [ ] Sign up with email/password
- [ ] Sign in with Google
- [ ] Plan selection works
- [ ] AI chat works (all 3 plans: GO, PRO, ULTRA)
- [ ] Chat history persists
- [ ] New chat creation works
- [ ] Chat deletion works
- [ ] Profile updates work

## 🎉 Done!

Your app is live and ready to use!

