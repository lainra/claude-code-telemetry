#!/bin/sh
# Local security review — mirrors CI security job
# NOTE: npm audit depends on the live npm registry (partial enforcement)
set -e
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "==> dependency audit (network required)"
npm audit --audit-level=high || echo "WARN: audit found issues — review above output"

echo "==> secret scan (full tree, excluding node_modules and tests)"
if git grep -E '(api[_-]?key|api[_-]?secret|auth[_-]?token|private[_-]?key|secret[_-]?key)\s*[:=]\s*[A-Za-z0-9+/]{20,}' \
    -- ':(exclude)node_modules/' ':(exclude)*.md' ':(exclude)test/' ':(exclude)*.json' 2>/dev/null; then
  echo "ERROR: potential secrets found — review above matches"
  exit 1
fi
echo "No secrets detected"

echo "==> docker build smoke check (skipped if docker unavailable)"
if command -v docker >/dev/null 2>&1; then
  docker build -t claude-telemetry:security-check . --quiet
  echo "Docker build OK"
else
  echo "SKIP: docker not available locally"
fi

echo "==> security review complete"
echo "MANUAL REVIEW REQUIRED:"
echo "  - auth boundaries in src/server.js (API_KEY middleware)"
echo "  - child_process / shell calls (none currently, verify if added)"
echo "  - outbound HTTP calls to Langfuse (src/sessionHandler.js)"
echo "  - FALLBACK_FILE path traversal (src/offlineFallback.js)"
