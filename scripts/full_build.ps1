
$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Chowkar Mobile Build..." -ForegroundColor Cyan

# 1. Environment Check
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
if (-not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
    Write-Host "⚠️  Java not found at standard path. checking PATH..." -ForegroundColor Yellow
    if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Java is missing. Please install Android Studio." -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Java Environment Ready" -ForegroundColor Green

# 2. Web Build
Write-Host "`n📦 Building Web Assets (Vite)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Web build failed" }

# 3. Asset Generation
Write-Host "`n🎨 Generating Icons & Splash Screens..." -ForegroundColor Cyan
if (Test-Path "resources/icon.png") {
    npx capacitor-assets generate --android
}
else {
    Write-Host "⚠️  No resources/icon.png found. Skipping asset generation." -ForegroundColor Yellow
}

# 4. Capacitor Sync
Write-Host "`n🔄 Syncing to Android Container..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed" }

# 5. Native Build
Write-Host "`n🔨 Compiling APK (Gradle)..." -ForegroundColor Cyan
Set-Location "android"
./gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { throw "Gradle build failed" }

Write-Host "`n✅ BUILD SUCCESSFUL!" -ForegroundColor Green
Write-Host "APK Location: android/app/build/outputs/apk/debug/app-debug.apk" -ForegroundColor Green
Set-Location ..
