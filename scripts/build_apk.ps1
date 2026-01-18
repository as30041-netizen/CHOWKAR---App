
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$javaPath = "$env:JAVA_HOME\bin\java.exe"
if (Test-Path $javaPath) {
    Write-Host "✅ Found Java at: $javaPath" -ForegroundColor Green
}
else {
    Write-Host "❌ Java NOT found at: $javaPath" -ForegroundColor Red
    # Try generic path
    $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
}


Set-Location "$PSScriptRoot/../android"
Write-Host "Changed directory to: $(Get-Location)"

Write-Host "Starting Gradle Build..."
./gradlew.bat assembleDebug --stacktrace | Out-File -FilePath "../build_result.txt" -Encoding UTF8
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build Success!" -ForegroundColor Green
}
else {
    Write-Host "❌ Build Failed with code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
