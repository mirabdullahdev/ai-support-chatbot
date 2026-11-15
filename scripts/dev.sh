#!/usr/bin/env bash
# Runs backend (port 8000) and frontend (port 5173) together. Usage: ./scripts/dev.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$ROOT/backend/.env" ]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "Created backend/.env - add your OPENAI_API_KEY to it, then restart."
fi

if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "Creating Python virtualenv and installing backend dependencies..."
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install --no-audit --no-fund)
fi

cleanup() { kill "$API_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

(cd "$ROOT/backend" && .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
API_PID=$!
echo "Backend  -> http://localhost:8000/docs"
echo "Frontend -> http://localhost:5173"
cd "$ROOT/frontend" && npm run dev
