[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Version,

  [Parameter(Position = 1)]
  [string]$OutputDir = '',

  [string]$UpstreamDir = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,
    [Parameter(Mandatory = $true)]
    [string]$Description
  )
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE"
  }
}

function Get-PeMachine {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $reader = [System.IO.BinaryReader]::new($stream)
    $stream.Position = 0x3c
    $peOffset = $reader.ReadInt32()
    $stream.Position = $peOffset
    if ($reader.ReadUInt32() -ne 0x00004550) {
      throw "Not a PE executable: $Path"
    }
    return $reader.ReadUInt16()
  }
  finally {
    $stream.Dispose()
  }
}

if ($Version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') {
  throw "Version must use semantic versioning: $Version"
}
if ($env:OS -ne 'Windows_NT') {
  throw 'This pipeline must run on Windows.'
}
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
  throw "Native Windows x64 build requires an AMD64 runner; found $($env:PROCESSOR_ARCHITECTURE)"
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $UpstreamDir) {
  $UpstreamDir = Join-Path $root 'upstream\marktext'
}
$upstream = (Resolve-Path $UpstreamDir).Path
$desktop = Join-Path $upstream 'packages\desktop'
$desktopPackage = Join-Path $desktop 'package.json'
$builderConfig = Join-Path $desktop 'electron-builder.yml'
$approvedIcon = Join-Path $root 'icon\reversion-hand-pencil-engraving_OC_0807B.png'

foreach ($required in @($desktopPackage, $builderConfig, $approvedIcon)) {
  if (-not (Test-Path $required -PathType Leaf)) {
    throw "Required release input is missing: $required"
  }
}

if (-not $OutputDir) {
  $OutputDir = Join-Path $root "releases\$Version"
}
$output = [System.IO.Path]::GetFullPath($OutputDir)
$setupName = "Reversion-$Version-windows-x64-setup.exe"
$setupOutput = Join-Path $output $setupName
$blockmapOutput = "$setupOutput.blockmap"
$manifestOutput = Join-Path $output 'latest.yml'
$checksumOutput = "$setupOutput.sha256"

foreach ($candidate in @($setupOutput, $blockmapOutput, $manifestOutput, $checksumOutput)) {
  if (Test-Path $candidate) {
    throw "Release output already exists: $candidate"
  }
}

$nodeVersion = (Get-Content (Join-Path $root '.nvmrc') -Raw).Trim()
$actualNodeVersion = (& node --version).TrimStart('v')
if ($LASTEXITCODE -ne 0 -or $actualNodeVersion -ne $nodeVersion) {
  throw "Node $nodeVersion is required; found $actualNodeVersion"
}
$upstreamPackage = Get-Content (Join-Path $upstream 'package.json') -Raw | ConvertFrom-Json
$pnpmVersion = [string]$upstreamPackage.packageManager
$pnpmVersion = $pnpmVersion -replace '^pnpm@', ''
$actualPnpmVersion = (& pnpm --version).Trim()
if ($LASTEXITCODE -ne 0 -or $actualPnpmVersion -ne $pnpmVersion) {
  throw "pnpm $pnpmVersion is required; found $actualPnpmVersion"
}

