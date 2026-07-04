.DEFAULT_GOAL := help
.PHONY: help dev seed test demo

help:  ## List targets
	@grep -E '^[a-z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-8s %s\n",$$1,$$2}'

dev:  ## Boot worker (:8787) + ui (:5173) locally, keyless
	@echo "TODO: wrangler dev (worker/) + npm run dev (ui/) — see docs/plans/001-build-plan.md"

seed:  ## One-shot scrape → opportunities.json → KV
	@echo "TODO: uv run ingest/seed.py — see docs/plans/001-build-plan.md"

test:  ## Run ui + worker + ingest tests
	@echo "TODO: (cd ui && npm test) ; (cd worker && npm test) ; (cd ingest && uv run pytest -q)"

demo:  ## Boot everything + open the replay (offline safety net)
	@echo "TODO: make dev + open replay — see docs/plans/001-build-plan.md"
