---
schema_version: 1
task_id: 'guardrails-baseline'
requires_split_authorship: false
na_controls:
  - control: 'parseable_handoff_artifact'
    reason: 'Repo does not require split test/implementation authorship.'
  - control: 'typescript_type_checking'
    reason: 'Repo is JavaScript-only; no TypeScript layer.'
blockers: []
---

# Guardrails Report — claude-code-telemetry

Generated: 2026-04-03

## Policy vs Enforcement Matrix

| Control                            | Policy source                            | Enforcement                                                                                                  | Status                                  | Notes                                                                                                                                 |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code doc naming (AGENTS.md) | skill:claudecode-conventions             | `AGENTS.md` created; `CLAUDE.md` replaced with `@AGENTS.md`                                                  | **enforced**                            | Was blocker before this PR                                                                                                            |
| Pinned toolchain manifest          | node-ts reference                        | `.nvmrc` (Node 22); `engines` in `package.json`; lockfile checked in                                         | **partial**                             | `engines` uses range `>=18`, not exact pin. `.nvmrc` pins 22. No `packageManager` field yet.                                          |
| Local hook wiring                  | node-ts reference                        | `.githooks/pre-commit`; `scripts/install-hooks.sh`; `npm run hooks:install`                                  | **enforced**                            | Developer must run `npm run hooks:install` once after clone                                                                           |
| Local quality gate                 | node-ts reference                        | `scripts/ci/run_quality_gates.sh`; `npm run quality`                                                         | **enforced**                            | Runs format:check + lint + unit tests offline                                                                                         |
| Local security review entrypoint   | node-ts reference                        | `scripts/ci/run_security_review.sh`; `npm run security`                                                      | **partial**                             | `npm audit` requires live network; docker step skips gracefully if no docker; secret scan is local                                    |
| Dependency vulnerability audit     | `.github/workflows/security.yml`         | CI: `npm audit --audit-level=high`; local: `npm run security`                                                | **partial**                             | Network-dependent; no local advisory mirror                                                                                           |
| Secret scanning                    | `.github/workflows/security.yml`         | CI: git grep regex; local: pre-commit hook + `npm run security`                                              | **enforced** locally, **partial** in CI | CI scan excludes test/ and \*.json; local hook scans staged files                                                                     |
| Docker / runtime checks            | `Dockerfile`; `.github/workflows/ci.yml` | Non-root user, healthcheck, prod-only deps in Dockerfile; Trivy in CI; local docker build in security script | **partial**                             | Trivy is CI-only + network; local build smoke check added                                                                             |
| GitNexus / code intelligence       | skill:gitnexus reference                 | Not installed                                                                                                | **policy-only**                         | Bootstrap: `npx gitnexus analyze` from repo root. Required before editing shared modules (`sessionHandler.js`, `requestHandlers.js`). |
| TypeScript type checking           | N/A                                      | N/A                                                                                                          | **N/A**                                 | JavaScript-only repo                                                                                                                  |
| Parseable handoff artifact         | N/A                                      | N/A                                                                                                          | **N/A**                                 | No split authorship requirement                                                                                                       |

## Manual Review Obligations

The following require human review and cannot be automated:

| Area                         | Location                 | Why manual                                                                    |
| ---------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| API key auth middleware      | `src/server.js`          | Must verify request validation is correct for the threat model                |
| Outbound HTTP to Langfuse    | `src/sessionHandler.js`  | Verify no sensitive data leaks beyond what is intentional                     |
| `FALLBACK_FILE` path         | `src/offlineFallback.js` | Env var controls fs write path — verify no path traversal risk                |
| `OTLP_RECEIVER_HOST` binding | `src/serverHelpers.js`   | Defaults to 127.0.0.1 in dev, 0.0.0.0 in Docker — review for network exposure |

## Remaining Gaps (not blockers)

1. **GitNexus not installed** — run `npx gitnexus analyze` to bootstrap code-intelligence index. Required before making changes to widely-used modules.
2. **`engines` range is not exact** — `>=18.0.0` allows drift; `.nvmrc` mitigates for local dev but CI tests across 18/20/22.
3. **`npm audit` is network-dependent** — no local advisory mirror. Acceptable for this project size; mark as `partial`.
4. **`packageManager` field absent** — consider adding `"packageManager": "npm@10.x.x"` to lock the package manager version.
