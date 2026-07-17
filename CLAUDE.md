@AGENTS.md

## Working Rules

- **All UI/component changes must be applied to BOTH `main` and `design/v1` branches** — use `git checkout design/v1 && git checkout main -- <file>` to port changes
- **Always push to both GitHub remotes** — `git push origin --all` covers both `aldenongjingyi` and `map711`
- **Deploy to DO Spaces after any functional change** — `node --env-file=.env.local scripts/deploy.mjs`
- **Do NOT auto-commit** — only commit when explicitly asked
