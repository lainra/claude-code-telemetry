/**
 * Integration tests for OTLP Server
 *
 * NOTE: These tests require a running server instance.
 * Run with: npm test
 *
 * The test runner will automatically start and stop the server.
 */

// const http = require('http') // Currently unused
const { startTestServer, stopTestServer } = require('./testServer')

// Skip tests if running in CI without proper setup
const skipIntegrationTests = process.env.SKIP_INTEGRATION_TESTS === 'true'

// These are integration tests that require a running server
const describeIntegration = skipIntegrationTests ? describe.skip : describe

describeIntegration('OTLP Server Integration Tests', () => {
  let baseUrl
  let serverProcess

  // Start server before all tests
  beforeAll(async () => {
    const result = await startTestServer('server.test.js', {
      LANGFUSE_PUBLIC_KEY: 'pk-test',
      LANGFUSE_SECRET_KEY: 'sk-test',
    })
    serverProcess = result.serverProcess
    baseUrl = result.baseUrl
  }, 15000)

  // Stop server after all tests
  afterAll(async () => {
    await stopTestServer(serverProcess)
  })

  describe('Health Check', () => {
    test('GET /health returns server status', async () => {
      const response = await fetch(`${baseUrl}/health`)
      expect(response.status).toBe(200)

      const health = await response.json()
      expect(health).toHaveProperty('status', 'healthy')
      expect(health).toHaveProperty('uptime')
      expect(health).toHaveProperty('sessions')
      expect(health).toHaveProperty('requestCount')
      expect(health).toHaveProperty('errorCount')
      expect(health).toHaveProperty('langfuse')
    })
  })

  describe('OTLP Endpoints', () => {
    test('POST /v1/logs accepts valid OTLP logs', async () => {
      const testLog = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'test-service' } },
            ],
          },
          scopeLogs: [{
            scope: { name: 'test-scope' },
            logRecords: [{
              timeUnixNano: Date.now() * 1000000,
              body: { stringValue: 'test log message' },
              attributes: [
                { key: 'test.attribute', value: { stringValue: 'test-value' } },
              ],
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testLog),
      })

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result).toHaveProperty('partialSuccess')
    })

    test('POST /v1/metrics accepts valid OTLP metrics', async () => {
      const testMetric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'test-service' } },
            ],
          },
          scopeMetrics: [{
            scope: { name: 'test-scope' },
            metrics: [],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testMetric),
      })

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result).toHaveProperty('partialSuccess')
    })

    test('POST /v1/traces accepts valid OTLP traces', async () => {
      const testTrace = {
        resourceSpans: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'test-service' } },
            ],
          },
          scopeSpans: [{
            scope: { name: 'test-scope' },
            spans: [],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testTrace),
      })

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result).toHaveProperty('partialSuccess')
    })
  })

  describe('Claude Code Events', () => {
    test('Processes user prompt event correctly', async () => {
      const sessionId = `test-session-${Date.now()}`
      const userPromptLog = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
              { key: 'service.version', value: { stringValue: '1.0.0' } },
            ],
          },
          scopeLogs: [{
            scope: { name: 'com.anthropic.claude_code.events' },
            logRecords: [{
              timeUnixNano: Date.now() * 1000000,
              body: { stringValue: 'claude_code.user_prompt' },
              attributes: [
                { key: 'session.id', value: { stringValue: sessionId } },
                { key: 'user.email', value: { stringValue: 'test@example.com' } },
                { key: 'prompt', value: { stringValue: 'Test prompt' } },
                { key: 'prompt_length', value: { stringValue: '11' } },
              ],
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPromptLog),
      })

      if (response.status !== 200) {
        const error = await response.text()
        console.error('Response error:', error)
      }
      expect(response.status).toBe(200)
    })

    test('Processes API request event correctly', async () => {
      const sessionId = `test-session-${Date.now()}`
      const apiRequestLog = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeLogs: [{
            scope: { name: 'com.anthropic.claude_code.events' },
            logRecords: [{
              timeUnixNano: Date.now() * 1000000,
              body: { stringValue: 'claude_code.api_request' },
              attributes: [
                { key: 'session.id', value: { stringValue: sessionId } },
                { key: 'model', value: { stringValue: 'claude-3-5-sonnet-20241022' } },
                { key: 'input_tokens', value: { stringValue: '100' } },
                { key: 'output_tokens', value: { stringValue: '200' } },
                { key: 'cost_usd', value: { stringValue: '0.0015' } },
                { key: 'duration_ms', value: { stringValue: '1500' } },
              ],
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequestLog),
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Error Handling', () => {
    test('Returns 400 for invalid JSON', async () => {
      const response = await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      expect(response.status).toBe(400)
      const error = await response.json()
      expect(error).toHaveProperty('error')
    })

    test('Returns 404 for unknown endpoints', async () => {
      const response = await fetch(`${baseUrl}/unknown`, {
        method: 'POST',
      })

      expect(response.status).toBe(404)
    })

    test('Handles CORS preflight requests', async () => {
      const response = await fetch(`${baseUrl}/v1/logs`, {
        method: 'OPTIONS',
      })

      expect(response.status).toBe(204) // OPTIONS returns 204 No Content
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.get('access-control-allow-methods')).toContain('POST')
    })
  })

  describe('Full Session Flow', () => {
    test('Full session flow', async () => {
      const sessionId = `integration-test-${Date.now()}`

      // 1. Send user prompt
      await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceLogs: [{
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'claude-code' } },
              ],
            },
            scopeLogs: [{
              scope: { name: 'com.anthropic.claude_code.events' },
              logRecords: [{
                timeUnixNano: Date.now() * 1000000,
                body: { stringValue: 'claude_code.user_prompt' },
                attributes: [
                  { key: 'session.id', value: { stringValue: sessionId } },
                  { key: 'prompt', value: { stringValue: 'Integration test prompt' } },
                ],
              }],
            }],
          }],
        }),
      })

      // 2. Send API request
      await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceLogs: [{
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'claude-code' } },
              ],
            },
            scopeLogs: [{
              scope: { name: 'com.anthropic.claude_code.events' },
              logRecords: [{
                timeUnixNano: Date.now() * 1000000 + 1000000,
                body: { stringValue: 'claude_code.api_request' },
                attributes: [
                  { key: 'session.id', value: { stringValue: sessionId } },
                  { key: 'model', value: { stringValue: 'claude-3-5-sonnet-20241022' } },
                  { key: 'input_tokens', value: { stringValue: '150' } },
                  { key: 'output_tokens', value: { stringValue: '300' } },
                  { key: 'cost_usd', value: { stringValue: '0.00225' } },
                  { key: 'duration_ms', value: { stringValue: '2000' } },
                ],
              }],
            }],
          }],
        }),
      })

      // 3. Send tool result with retry
      for (let retry = 0; retry < 3; retry++) {
        try {
          await fetch(`${baseUrl}/v1/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resourceLogs: [{
                resource: {
                  attributes: [
                    { key: 'service.name', value: { stringValue: 'claude-code' } },
                  ],
                },
                scopeLogs: [{
                  scope: { name: 'com.anthropic.claude_code.events' },
                  logRecords: [{
                    timeUnixNano: Date.now() * 1000000 + 2000000,
                    body: { stringValue: 'claude_code.tool_result' },
                    attributes: [
                      { key: 'session.id', value: { stringValue: sessionId } },
                      { key: 'tool_name', value: { stringValue: 'Write' } },
                      { key: 'success', value: { stringValue: 'true' } },
                      { key: 'duration_ms', value: { stringValue: '50' } },
                    ],
                  }],
                }],
              }],
            }),
          })
          break // Success, exit retry loop
        } catch (error) {
          if (retry === 2) throw error // Last retry, re-throw
          await new Promise(resolve => setTimeout(resolve, 100)) // Wait before retry
        }
      }

      // Check health to verify session was created
      const healthResponse = await fetch(`${baseUrl}/health`)
      const health = await healthResponse.json()
      expect(health.sessions).toBeGreaterThanOrEqual(1)
    })
  })
})
