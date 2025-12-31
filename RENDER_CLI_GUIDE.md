# Render CLI Guide

Complete guide to using Render CLI to manage your LazyCook backend deployment.

---

## 📦 Installation

### Option 1: Homebrew (Recommended for Mac/Linux)
```bash
brew install render
```

### Option 2: Direct Download (Windows/Mac/Linux)
1. Visit: https://github.com/render-oss/render-cli/releases
2. Download the executable for your OS
3. Add to PATH (or use directly)

### Option 3: Build from Source
```bash
git clone https://github.com/render-oss/render-cli.git
cd render-cli
make deps
make build-local
```

---

## 🔐 Authentication

### Login
```bash
render login
```
This will:
- Open your browser
- Ask you to authorize the CLI
- Save a token locally

### Verify Login
```bash
render whoami
```

---

## 📋 Common Commands

### List All Services
```bash
render services
```
Shows all your services and their IDs.

### Get Service Details
```bash
render services show <SERVICE_ID>
```

### Find Your Service ID
```bash
# List services and find lazycook-backend
render services | grep lazycook-backend
```

---

## 🔧 Environment Variables

### List Environment Variables
```bash
render env list <SERVICE_ID>
```

### Set Environment Variable
```bash
render env set <SERVICE_ID> KEY=value
```

### Set Multiple Environment Variables
```bash
render env set <SERVICE_ID> \
  CORS_ORIGINS="https://thelazycook-ai.vercel.app" \
  PORT="8000"
```

### Update CORS_ORIGINS (Your Current Need)
```bash
# First, get your service ID
SERVICE_ID=$(render services | grep lazycook-backend | awk '{print $1}')

# Set CORS_ORIGINS
render env set $SERVICE_ID CORS_ORIGINS="https://thelazycook-ai.vercel.app"
```

### Delete Environment Variable
```bash
render env unset <SERVICE_ID> KEY
```

---

## 📁 Secret Files

### List Secret Files
```bash
render secret-files list <SERVICE_ID>
```

### Create/Update Secret File
```bash
render secret-files create <SERVICE_ID> \
  --name serviceAccountKey.json \
  --path /app/backend/serviceAccountKey.json \
  --content "$(cat backend/serviceAccountKey.json)"
```

**Note:** Secret files might need to be managed via web UI for now, as CLI support may be limited.

---

## 🚀 Deployments

### Trigger Manual Deploy
```bash
render deploys create <SERVICE_ID>
```

### List Deployments
```bash
render deploys list <SERVICE_ID>
```

### Get Deployment Status
```bash
render deploys show <SERVICE_ID> <DEPLOY_ID>
```

---

## 📊 Logs

### View Live Logs
```bash
render logs <SERVICE_ID>
```

### Filter Logs
```bash
# Filter by text
render logs <SERVICE_ID> --filter "error"

# Follow logs (like tail -f)
render logs <SERVICE_ID> --follow
```

---

## 🔄 Service Management

### Restart Service
```bash
render services restart <SERVICE_ID>
```

### Suspend Service
```bash
render services suspend <SERVICE_ID>
```

### Resume Service
```bash
render services resume <SERVICE_ID>
```

---

## 🎯 Quick Setup Script

Create a script to set all environment variables at once:

### `setup-render-env.sh`
```bash
#!/bin/bash

# Get service ID (replace with your actual service ID or name)
SERVICE_ID=$(render services | grep lazycook-backend | awk '{print $1}')

if [ -z "$SERVICE_ID" ]; then
  echo "Error: Service 'lazycook-backend' not found"
  exit 1
fi

echo "Setting environment variables for service: $SERVICE_ID"

# Set environment variables
render env set $SERVICE_ID CORS_ORIGINS="https://thelazycook-ai.vercel.app"
render env set $SERVICE_ID PORT="8000"
render env set $SERVICE_ID FIREBASE_SERVICE_ACCOUNT_PATH="/app/backend/serviceAccountKey.json"

# Note: API keys should be set manually for security
echo ""
echo "✅ Environment variables set!"
echo "⚠️  Don't forget to set GEMINI_API_KEY and GROK_API_KEY manually:"
echo "   render env set $SERVICE_ID GEMINI_API_KEY='your_key'"
echo "   render env set $SERVICE_ID GROK_API_KEY='your_key'"
```

