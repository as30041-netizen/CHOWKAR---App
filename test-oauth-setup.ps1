# CHOWKAR App - OAuth Setup Test Script
# This script helps verify your Capacitor + OAuth setup is correct

Write-Host "🔍 CHOWKAR APK - OAuth Setup Verification" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check if Android directory exists
Write-Host "✓ Checking Android project..." -ForegroundColor Yellow
if (Test-Path "android") {
    Write-Host "  ✅ Android directory found" -ForegroundColor Green
} else {
    Write-Host "  ❌ Android directory not found! Run 'npx cap add android'" -ForegroundColor Red
    exit 1
}

# 2. Check if capacitor.config.ts exists and has correct app ID
Write-Host ""
Write-Host "✓ Checking Capacitor configuration..." -ForegroundColor Yellow
if (Test-Path "capacitor.config.ts") {
    $config = Get-Content "capacitor.config.ts" -Raw
    if ($config -match "in\.chowkar\.app") {
        Write-Host "  ✅ App ID configured: in.chowkar.app" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  App ID might not be correct" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ capacitor.config.ts not found!" -ForegroundColor Red
}

# 3. Check AndroidManifest.xml for deep link configuration
Write-Host ""
Write-Host "✓ Checking AndroidManifest deep link setup..." -ForegroundColor Yellow
$manifestPath = "android\app\src\main\AndroidManifest.xml"
if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath -Raw
    if ($manifest -match "in\.chowkar\.app") {
        Write-Host "  ✅ Deep link scheme configured: in.chowkar.app" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Deep link scheme not found in AndroidManifest.xml!" -ForegroundColor Red
    }
    if ($manifest -match "callback") {
        Write-Host "  ✅ Callback host configured" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Callback host not found!" -ForegroundColor Red
    }
} else {
    Write-Host "  ❌ AndroidManifest.xml not found!" -ForegroundColor Red
}

# 4. Check if Browser plugin is installed
Write-Host ""
Write-Host "✓ Checking Capacitor Browser plugin..." -ForegroundColor Yellow
if (Test-Path "node_modules\@capacitor\browser") {
    Write-Host "  ✅ @capacitor/browser installed" -ForegroundColor Green
} else {
    Write-Host "  ❌ @capacitor/browser not found! Run 'npm install @capacitor/browser'" -ForegroundColor Red
}

# 5. Check if App plugin is installed
Write-Host ""
Write-Host "✓ Checking Capacitor App plugin..." -ForegroundColor Yellow
if (Test-Path "node_modules\@capacitor\app") {
    Write-Host "  ✅ @capacitor/app installed" -ForegroundColor Green
} else {
    Write-Host "  ❌ @capacitor/app not found! Run 'npm install @capacitor/app'" -ForegroundColor Red
}

# 6. Check if useDeepLinkHandler hook exists
Write-Host ""
Write-Host "✓ Checking Deep Link Handler..." -ForegroundColor Yellow
if (Test-Path "hooks\useDeepLinkHandler.ts") {
    Write-Host "  ✅ useDeepLinkHandler.ts found" -ForegroundColor Green
} else {
    Write-Host "  ❌ useDeepLinkHandler.ts not found!" -ForegroundColor Red
}

# 7. Check Supabase configuration
Write-Host ""
Write-Host "✓ Checking Supabase configuration..." -ForegroundColor Yellow
if (Test-Path "lib\supabase.ts") {
    $supabase = Get-Content "lib\supabase.ts" -Raw
    if ($supabase -match "pkce") {
        Write-Host "  ✅ PKCE flow configured" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  PKCE flow might not be configured" -ForegroundColor Yellow
    }
    if ($supabase -match "persistSession.*true") {
        Write-Host "  ✅ Session persistence enabled" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Session persistence might not be enabled" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ lib\supabase.ts not found!" -ForegroundColor Red
}

# 8. Check if .env file exists
Write-Host ""
Write-Host "✓ Checking environment variables..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "  ✅ .env file found" -ForegroundColor Green
    $env = Get-Content ".env" -Raw
    if ($env -match "VITE_SUPABASE_URL") {
        Write-Host "  ✅ VITE_SUPABASE_URL configured" -ForegroundColor Green
    } else {
        Write-Host "  ❌ VITE_SUPABASE_URL not found!" -ForegroundColor Red
    }
    if ($env -match "VITE_SUPABASE_ANON_KEY") {
        Write-Host "  ✅ VITE_SUPABASE_ANON_KEY configured" -ForegroundColor Green
    } else {
        Write-Host "  ❌ VITE_SUPABASE_ANON_KEY not found!" -ForegroundColor Red
    }
} else {
    Write-Host "  ❌ .env file not found! Copy .env.example to .env" -ForegroundColor Red
}

# 9. Check if web app can build
Write-Host ""
Write-Host "✓ Checking if web app builds..." -ForegroundColor Yellow
Write-Host "  ⏳ Running npm run build (this may take a moment)..." -ForegroundColor Gray
$buildOutput = npm run build 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Web app builds successfully" -ForegroundColor Green
} else {
    Write-Host "  ❌ Build failed! Check errors above" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "📋 Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps to test Google Sign-In:" -ForegroundColor White
Write-Host ""
Write-Host "1. Verify Supabase Redirect URLs:" -ForegroundColor Yellow
Write-Host "   - Go to Supabase Dashboard → Authentication → URL Configuration"
Write-Host "   - Add: in.chowkar.app://callback" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Build APK:" -ForegroundColor Yellow
Write-Host "   npm run build" -ForegroundColor Cyan
Write-Host "   npx cap sync android" -ForegroundColor Cyan
Write-Host "   npx cap open android" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. In Android Studio:" -ForegroundColor Yellow
Write-Host "   Build → Build APK(s)" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Install on phone and test!" -ForegroundColor Yellow
Write-Host "   adb install android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Monitor logs:" -ForegroundColor Yellow
Write-Host "   adb logcat | findstr `"Auth DeepLink`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ Good luck with testing! ✨" -ForegroundColor Green
Write-Host ""
