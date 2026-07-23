.DEFAULT_GOAL := help
.PHONY: help dev dev-ui dev-worker test deploy demo bump

help:  ## List targets
	@grep -E '^[a-z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-11s %s\n",$$1,$$2}'

dev:  ## Boot worker (:8787) + ui (:5173) together, keyless (Ctrl-C stops both)
	$(MAKE) -j2 dev-worker dev-ui

dev-ui:  ## Vite dev server (:5173), proxies /api -> :8787
	cd ui && npm run dev

dev-worker:  ## wrangler dev (:8787) — the /api engine + console Arize spans
	cd worker && npm run dev

test:  ## Run ui + worker + ingest tests
	cd ui && npm test
	cd worker && npm test
	uvx pytest -q ingest

deploy:  ## Build the SPA -> Cloudflare Pages, then deploy the Worker (CF auth via root .env or ~/.cf-token)
	bash scripts/provision_cf.sh

bump:  ## Stamp VERSION across ui + worker packages (+ lockfiles) and the README badge, e.g. make bump VERSION=1.2.3
	@test -n "$(VERSION)" || { echo "usage: make bump VERSION=x.y.z"; exit 1; }
	npm version $(VERSION) --no-git-tag-version --prefix ui
	npm version $(VERSION) --no-git-tag-version --prefix worker
	sed -i 's|version-[0-9][0-9.]*-58f4c2|version-$(VERSION)-58f4c2|' README.md
	@echo "Bumped to $(VERSION). Review the diff, then commit + tag: git tag -a v$(VERSION)"

demo:  ## Local demo: boot both, then open http://localhost:5173 (prod: https://sortmy.london)
	$(MAKE) dev
