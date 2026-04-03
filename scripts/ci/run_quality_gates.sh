#!/bin/sh
# Local quality gate — same checks as CI, runnable offline
set -e
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "==> format:check"
npm run format:check

echo "==> lint"
npm run lint

echo "==> unit tests"
npm run test:unit

echo "==> quality gate passed"
