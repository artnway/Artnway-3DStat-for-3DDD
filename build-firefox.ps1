$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$distRoot = Join-Path $projectRoot "dist"
$buildRoot = Join-Path $distRoot "firefox"
$readmeTemplateRoot = Join-Path $projectRoot "readme-templates\\firefox"
$chromeManifestPath = Join-Path $projectRoot "manifest.json"
$firefoxManifestTemplatePath = Join-Path $projectRoot "manifest.firefox.json"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$utf8Bom = [System.Text.UTF8Encoding]::new($true)
$chromeManifest = [System.IO.File]::ReadAllText($chromeManifestPath, $utf8NoBom) | ConvertFrom-Json
$firefoxManifest = [System.IO.File]::ReadAllText($firefoxManifestTemplatePath, $utf8NoBom) | ConvertFrom-Json
$version = [string]$chromeManifest.version
$zipFileName = if ($version) { "3dstat-firefox-v$version.zip" } else { "3dstat-firefox.zip" }
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

$readmeMd = ([System.IO.File]::ReadAllText((Join-Path $readmeTemplateRoot "README.md"), $utf8NoBom)).Replace("{{VERSION}}", $version)
$readmeTxt = ([System.IO.File]::ReadAllText((Join-Path $readmeTemplateRoot "README.txt"), $utf8NoBom)).Replace("{{VERSION}}", $version)

foreach ($relativePath in $filesToCopy) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $relativePath) -Destination (Join-Path $buildRoot $relativePath) -Force
}

$firefoxManifest.version = $chromeManifest.version
$firefoxManifest.name = $chromeManifest.name
$firefoxManifest.description = $chromeManifest.description
($firefoxManifest | ConvertTo-Json -Depth 100) | Set-Content -LiteralPath (Join-Path $buildRoot "manifest.json") -Encoding UTF8
Copy-Item -Path (Join-Path $projectRoot "icons\\*") -Destination (Join-Path $buildRoot "icons") -Recurse -Force
[System.IO.File]::WriteAllText((Join-Path $buildRoot "README.md"), $readmeMd, $utf8Bom)
[System.IO.File]::WriteAllText((Join-Path $buildRoot "README.txt"), $readmeTxt, $utf8Bom)

Compress-Archive -Path (Join-Path $buildRoot "*") -DestinationPath $zipPath -Force

Write-Output "Firefox build folder: $buildRoot"
Write-Output "Firefox zip package: $zipPath"
