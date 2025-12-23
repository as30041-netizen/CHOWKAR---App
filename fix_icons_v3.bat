@echo off
set SRC="node_modules\leaflet\dist\images\marker-icon.png"
set BASE=android\app\src\main\res

echo Copying valid PNG from %SRC% to %BASE%

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
copy /Y %SRC% "%BASE%\mipmap-xxhdpi\ic_launcher.png"
copy /Y %SRC% "%BASE%\mipmap-xxhdpi\ic_launcher_round.png"
copy /Y %SRC% "%BASE%\mipmap-xxhdpi\ic_launcher_foreground.png"

copy /Y %SRC% "%BASE%\mipmap-xxxhdpi\ic_launcher.png"
copy /Y %SRC% "%BASE%\mipmap-xxxhdpi\ic_launcher_round.png"
copy /Y %SRC% "%BASE%\mipmap-xxxhdpi\ic_launcher_foreground.png"

echo Done
