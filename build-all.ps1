$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

& (Join-Path $projectRoot "build-chrome.ps1")
& (Join-Path $projectRoot "build-opera.ps1")
& (Join-Path $projectRoot "build-firefox.ps1")

Write-Output "All browser builds completed."
