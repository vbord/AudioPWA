$root = "E:\vs2022\mvc\AudioPWA\publish"
$out  = "E:\vs2022\mvc\AudioPWA\old_bundle_for_review.txt"

# Extensions to exclude
$excludeExt = @(
    ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".ico", ".mp3", ".m4a", ".m4b", ".wav"
)

# Start clean
Remove-Item $out -ErrorAction SilentlyContinue

Get-ChildItem -Path $root -Recurse -File | Where-Object {
    $excludeExt -notcontains $_.Extension.ToLower()
} | ForEach-Object {

    $relativePath = $_.FullName.Substring($root.Length + 1)

    Add-Content $out ""
    Add-Content $out "============================================================"
    Add-Content $out "FILE: $relativePath"
    Add-Content $out "============================================================"
    Add-Content $out ""

    try {
        Get-Content $_.FullName -Raw | Add-Content $out
    }
    catch {
        Add-Content $out "[UNREADABLE FILE]"
    }
}

Write-Host "Bundle created at: $out"
