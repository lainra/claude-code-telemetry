#!/bin/sh
# Wire repo-local git hooks from .githooks/
set -e
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
git -C "$REPO_ROOT" config core.hooksPath .githooks
chmod +x "$REPO_ROOT/.githooks/pre-commit"
echo "Git hooks installed — using .githooks/"
