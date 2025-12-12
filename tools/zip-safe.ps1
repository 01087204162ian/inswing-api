param(
  [string]$ProjectPath = ".",
  [string]$OutDir = ".\_artifacts",
  [string]$Name = ""
)

$ErrorActionPreference = "Stop"

# Resolve paths
$ProjectPath = (Resolve-Path $ProjectPath).Path
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$OutDir = (Resolve-Path $OutDir).Path

# Default zip name: foldername_yyyyMMdd_HHmmss.zip
if ([string]::IsNullOrWhiteSpace($Name)) {
  $folder = Split-Path $ProjectPath -Leaf
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $Name = "${folder}_${ts}.zip"
}
$ZipPath = Join-Path $OutDir $Name

# Exclude rules (relative)
$excludeDirs = @(
  "\.git\",
  "\node_modules\",
  "\uploads\",
  "\logs\",
  "\log\",
  "\dist\",
  "\build\",
  "\.next\",
  "\_artifacts\"
)

$excludeFilesRegex = @(
  '(^|\\)\.env($|\\)',          # .env
  '(^|\\)\.env\..*',            # .env.*
  '(^|\\).*\.key$',             # *.key
  '(^|\\).*\.pem$',             # *.pem
  '(^|\\)id_rsa($|\\)',         # ssh key
  '(^|\\)id_ed25519($|\\)',     # ssh key
  '(^|\\).*secrets?.*',         # secrets.*
  '(^|\\).*\.log$'              # *.log
)

# Keep .env.example (allowed)
$allowListRegex = @(
  '(^|\\)\.env\.example$'
)

Write-Host "ProjectPath: $ProjectPath"
Write-Host "ZipPath:     $ZipPath"

# Collect files
$allFiles = Get-ChildItem -Path $ProjectPath -Recurse -File -Force

$filtered = @()
foreach ($f in $allFiles) {
  $full = $f.FullName
  $rel  = $full.Substring($ProjectPath.Length).TrimStart('\')

  # Exclude by dir
  $skipDir = $false
  foreach ($d in $excludeDirs) {
    if ($full -like "*$d*") { $skipDir = $true; break }
  }
  if ($skipDir) { continue }

  # Allowlist (env.example)
  $allowed = $false
  foreach ($a in $allowListRegex) {
    if ($rel -match $a) { $allowed = $true; break }
  }
  if ($allowed) { $filtered += $f; continue }

  # Exclude by file regex
  $skipFile = $false
  foreach ($r in $excludeFilesRegex) {
    if ($rel -match $r) { $skipFile = $true; break }
  }
  if ($skipFile) { continue }

  $filtered += $f
}

# Create zip using .NET (no temp copy)
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

$zip = [System.IO.Compression.ZipFile]::Open($ZipPath, 'Create')
try {
  foreach ($f in $filtered) {
    $entry = $f.FullName.Substring($ProjectPath.Length).TrimStart('\')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $entry) | Out-Null
  }
}
finally {
  $zip.Dispose()
}

Write-Host "`n✅ DONE: $ZipPath"
Write-Host "Included files: $($filtered.Count)"

