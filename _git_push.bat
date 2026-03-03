@echo off
cd /d E:\vs2022\mvc\AudioPWA
git init
git add .
git commit -m "Initial commit: AudioPWA + server_code"

echo Setting GitHub remote...
git remote remove origin 2 
git remote add origin https://github.com/vbord/AudioPWA.git

echo Renaming branch to main...
git branch -M main

echo Pushing to GitHub...
git push -u origin main

echo Done.
pause