### Windows PowerShell Version: `setup-render-env.ps1`
```powershell
# Get service ID
$services = render services
$serviceId = ($services | Select-String "lazycook-backend").Line.Split()[0]

if (-not $serviceId) {
    Write-Host "Error: Service 'lazycook-backend' not found"
    exit 1
}

Write-Host "Setting environment variables for service: $serviceId"

# Set environment variables
render env set $serviceId CORS_ORIGINS="https://thelazycook-ai.vercel.app"
render env set $serviceId PORT="8000"
render env set $serviceId FIREBASE_SERVICE_ACCOUNT_PATH="/app/backend/serviceAccountKey.json"

Write-Host ""
Write-Host "✅ Environment variables set!"
Write-Host "⚠️  Don't forget to set GEMINI_API_KEY and GROK_API_KEY manually"
```

---

## 🎯 Quick Fix: Set CORS_ORIGINS Now

### Step 1: Install Render CLI (if not installed)
```bash
# Mac/Linux
brew install render

# Or download from: https://github.com/render-oss/render-cli/releases
```

### Step 2: Login
```bash
render login
```

### Step 3: Find Your Service ID
```bash
render services
```
Look for `lazycook-backend` and note the ID (first column).

### Step 4: Set CORS_ORIGINS
```bash
# Replace <SERVICE_ID> with your actual service ID
render env set <SERVICE_ID> CORS_ORIGINS="https://thelazycook-ai.vercel.app"
```

### Step 5: Verify
```bash
render env list <SERVICE_ID>
```

### Step 6: Trigger Redeploy (if needed)
```bash
render deploys create <SERVICE_ID>
```

---

## 📝 Example: Complete Setup

```bash
# 1. Login
render login

# 2. List services to find ID
render services

# 3. Set all environment variables (replace SERVICE_ID)
SERVICE_ID="srv-xxxxx"  # Replace with your actual service ID

render env set $SERVICE_ID CORS_ORIGINS="https://thelazycook-ai.vercel.app"
render env set $SERVICE_ID PORT="8000"
render env set $SERVICE_ID FIREBASE_SERVICE_ACCOUNT_PATH="/app/backend/serviceAccountKey.json"

# 4. Set API keys (replace with your actual keys)
read -sp "Enter GEMINI_API_KEY: " GEMINI_KEY
render env set $SERVICE_ID GEMINI_API_KEY="$GEMINI_KEY"

read -sp "Enter GROK_API_KEY: " GROK_KEY
render env set $SERVICE_ID GROK_API_KEY="$GROK_KEY"

# 5. Verify
render env list $SERVICE_ID

# 6. View logs
render logs $SERVICE_ID --follow
```

---

## 🔍 Troubleshooting

### CLI Not Found
```bash
# Check if installed
which render  # Mac/Linux
where render   # Windows

# If not found, add to PATH or use full path
```

### Authentication Failed
```bash
# Re-login
render logout
render login
```

### Service Not Found
```bash
# List all services
render services

# Make sure you're using the correct service ID
```

---

## 📚 Additional Resources

- **Official Docs:** https://render.com/docs/cli
- **GitHub:** https://github.com/render-oss/render-cli
- **Changelog:** https://render.com/changelog/the-render-cli-is-now-generally-available

---

## ✅ Quick Reference

```bash
# Login
render login

# List services
render services

# Set env var
render env set <SERVICE_ID> KEY=value

# List env vars
render env list <SERVICE_ID>

# View logs
render logs <SERVICE_ID>

# Deploy
render deploys create <SERVICE_ID>

# Restart
render services restart <SERVICE_ID>
```

---

## 🎯 Your Immediate Action

To fix CORS right now:

```bash
# 1. Install (if needed)
brew install render  # or download from GitHub

# 2. Login
render login

# 3. Find service ID
render services | grep lazycook-backend

# 4. Set CORS (replace SERVICE_ID)
render env set <SERVICE_ID> CORS_ORIGINS="https://thelazycook-ai.vercel.app"

# 5. Verify
render env list <SERVICE_ID>
```

That's it! Much faster than using the web UI! 🚀

