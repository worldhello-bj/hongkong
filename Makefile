.PHONY: serve test data build
serve:
	python -m uvicorn app.main:app --host 127.0.0.1 --port 8081
test:
	python -m pytest -q
	python scripts/benchmark.py
data:
	python scripts/fetch_sources.py
	python scripts/build_bus_services.py
	python scripts/fetch_bus_patterns.py
	python scripts/build_model.py
build:
	cd web && npm ci && npm run build
