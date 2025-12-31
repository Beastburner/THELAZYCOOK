# Test and Fix CORS - Step by Step

## Step 1: Test if CORS is Working Now

### Test from Browser Console

1. **Visit your frontend:** https://thelazycook-ai.vercel.app
2. **Open browser console** (F12)
3. **Run this test:**
   ```javascript
   fetch('https://lazycook-backend.onrender.com/health', {
     method: 'GET',
     headers: {
       'Content-Type': 'application/json'
     }
   })
   .then(r => r.json())
   .then(data => {
     console.log('✅ Success!', data);
   })
   .catch(error => {
     console.error('❌ CORS Error:', error);
   });
   ```

4. **Check the result:**
   - ✅ **If you see `{ok: true}`** → CORS is working! Skip to Step 3.
   - ❌ **If you see CORS error** → Continue to Step 2.

### Test by Sending a Message

1. **Sign in** to your frontend
2. **Try sending a message**
3. **Check browser console:**
   - ✅ **No CORS errors** → It's working!
   - ❌ **Still seeing CORS errors** → Continue to Step 2.

---

## Step 2: Fix CORS Using Render CLI

If CORS is still not working, let's use Render CLI to fix it.

### Install Render CLI (if not installed)

**Windows (PowerShell):**
```powershell
# Download from: https://github.com/render-oss/render-cli/releases
# Or use winget (if available):
winget install Render.RenderCLI
```

**Mac/Linux:**
```bash
brew install render
```

### Login to Render CLI

```bash
render login
```
This will open your browser to authorize.

### Find Your Service ID

```bash
render services
```

Look for `lazycook-backend` and note the Service ID (first column, looks like `srv-xxxxx`).

### Set CORS_ORIGINS Using CLI

```bash
# Replace <SERVICE_ID> with your actual service ID from above
render env set <SERVICE_ID> CORS_ORIGINS="https://thelazycook-ai.vercel.app"
```

**Example:**
```bash
render env set srv-abc123xyz CORS_ORIGINS="https://thelazycook-ai.vercel.app"
```

### Verify It Was Set

```bash
render env list <SERVICE_ID>
```

You should see:
```
CORS_ORIGINS=https://thelazycook-ai.vercel.app
```

### Trigger Redeploy (if needed)

```bash
render deploys create <SERVICE_ID>
```

Or wait 2-3 minutes for Render to auto-redeploy.

### Check Logs

```bash
render logs <SERVICE_ID> --follow
```

Look for:
- `CORS: Allowing origins: ['https://thelazycook-ai.vercel.app']`
- No errors

---

## Step 3: Test Again

After using CLI:

1. **Wait 2-3 minutes** for redeploy
2. **Clear browser cache** (Ctrl+Shift+R or Cmd+Shift+R)
3. **Test from browser console** (use the test from Step 1)
4. **Try sending a message** from your frontend

---

## Quick PowerShell Script (Windows)

Save this as `fix-cors.ps1` and run it:

```powershell
# Fix CORS using Render CLI
Write-Host "🔧 Fixing CORS with Render CLI..." -ForegroundColor Cyan

# Check if render CLI is installed
if (-not (Get-Command render -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Render CLI not found!" -ForegroundColor Red
    Write-Host "   Download from: https://github.com/render-oss/render-cli/releases" -ForegroundColor Yellow
    exit 1
}

# Login check
Write-Host "📋 Checking login status..." -ForegroundColor Cyan
try {
    $null = render whoami 2>&1
} catch {
    Write-Host "❌ Not logged in. Run: render login" -ForegroundColor Red
    exit 1
}

# Find service
Write-Host "🔍 Finding lazycook-backend service..." -ForegroundColor Cyan
$services = render services 2>&1
$serviceLine = $services | Select-String -Pattern "lazycook-backend" -CaseSensitive:$false

if (-not $serviceLine) {
    Write-Host "❌ Service not found!" -ForegroundColor Red
    render services
    exit 1
}

$serviceId = ($serviceLine.Line -split '\s+')[0]
Write-Host "✅ Found service: $serviceId" -ForegroundColor Green

# Set CORS
Write-Host "🔧 Setting CORS_ORIGINS..." -ForegroundColor Cyan
render env set $serviceId CORS_ORIGINS="https://thelazycook-ai.vercel.app"

# Verify
Write-Host "📋 Verifying..." -ForegroundColor Cyan
render env list $serviceId | Select-String "CORS_ORIGINS"

Write-Host ""
Write-Host "✅ CORS_ORIGINS set!" -ForegroundColor Green
Write-Host "⏳ Wait 2-3 minutes for redeploy, then test your frontend." -ForegroundColor Yellow
```

---

## Quick Bash Script (Mac/Linux)

Save this as `fix-cors.sh` and run it:

```bash
#!/bin/bash

echo "🔧 Fixing CORS with Render CLI..."

# Check if render CLI is installed
if ! command -v render &> /dev/null; then
    echo "❌ Render CLI not found!"
    echo "   Install with: brew install render"
    exit 1
fi

# Find service
echo "🔍 Finding lazycook-backend service..."
SERVICE_ID=$(render services 2>/dev/null | grep -i "lazycook-backend" | awk '{print $1}' | head -n 1)

if [ -z "$SERVICE_ID" ]; then
    echo "❌ Service not found!"
    render services
    exit 1
fi

echo "✅ Found service: $SERVICE_ID"

# Set CORS
echo "🔧 Setting CORS_ORIGINS..."
render env set $SERVICE_ID CORS_ORIGINS="https://thelazycook-ai.vercel.app"

# Verify
echo "📋 Verifying..."
render env list $SERVICE_ID | grep CORS_ORIGINS

echo ""
echo "✅ CORS_ORIGINS set!"
echo "⏳ Wait 2-3 minutes for redeploy, then test your frontend."
```

---

## Troubleshooting

### If CLI command fails:

1. **Check you're logged in:**
   ```bash
   render whoami
   ```

2. **Re-login if needed:**
   ```bash
   render logout
   render login
   ```

3. **Verify service ID:**
   ```bash
   render services
   ```

### If CORS still doesn't work:

1. **Check Render logs:**
   ```bash
   render logs <SERVICE_ID> | grep -i cors
   ```

2. **Try setting to `*` (allows all origins):**
   ```bash
   render env set <SERVICE_ID> CORS_ORIGINS="*"
   ```

3. **Clear browser cache completely**
4. **Try in incognito/private window**

---

## ✅ Success Indicators

When CORS is working:
- ✅ Browser console test returns `{ok: true}`
- ✅ No CORS errors in console
- ✅ Frontend can send messages successfully
- ✅ AI responses work correctly

---

## 🎯 Next Steps After Fix

Once CORS is working:
1. Test full authentication flow
2. Test AI conversations
3. Test all features end-to-end

