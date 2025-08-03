const { startTestServer, stopTestServer } = require('./testServer')

describe('API Error Integration Tests', () => {
  let serverProcess
  let baseUrl

  beforeAll(async () => {
    const result = await startTestServer('apiError.integration.test.js')
    serverProcess = result.serverProcess
    baseUrl = result.baseUrl
  }, 15000)

  afterAll(async () => {
    await stopTestServer(serverProcess)
  })

  describe('API Error Events from Logs', () => {
    test('processes API error with 401 status', async () => {
      const logData = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeLogs: [{
            scope: { name: 'claude-code-telemetry' },
            logRecords: [{
              timeUnixNano: Date.now() * 1000000,
              body: { stringValue: 'claude_code.api_error' },
              attributes: [
                { key: 'session.id', value: { stringValue: 'test-api-error-401' } },
                { key: 'model', value: { stringValue: 'claude-3-opus' } },
                { key: 'error_message', value: { stringValue: 'Authentication failed' } },
                { key: 'status_code', value: { intValue: '401' } },
              ],
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      })

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result).toHaveProperty('partialSuccess')
    })

    test('processes API error with rate limit', async () => {
      const logData = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeLogs: [{
            scope: { name: 'claude-code-telemetry' },
            logRecords: [{
              timeUnixNano: Date.now() * 1000000,
              body: { stringValue: 'claude_code.api_error' },
              attributes: [
                { key: 'session.id', value: { stringValue: 'test-api-error-429' } },
                { key: 'model', value: { stringValue: 'claude-3-haiku' } },
                { key: 'error', value: { stringValue: 'Rate limit exceeded' } },
                { key: 'status', value: { intValue: '429' } },
              ],
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      })

      expect(response.status).toBe(200)
    })

    test('processes API error with network failure', async () => {
      const logData = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeLogs: [{
            scope: { name: 'claude-code-telemetry' },
            logRecords: [{
              timeUnixNano: Date.now() * 1000000,
              body: { stringValue: 'claude_code.api_error' },
              attributes: [
                { key: 'session.id', value: { stringValue: 'test-api-error-network' } },
                { key: 'error_message', value: { stringValue: 'Network timeout' } },
              ],
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Combined Error and Success Flow', () => {
    test('handles API error followed by successful request', async () => {
      const sessionId = 'test-error-recovery'

      // First, send an API error
      const errorLog = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeLogs: [{
            scope: { name: 'claude-code-telemetry' },
            logRecords: [{
              timeUnixNano: Date.now() * 1000000,
              body: { stringValue: 'claude_code.api_error' },
              attributes: [
                { key: 'session.id', value: { stringValue: sessionId } },
                { key: 'model', value: { stringValue: 'claude-3-opus' } },
                { key: 'error_message', value: { stringValue: 'Temporary failure' } },
                { key: 'status_code', value: { intValue: '503' } },
              ],
            }],
          }],
        }],
      }

      // Send error with retry logic
      let errorResponse
      for (let retry = 0; retry < 3; retry++) {
        try {
          errorResponse = await fetch(`${baseUrl}/v1/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorLog),
          })
          break
        } catch (error) {
          if (retry === 2) throw error
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      expect(errorResponse.status).toBe(200)

      // Then send a successful API request
      const successLog = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeLogs: [{
            scope: { name: 'claude-code-telemetry' },
            logRecords: [{
              timeUnixNano: Date.now() * 1000000 + 1000000,
              body: { stringValue: 'claude_code.api_request' },
              attributes: [
                { key: 'session.id', value: { stringValue: sessionId } },
                { key: 'model', value: { stringValue: 'claude-3-opus' } },
                { key: 'input_tokens', value: { intValue: '500' } },
                { key: 'output_tokens', value: { intValue: '1000' } },
                { key: 'cost', value: { doubleValue: 0.25 } },
              ],
            }],
          }],
        }],
      }

      const successResponse = await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(successLog),
      })

      expect(successResponse.status).toBe(200)
    })
  })
})
