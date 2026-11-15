.PHONY: setup dev test backend frontend

setup:
	python3 -m venv backend/.venv
	backend/.venv/bin/pip install -r backend/requirements.txt
	cd frontend && npm install

# Start backend (:8000) and frontend (:5173) together
dev:
	./scripts/dev.sh

backend:
	cd backend && .venv/bin/python -m uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && .venv/bin/python -m pytest -q
