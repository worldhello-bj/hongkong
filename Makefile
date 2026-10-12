.PHONY: serve test build research-test data
serve:
	npm start
build:
	npm run build
test:
	npm test
research-test:
	python -m pytest -q
	python scripts/benchmark.py
data:
	python scripts/fetch_sources.py
	python scripts/build_bus_services.py
	python scripts/fetch_bus_patterns.py
	python scripts/build_model.py
