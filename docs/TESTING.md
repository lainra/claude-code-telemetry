# Testing Guide

This comprehensive guide covers all aspects of testing the Claude Code Telemetry bridge.

## Overview

The project uses Jest for all testing with three levels:
1. **Unit Tests** - Test individual modules without external dependencies
2. **Integration Tests** - Test with real server and API interactions
3. **End-to-End Tests** - Test with real Claude binary (requires credentials)

## Test Structure

### Unit Tests (`test/unit/`)
- **Purpose**: Test pure functions and logic in isolation
- **No Server Required**: Run without external dependencies
- **Fast Execution**: Complete in < 1 second
- **Files**: 
  - `eventProcessor.test.js` - Event handling logic
  - `metricsProcessor.test.js` - Metrics processing
  - `sessionHandler.test.js` - Session management (831 lines, most comprehensive)
  - `serverHelpers.test.js` - Helper functions
  - `requestHandlers.test.js` - Request processing

### Integration Tests 
- **Purpose**: Test with real server and Langfuse API
- **Auto-starts Server**: Test suite manages server lifecycle
- **Real HTTP Requests**: Uses fetch() to test actual endpoints
- **Files**:
  - `test/server.test.js` - OTLP endpoints
  - `test/metrics.integration.test.js` - Metrics flow
  - `test/apiError.integration.test.js` - Error handling
  - `test/integration/langfuse.integration.test.js` - Real Langfuse API
  - `test/integration/e2e.integration.test.js` - Full E2E with Claude

### Test Helpers
- `testServer.js` - Manages server lifecycle for tests
- `helpers/langfuse-client.js` - Direct Langfuse API access
- `helpers/otlp-test-data.js` - Consistent test fixtures

## Running Tests

### All Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### Specific Test Types
```bash
# Unit tests only (fast, no dependencies)
npm run test:unit

# Integration tests (requires Langfuse credentials)
npm run test:integration

# CI mode (skips integration tests)
npm run test:ci
```

### Manual Testing with Real Claude
```bash
# 1. Start the server
npm start

# 2. In another terminal, configure Claude
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318

# 3. Use Claude normally
claude "What is 2+2?"
```

## Test Coverage

Current coverage: **95.44%**
- Statements: 95.43%
- Branches: 77.13%
- Functions: 92.45%
- Lines: 96.29%

### Key Test Scenarios

1. **Event Processing**
   - User prompts with full metadata
   - API requests (Haiku and Opus models)
   - Tool usage (Read, Write, Bash, etc.)
   - API errors with proper error codes

2. **Metrics Processing**
   - Cost tracking by model
   - Token usage including cache tokens
   - Lines of code modifications
   - Session metrics

3. **Session Management**
   - Auto-creation on first event
   - 1-hour timeout cleanup
   - Proper finalization with summaries
   - Concurrent session handling

## Writing New Tests

### Unit Test Template
```javascript
// Create in test/unit/myModule.test.js
jest.mock('langfuse') // Mock external dependencies

const { myFunction } = require('../../src/myModule')

describe('My Module', () => {
  test('should do something', () => {
    const result = myFunction(input)
    expect(result).toBe(expected)
  })
})
```

### Integration Test Template
```javascript
// Create new file or add to existing integration test
const { startTestServer, stopTestServer } = require('./testServer')

describe('My Integration Test', () => {
  let serverProcess, baseUrl
  
  beforeAll(async () => {
    const result = await startTestServer('my.test.js')
    serverProcess = result.serverProcess
    baseUrl = result.baseUrl
  }, 15000)
  
  afterAll(async () => {
    await stopTestServer(serverProcess)
  })
  
  test('should handle requests', async () => {
    const response = await fetch(`${baseUrl}/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    })
    expect(response.status).toBe(200)
  })
})
```

## Best Practices

1. **Keep unit tests pure** - No external dependencies, no server required
2. **Mock external services** - Use Jest mocks for Langfuse, HTTP, etc.
3. **Test edge cases** - Invalid inputs, error conditions, timeouts
4. **Use descriptive test names** - Should explain what's being tested
5. **Clean up resources** - Always clean up in afterAll/afterEach hooks
6. **Avoid hardcoded ports** - Use environment variables when possible
7. **Test both success and failure** - Don't just test the happy path

## Troubleshooting

### Integration Tests Fail
```bash
# Kill any lingering processes
lsof -ti:4318 | xargs kill -9 2>/dev/null

# Check Langfuse credentials
echo $LANGFUSE_PUBLIC_KEY
echo $LANGFUSE_SECRET_KEY
```

### "Jest did not exit" Warning
- Normal for integration tests
- Tests use `--forceExit` flag
- Caused by Langfuse SDK intervals

### E2E Tests Skipped
- Requires Claude binary in PATH
- Requires Langfuse credentials
- Set `CI=false` to enable in CI

### Tests Hang After Completion
- Async operations not properly cleaned up
- Ensure all intervals/timeouts are cleared in afterAll hooks

### Debug Mode
```bash
# For tests
LOG_LEVEL=debug npm test

# For server
LOG_LEVEL=debug npm start
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Telemetry Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests with coverage
        run: npm run test:coverage
        env:
          LANGFUSE_PUBLIC_KEY: ${{ secrets.LANGFUSE_PUBLIC_KEY }}
          LANGFUSE_SECRET_KEY: ${{ secrets.LANGFUSE_SECRET_KEY }}
      
      - name: Upload coverage reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: coverage-report
          path: coverage/
```

## CI/CD Considerations

1. **Use `npm run test:ci`** in CI pipelines to skip integration tests
2. **Set `SKIP_INTEGRATION_TESTS=true`** to force skip
3. **Integration tests require ~15 seconds** for server startup/shutdown
4. **Unit tests complete in < 1 second**

## Future Improvements

1. **Add performance benchmarks** - Track latency over time
2. **Add load testing** - Verify server handles concurrent sessions
3. **Add mutation testing** - Ensure tests catch code changes
4. **Add visual regression tests** - For any UI components

## Summary

The test suite provides comprehensive coverage (95.44%) using Jest for both unit and integration testing. Tests are fast, reliable, and can be run in isolation or as a complete suite. The modular structure makes it easy to add new tests as the codebase evolves.