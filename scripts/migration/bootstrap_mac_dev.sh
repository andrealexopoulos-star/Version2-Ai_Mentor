#!/usr/bin/env bash
set -euo pipefail

echo "== BIQc Mac Dev Bootstrap =="

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required"
  exit 1
fi

if ! command -v yarn >/dev/null 2>&1; then
  echo "yarn not found; installing yarn classic"
  npm install -g yarn@1.22.22
fi

echo "1) Backend deps"
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..

echo "2) Frontend deps"
cd frontend
yarn install --frozen-lockfile
cd ..

echo "3) Env file checks"
if [[ ! -f backend/.env ]]; then
  echo "Missing backend/.env (copy from backend/.env.example)"
  exit 1
fi
if [[ ! -f frontend/.env ]]; then
  echo "Missing frontend/.env (copy from frontend/.env.example)"
  exit 1
fi

echo "4) Run commands (in separate terminals)"
echo "Backend: cd backend && source .venv/bin/activate && uvicorn server:app --reload --port 8001"
echo "Frontend: cd frontend && yarn start"

echo "5) Health checks"
echo "Backend: curl http://localhost:8001/api/health"
echo "Frontend: open http://localhost:3000"

echo "Bootstrap complete."
