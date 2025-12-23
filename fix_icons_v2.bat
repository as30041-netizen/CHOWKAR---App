@echo off
set SRC="C:\Users\Abhishek Sharma\.gemini\antigravity\brain\d625ca75-faf0-45ae-8c3f-8067db94f075\chowkar_icon_v2_1766495954078.png"
set BASE=android\app\src\main\res

echo Copying from %SRC% to %BASE%

copy /Y %SRC% "%BASE%\mipmap-mdpi\ic_launcher.png"
copy /Y %SRC% "%BASE%\mipmap-mdpi\ic_launcher_round.png"
copy /Y %SRC% "%BASE%\mipmap-mdpi\ic_launcher_foreground.png"

copy /Y %SRC% "%BASE%\mipmap-hdpi\ic_launcher.png"
copy /Y %SRC% "%BASE%\mipmap-hdpi\ic_launcher_round.png"
copy /Y %SRC% "%BASE%\mipmap-hdpi\ic_launcher_foreground.png"

copy /Y %SRC% "%BASE%\mipmap-xhdpi\ic_launcher.png"
copy /Y %SRC% "%BASE%\mipmap-xhdpi\ic_launcher_round.png"
copy /Y %SRC% "%BASE%\mipmap-xhdpi\ic_launcher_foreground.png"

copy /Y %SRC% "%BASE%\mipmap-xxhdpi\ic_launcher.png"
copy /Y %SRC% "%BASE%\mipmap-xxhdpi\ic_launcher_round.png"
copy /Y %SRC% "%BASE%\mipmap-xxhdpi\ic_launcher_foreground.png"

copy /Y %SRC% "%BASE%\mipmap-xxxhdpi\ic_launcher.png"
copy /Y %SRC% "%BASE%\mipmap-xxxhdpi\ic_launcher_round.png"
copy /Y %SRC% "%BASE%\mipmap-xxxhdpi\ic_launcher_foreground.png"

echo Done
