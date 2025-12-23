@echo off
set SRC="public\logo192.png"
set BASE=android\app\src\main\res

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
