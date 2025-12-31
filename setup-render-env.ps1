# Render CLI Environment Setup Script (PowerShell)
# Sets all required environment variables for lazycook-backend

Write-Host "🔧 Setting up Render environment variables..." -ForegroundColor Cyan

# Check if render CLI is installed
try {
    $null = Get-Command render -ErrorAction Stop
} catch {
    Write-Host "❌ Error: Render CLI not found!" -ForegroundColor Red
    Write-Host "   Install it from: https://github.com/render-oss/render-cli/releases" -ForegroundColor Yellow
    exit 1
}

# Check if logged in
try {
    $null = render whoami 2>&1
} catch {
    Write-Host "❌ Error: Not logged in to Render!" -ForegroundColor Red
    Write-Host "   Run: render login" -ForegroundColor Yellow
    exit 1
}

# Get service ID
Write-Host "📋 Finding lazycook-backend service..." -ForegroundColor Cyan
$servicesOutput = render services 2>&1
$serviceLine = $servicesOutput | Select-String -Pattern "lazycook-backend" -CaseSensitive:$false

if (-not $serviceLine) {
    Write-Host "❌ Error: Service 'lazycook-backend' not found!" -ForegroundColor Red
    Write-Host "   Available services:" -ForegroundColor Yellow
    render services
    exit 1
}

$serviceId = ($serviceLine.Line -split '\s+')[0]
Write-Host "✅ Found service: $serviceId" -ForegroundColor Green
Write-Host ""

# Set environment variables
Write-Host "🔧 Setting environment variables..." -ForegroundColor Cyan

$envVars = @{
    "CORS_ORIGINS" = "https://thelazycook-ai.vercel.app"
    "PORT" = "8000"
    "FIREBASE_SERVICE_ACCOUNT_PATH" = "/app/backend/serviceAccountKey.json"
}

foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    try {
        render env set $serviceId "$key=$value" 2>&1 | Out-Null
        Write-Host "✅ $key set" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Failed to set $key" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📋 Current environment variables:" -ForegroundColor Cyan
render env list $serviceId

Write-Host ""
Write-Host "⚠️  Don't forget to set API keys manually:" -ForegroundColor Yellow
Write-Host "   render env set $serviceId GEMINI_API_KEY='your_key'" -ForegroundColor Gray
Write-Host "   render env set $serviceId GROK_API_KEY='your_key'" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 To trigger a redeploy:" -ForegroundColor Cyan
Write-Host "   render deploys create $serviceId" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Done!" -ForegroundColor Green

