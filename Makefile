.DEFAULT_GOAL := help
.PHONY: help dev dev-ui dev-worker test deploy seed demo bump

help:  ## List targets
	@grep -E '^[a-z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-11s %s\n",$$1,$$2}'

dev:  ## Boot worker (:8787) + ui (:5173) together, keyless (Ctrl-C stops both)
	$(MAKE) -j2 dev-worker dev-ui

dev-ui:  ## Vite dev server (:5173), proxies /run -> :8787
	cd ui && npm run dev

dev-worker:  ## wrangler dev (:8787) — the /run engine + console Arize spans
	cd worker && npm run dev

test:  ## Run ui + worker tests
	cd ui && npm test
	cd worker && npm test

deploy:  ## Deploy the Worker (wrangler deploy; needs Cloudflare auth). UI deploys via gh-pages CI.
	cd worker && npm run deploy

bump:  ## Stamp VERSION across ui + worker packages (+ lockfiles) and the README badge, e.g. make bump VERSION=1.2.3
	@test -n "$(VERSION)" || { echo "usage: make bump VERSION=x.y.z"; exit 1; }
	npm version $(VERSION) --no-git-tag-version --prefix ui
	npm version $(VERSION) --no-git-tag-version --prefix worker
	sed -i 's|version-[0-9][0-9.]*-blue|version-$(VERSION)-blue|' README.md
	@echo "Bumped to $(VERSION). Review the diff, then commit + tag: git tag -a v$(VERSION)"

seed:  ## One-shot scrape -> opportunities.json -> KV (Phase 2)
	@echo "TODO (Phase 2): uv run ingest/seed.py — see docs/plans/001-build-plan.md"

demo:  ## Local demo: boot both, then open http://localhost:5173 (Pages: qte77.github.io/ldnmxx-hack/)
	$(MAKE) dev
