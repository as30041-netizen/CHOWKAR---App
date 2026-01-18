@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
echo JAVA_HOME set to "%JAVA_HOME%"

cd android
echo Starting Build...
call gradlew.bat assembleDebug -Dorg.gradle.java.home="C:\Program Files\Android\Android Studio\jbr"

if %ERRORLEVEL% NEQ 0 (
    echo Build Failed!
    exit /b %ERRORLEVEL%
)

echo Build Success!
cd ..
node scripts/upload_apk.js
