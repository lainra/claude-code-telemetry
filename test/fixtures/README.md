# Test Fixtures

This directory contains test fixtures for validating Claude Code telemetry with real Claude binary interactions.

## Structure

- `prompts/` - Various prompt scenarios for testing
- `expected/` - Expected telemetry patterns for validation
- `mock-files/` - Test files for file operation scenarios

## Usage

These fixtures are used by:
1. `scripts/manual-test.sh` - Manual test protocol
2. `scripts/automated-test.sh` - Automated test runner
3. Unit tests in `test/server.test.js`