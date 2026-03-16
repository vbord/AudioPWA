@echo off
setlocal

REM Adjust these:
set "ROOT=E:\vs2022\mvc\AudioPWA\publish"
set "OUT=E:\vs2022\mvc\AudioPWA\pwa_dump.txt"

REM Call PowerShell one-liner
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root='%ROOT%'; $out='%OUT%'; $excl=@('node_modules','.git','dist','build','.next','out','coverage','.cache','tmp','temp'); $text=@('txt','md','markdown','html','htm','css','scss','less','js','cjs','mjs','jsx','ts','tsx','json','jsonc','yml','yaml','xml','svg','ico','webmanifest','manifest','ini','env','config','properties','gitignore','gitattributes','editorconfig','eslintignore','prettierignore','browserslistrc','tsconfig','eslintrc','prettierrc','ps1','psm1','bat','cmd','sh'); if (Test-Path $out){Remove-Item $out -Force}; Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $rel=$_.FullName.Substring($root.Length).TrimStart('\','/'); -not ($rel -split '[\\/]' | Where-Object {$_} | ForEach-Object { $excl -contains $_ }) } | ForEach-Object { $f=$_.FullName; $bytes=[IO.File]::ReadAllBytes($f); $ext=[IO.Path]::GetExtension($f).TrimStart('.').ToLower(); $isText=$text -contains $ext; $looksBin=$false; foreach($b in $bytes[0..([Math]::Min($bytes.Length-1,8191))]) { if ($b -eq 0){$looksBin=$true; break} }; if ($isText -and -not $looksBin) { $content=[Text.Encoding]::UTF8.GetString($bytes); $content=$content -replace \"`r`n\",\"`n\"; '===== FILE: '+$f+' =====' | Out-File -FilePath $out -Append -Encoding utf8; $content | Out-File -FilePath $out -Append -Encoding utf8; '' | Out-File -FilePath $out -Append -Encoding utf8 } else { $b64=[Convert]::ToBase64String($bytes); '===== FILE (base64): '+$f+' =====' | Out-File -FilePath $out -Append -Encoding utf8; ($b64 -split '(.{1,120})' | Where-Object {$_}) | Out-File -FilePath $out -Append -Encoding utf8; '' | Out-File -FilePath $out -Append -Encoding utf8 } }"

echo Done. Output: %OUT%
endlocal