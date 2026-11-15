# Runs backend (port 8000) and frontend (port 5173) together. Usage: .\scripts\dev.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$venvPython = Join-Path $backend ".venv\Scripts\python.exe"

if (-not (Test-Path (Join-Path $backend ".env"))) {
    Copy-Item (Join-Path $backend ".env.example") (Join-Path $backend ".env")
    Write-Host "Created backend\.env - add your OPENAI_API_KEY to it, then restart." -ForegroundColor Yellow
}
if (-not (Test-Path $venvPython)) {
    Write-Host "Creating Python virtualenv and installing backend dependencies..."
    python -m venv (Join-Path $backend ".venv")
    & $venvPython -m pip install -q -r (Join-Path $backend "requirements.txt")
}
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "Installing frontend dependencies..."
    Push-Location $frontend; npm install --no-audit --no-fund; Pop-Location
}

$api = Start-Process -FilePath $venvPython -WorkingDirectory $backend -PassThru -NoNewWindow `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"
try {
    Write-Host "Backend  -> http://localhost:8000/docs"
    Write-Host "Frontend -> http://localhost:5173"
    Push-Location $frontend
    npm run dev
} finally {
    Pop-Location
    if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force }
}
