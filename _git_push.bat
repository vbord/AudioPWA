@echo off
cd /d E:\vs2022\mvc\AudioPWA

echo Setting GitHub remote...
git remote remove origin 2>nul
git remote add origin https://github.com/vbord/AudioPWA.git

echo Renaming branch to main...
git branch -M main

echo Pushing to GitHub...
git push -u origin main

echo Done.
pause
