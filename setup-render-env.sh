#!/bin/bash

# Render CLI Environment Setup Script
# Sets all required environment variables for lazycook-backend

echo "🔧 Setting up Render environment variables..."

# Check if render CLI is installed
if ! command -v render &> /dev/null; then
    echo "❌ Error: Render CLI not found!"
    echo "   Install it with: brew install render"
    echo "   Or download from: https://github.com/render-oss/render-cli/releases"
    exit 1
fi

# Check if logged in
if ! render whoami &> /dev/null; then
    echo "❌ Error: Not logged in to Render!"
    echo "   Run: render login"
    exit 1
fi

# Get service ID
echo "📋 Finding lazycook-backend service..."
SERVICE_ID=$(render services 2>/dev/null | grep -i "lazycook-backend" | awk '{print $1}' | head -n 1)

if [ -z "$SERVICE_ID" ]; then
    echo "❌ Error: Service 'lazycook-backend' not found!"
    echo "   Available services:"
    render services
    exit 1
fi

echo "✅ Found service: $SERVICE_ID"
echo ""

# Set environment variables
echo "🔧 Setting environment variables..."

render env set $SERVICE_ID CORS_ORIGINS="https://thelazycook-ai.vercel.app" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ CORS_ORIGINS set"
else
    echo "⚠️  Failed to set CORS_ORIGINS"
fi

render env set $SERVICE_ID PORT="8000" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ PORT set"
else
    echo "⚠️  Failed to set PORT"
fi

render env set $SERVICE_ID FIREBASE_SERVICE_ACCOUNT_PATH="/app/backend/serviceAccountKey.json" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ FIREBASE_SERVICE_ACCOUNT_PATH set"
else
    echo "⚠️  Failed to set FIREBASE_SERVICE_ACCOUNT_PATH"
fi

echo ""
echo "📋 Current environment variables:"
render env list $SERVICE_ID

echo ""
echo "⚠️  Don't forget to set API keys manually:"
echo "   render env set $SERVICE_ID GEMINI_API_KEY='your_key'"
echo "   render env set $SERVICE_ID GROK_API_KEY='your_key'"
echo ""
echo "🚀 To trigger a redeploy:"
echo "   render deploys create $SERVICE_ID"
echo ""
echo "✅ Done!"

