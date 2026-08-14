# WARKA local Windows starter — real Supabase, no Cloud port forwarding.
# Usage (from repo root in PowerShell):
#   .\scripts\start-local-windows.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "WARKA local start (Windows)" -ForegroundColor Green
Write-Host "Project: $(Get-Location)"

$branch = (git branch --show-current).Trim()
if ($branch -ne "cursor/warka-production-integration-f78a") {
  Write-Host "Checking out cursor/warka-production-integration-f78a ..."
  git fetch origin cursor/warka-production-integration-f78a
  git checkout cursor/warka-production-integration-f78a
}
git pull origin cursor/warka-production-integration-f78a

if (-not (Test-Path ".env.local")) {
  Write-Host ""
  Write-Host ".env.local is missing." -ForegroundColor Red
  Write-Host "Create .env.local in the project root with real Supabase values"
  Write-Host "(copy from your secure local backup / Cloud agent workspace)."
  Write-Host "Required keys: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,"
  Write-Host "SUPABASE_SERVICE_ROLE_KEY, ACCESS_CODE_ENCRYPTION_KEY,"
  Write-Host "ACCESS_CODE_HMAC_SECRET, BOOKING_SESSION_SECRET"
  Write-Host "Template: .env.example"
  exit 1
}

# Validate required env names without printing values
$required = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ACCESS_CODE_ENCRYPTION_KEY",
  "ACCESS_CODE_HMAC_SECRET",
  "BOOKING_SESSION_SECRET"
)
$envMap = @{}
Get-Content ".env.local" | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $i = $_.IndexOf('=')
  $k = $_.Substring(0, $i).Trim()
  $v = $_.Substring($i + 1).Trim()
  $envMap[$k] = $v
}
foreach ($k in $required) {
  if (-not $envMap.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($envMap[$k])) {
    Write-Host "Missing $k in .env.local" -ForegroundColor Red
    exit 1
  }
  Write-Host "$k : configured"
}
if ($envMap["NEXT_PUBLIC_SUPABASE_URL"] -notmatch 'iyspwyljihtduvnibzll') {
  Write-Host "NEXT_PUBLIC_SUPABASE_URL must point to project iyspwyljihtduvnibzll" -ForegroundColor Red
  exit 1
}
Write-Host "Supabase mode: REAL (iyspwyljihtduvnibzll)"

# Free port 3000 (stale Next/node only)
$listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $listeners) {
  $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
  if ($proc -and ($proc.ProcessName -match 'node|next')) {
    Write-Host "Stopping stale process PID $($proc.Id) ($($proc.ProcessName)) on :3000"
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  }
}

if (Test-Path ".next") {
  Write-Host "Removing stale .next ..."
  Remove-Item -Recurse -Force ".next"
}

npm install
Write-Host "Starting: npm run dev  ->  http://localhost:3000/login"
npm run dev
