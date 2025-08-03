const { startTestServer, stopTestServer } = require('./testServer')

describe('Metrics Integration Tests', () => {
  let serverProcess
  let baseUrl

  beforeAll(async () => {
    const result = await startTestServer('metrics.integration.test.js')
    serverProcess = result.serverProcess
    baseUrl = result.baseUrl
  }, 15000)

  afterAll(async () => {
    await stopTestServer(serverProcess)
  })

  describe('Cost Metrics', () => {
    test('processes cost usage metrics with session', async () => {
      const metric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
              { key: 'service.version', value: { stringValue: '3.0.0' } },
            ],
          },
          scopeMetrics: [{
            scope: { name: 'claude-code-telemetry' },
            metrics: [{
              name: 'claude_code.cost.usage',
              description: 'Cost in USD',
              unit: 'USD',
              sum: {
                dataPoints: [{
                  asDouble: 0.265,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: 'session.id', value: { stringValue: 'test-session-cost' } },
                    { key: 'model', value: { stringValue: 'claude-3-opus' } },
                  ],
                }],
              },
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result).toHaveProperty('partialSuccess')
    })
  })

  describe('Token Metrics', () => {
    test('processes token usage metrics', async () => {
      const metric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeMetrics: [{
            scope: { name: 'claude-code-telemetry' },
            metrics: [{
              name: 'claude_code.token.usage',
              description: 'Token count',
              unit: 'tokens',
              sum: {
                dataPoints: [{
                  asDouble: 1500,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: 'session.id', value: { stringValue: 'test-session-tokens' } },
                    { key: 'type', value: { stringValue: 'input' } },
                    { key: 'model', value: { stringValue: 'claude-3-opus' } },
                  ],
                }],
              },
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Code Modification Metrics', () => {
    test('processes lines of code added metric', async () => {
      const metric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeMetrics: [{
            scope: { name: 'claude-code-telemetry' },
            metrics: [{
              name: 'claude_code.lines_of_code.count',
              description: 'Lines of code',
              unit: 'lines',
              sum: {
                dataPoints: [{
                  asDouble: 42,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: 'session.id', value: { stringValue: 'test-session-lines' } },
                    { key: 'type', value: { stringValue: 'added' } },
                  ],
                }],
              },
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })

      expect(response.status).toBe(200)
    })

    test('processes lines of code removed metric', async () => {
      const metric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeMetrics: [{
            scope: { name: 'claude-code-telemetry' },
            metrics: [{
              name: 'claude_code.lines_of_code.count',
              description: 'Lines of code',
              unit: 'lines',
              sum: {
                dataPoints: [{
                  asDouble: 15,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: 'session.id', value: { stringValue: 'test-session-lines' } },
                    { key: 'type', value: { stringValue: 'removed' } },
                  ],
                }],
              },
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Git Metrics', () => {
    test('processes commit count metric', async () => {
      const metric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeMetrics: [{
            scope: { name: 'claude-code-telemetry' },
            metrics: [{
              name: 'claude_code.commit.count',
              description: 'Git commits',
              unit: 'commits',
              sum: {
                dataPoints: [{
                  asInt: '1',
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: 'session.id', value: { stringValue: 'test-session-git' } },
                  ],
                }],
              },
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Tool Decision Metrics', () => {
    test('processes code edit tool decision metric', async () => {
      const metric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeMetrics: [{
            scope: { name: 'claude-code-telemetry' },
            metrics: [{
              name: 'claude_code.code_edit_tool.decision',
              description: 'Tool permission decisions',
              unit: 'decisions',
              gauge: {
                dataPoints: [{
                  asInt: '1',
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: 'session.id', value: { stringValue: 'test-session-tool' } },
                    { key: 'decision', value: { stringValue: 'accept' } },
                    { key: 'tool', value: { stringValue: 'Write' } },
                    { key: 'language', value: { stringValue: 'javascript' } },
                  ],
                }],
              },
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Session Metrics', () => {
    test('processes session count metric', async () => {
      const metric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeMetrics: [{
            scope: { name: 'claude-code-telemetry' },
            metrics: [{
              name: 'claude_code.session.count',
              description: 'Session starts',
              unit: 'sessions',
              sum: {
                dataPoints: [{
                  asInt: '1',
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: 'session.id', value: { stringValue: 'test-session-start' } },
                  ],
                }],
              },
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Active Time Metrics', () => {
    test('processes active time total metric', async () => {
      const metric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeMetrics: [{
            scope: { name: 'claude-code-telemetry' },
            metrics: [{
              name: 'claude_code.active_time.total',
              description: 'Active usage time',
              unit: 'seconds',
              sum: {
                dataPoints: [{
                  asDouble: 300.5,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: 'session.id', value: { stringValue: 'test-session-time' } },
                  ],
                }],
              },
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Error Handling', () => {
    test('handles metrics without session ID gracefully', async () => {
      const metric = {
        resourceMetrics: [{
          resource: {
            attributes: [],
          },
          scopeMetrics: [{
            scope: { name: 'claude-code-telemetry' },
            metrics: [{
              name: 'claude_code.cost.usage',
              sum: {
                dataPoints: [{
                  asDouble: 0.1,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [], // No session ID
                }],
              },
            }],
          }],
        }],
      }

      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })

      expect(response.status).toBe(200)
    })

    test('handles malformed metrics', async () => {
      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"invalid": "metric"}',
      })

      expect(response.status).toBe(200) // Still returns 200 with partialSuccess
    })
  })
})