$desktopPackageOriginal = [System.IO.File]::ReadAllText($desktopPackage)
$keepVersion = $env:REVERSION_KEEP_VERSION -eq '1'
try {
  Invoke-Checked -Description 'desktop version update' -Command {
    & node -e '
const fs = require("fs");
const [file, version] = process.argv.slice(1);
const text = fs.readFileSync(file, "utf8");
const next = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
if (next === text && JSON.parse(text).version !== version) throw new Error("version field not found");
if (JSON.parse(next).version !== version) throw new Error("version update failed");
fs.writeFileSync(file, next);
' $desktopPackage $Version
  }

  Copy-Item -Force $approvedIcon (Join-Path $desktop 'static\icon.png')

  Push-Location $upstream
  try {
    $env:CI = 'true'
    $env:npm_config_user_agent = 'pnpm'
    Invoke-Checked -Description 'dependency installation' -Command {
      & pnpm install --frozen-lockfile --ignore-scripts
    }
    Invoke-Checked -Description 'native module rebuild' -Command {
      & pnpm tsx scripts/postinstall.ts
    }
    Invoke-Checked -Description 'application bundle build' -Command {
      & pnpm run build:unpack
    }
  }
  finally {
    Pop-Location
  }

  $bundleMain = Join-Path $desktop 'out\main\index.js'
  if (-not (Select-String -Path $bundleMain -Pattern ([regex]::Escape("`"$Version`"")) -Quiet)) {
    throw "MARKTEXT_VERSION was not injected as $Version into $bundleMain"
  }

  Push-Location $desktop
  try {
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    Invoke-Checked -Description 'Windows installer packaging' -Command {
      & pnpm exec electron-builder --win --x64 --publish never
    }
  }
  finally {
    Pop-Location
  }

  $dist = Join-Path $upstream 'dist'
  $setupSource = Join-Path $dist $setupName
  $blockmapSource = "$setupSource.blockmap"
  $manifestSource = Join-Path $dist 'latest.yml'
  $unpackedExe = Join-Path $dist 'win-unpacked\marktext.exe'
  foreach ($required in @($setupSource, $blockmapSource, $manifestSource, $unpackedExe)) {
    if (-not (Test-Path $required -PathType Leaf)) {
      throw "electron-builder did not produce: $required"
    }
  }

  if ((Get-PeMachine $unpackedExe) -ne 0x8664) {
    throw "Packaged application executable is not Windows x64: $unpackedExe"
  }
  $versionInfo = (Get-Item $unpackedExe).VersionInfo
  if ($versionInfo.ProductName -ne 'Reversion') {
    throw "Packaged ProductName is '$($versionInfo.ProductName)', expected Reversion"
  }
  if ($versionInfo.ProductVersion -notlike "$Version*") {
    throw "Packaged ProductVersion is '$($versionInfo.ProductVersion)', expected $Version"
  }

  $manifest = Get-Content $manifestSource -Raw
  if ($manifest -notmatch "(?m)^version:\s+$([regex]::Escape($Version))\s*$") {
    throw "latest.yml does not report version $Version"
  }
  if ($manifest -notmatch [regex]::Escape($setupName)) {
    throw "latest.yml does not reference $setupName"
  }

  New-Item -ItemType Directory -Force -Path $output | Out-Null
  Copy-Item $setupSource $setupOutput
  Copy-Item $blockmapSource $blockmapOutput
  Copy-Item $manifestSource $manifestOutput

  $hash = (Get-FileHash -Algorithm SHA256 $setupOutput).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText($checksumOutput, "$hash  $setupName`n")

  if ($env:REVERSION_WINDOWS_SMOKE_INSTALL -eq '1') {
    $smokeRoot = Join-Path ([System.IO.Path]::GetTempPath()) "reversion-$Version-windows-smoke"
    if (Test-Path $smokeRoot) {
      Remove-Item -Recurse -Force $smokeRoot
    }
    New-Item -ItemType Directory -Path $smokeRoot | Out-Null
    $installDir = Join-Path $smokeRoot 'app'
    $installer = Start-Process -FilePath $setupOutput -ArgumentList '/S', "/D=$installDir" -Wait -PassThru
    if ($installer.ExitCode -ne 0) {
      throw "Silent installer failed with exit code $($installer.ExitCode)"
    }
    $installedExe = Join-Path $installDir 'marktext.exe'
    if (-not (Test-Path $installedExe -PathType Leaf)) {
      throw "Silent installer did not create $installedExe"
    }
    if ((Get-PeMachine $installedExe) -ne 0x8664) {
      throw "Installed application executable is not Windows x64"
    }
    $installedInfo = (Get-Item $installedExe).VersionInfo
    if ($installedInfo.ProductName -ne 'Reversion' -or $installedInfo.ProductVersion -notlike "$Version*") {
      throw "Installed application metadata is invalid: $($installedInfo.ProductName) $($installedInfo.ProductVersion)"
    }
    $appProcess = Start-Process -FilePath $installedExe -ArgumentList '--version' -PassThru
    Start-Sleep -Seconds 10
    if (-not $appProcess.HasExited) {
      Stop-Process -Id $appProcess.Id -Force
    }
    elseif ($appProcess.ExitCode -ne 0) {
      throw "Installed application exited with code $($appProcess.ExitCode)"
    }
    $uninstaller = Get-ChildItem $installDir -Filter 'Uninstall*.exe' | Select-Object -First 1
    if ($null -ne $uninstaller) {
      Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -Wait | Out-Null
    }
  }

  Write-Host 'Windows release artifacts:'
  Write-Host "  $setupOutput"
  Write-Host "  $blockmapOutput"
  Write-Host "  $manifestOutput"
  Write-Host "  $checksumOutput"
}
finally {
  if (-not $keepVersion) {
    [System.IO.File]::WriteAllText($desktopPackage, $desktopPackageOriginal)
  }
}
