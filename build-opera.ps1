$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$distRoot = Join-Path $projectRoot "dist"
$buildRoot = Join-Path $distRoot "opera"
$manifestPath = Join-Path $projectRoot "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$version = [string]$manifest.version
$zipFileName = if ($version) { "3dstat-opera-v$version.zip" } else { "3dstat-opera.zip" }
$zipPath = Join-Path $distRoot $zipFileName

$filesToCopy = @(
  "background.js",
  "export.css",
  "export.html",
  "export.js",
  "popup.css",
  "popup.html",
  "popup.js",
  "README.md",
  "settings.css",
  "settings.html",
  "settings.js",
  "themes.css"
)

if (Test-Path -LiteralPath $buildRoot) {
  Remove-Item -LiteralPath $buildRoot -Recurse -Force
}

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "icons") -Force | Out-Null

foreach ($relativePath in $filesToCopy) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $relativePath) -Destination (Join-Path $buildRoot $relativePath) -Force
}

Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $buildRoot "manifest.json") -Force
Copy-Item -Path (Join-Path $projectRoot "icons\\*") -Destination (Join-Path $buildRoot "icons") -Recurse -Force

Compress-Archive -Path (Join-Path $buildRoot "*") -DestinationPath $zipPath -Force

Write-Output "Opera build folder: $buildRoot"
Write-Output "Opera zip package: $zipPath"
