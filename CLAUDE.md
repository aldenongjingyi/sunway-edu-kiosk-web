@AGENTS.md

## Working Rules

- **Always push to both GitHub remotes** — `git push origin --all` covers both `aldenongjingyi` and `map711`
- **Deploy to DO Spaces after any functional change** — `node --env-file=.env.local scripts/deploy.mjs`
- **Do NOT auto-commit** — only commit when explicitly asked
