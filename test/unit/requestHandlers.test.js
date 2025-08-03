// Mock dependencies before importing
jest.mock('../../src/sessionHandler', () => ({
  SessionHandler: jest.fn().mockImplementation((sessionId) => ({
    sessionId,
    addPrompt: jest.fn(),
    handleApiRequest: jest.fn(),
    handleApiError: jest.fn(),
    handleToolResult: jest.fn(),
  })),
  extractAttributesArray: jest.fn((attrs) => {
    const result = {}
    if (attrs) {
      attrs.forEach(attr => {
        result[attr.key] = attr.value.stringValue || attr.value.intValue || attr.value.doubleValue
      })
    }
    return result
  }),
}))

jest.mock('../../src/eventProcessor', () => ({
  processEvent: jest.fn(),
}))

jest.mock('../../src/metricsProcessor', () => ({
  processMetric: jest.fn(),
}))

const {
  handleTraces,
  handleMetrics,
  handleLogs,
  handleHealthCheck,
} = require('../../src/requestHandlers')

describe('Request Handlers', () => {
  let mockRes
  let mockSessions
  let mockLangfuse

  beforeEach(() => {
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn(),
    }
    mockSessions = new Map()
    mockLangfuse = {
      trace: jest.fn(),
      span: jest.fn(),
    }
  })

  describe('handleTraces', () => {
    test('accepts valid traces payload', () => {
      const data = JSON.stringify({
        resourceSpans: [{
          resource: {
            attributes: [],
          },
          scopeSpans: [],
        }],
      })

      handleTraces(data, mockRes, mockSessions, mockLangfuse)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ partialSuccess: {} }))
    })

    test('returns 400 for invalid JSON', () => {
      const data = 'invalid json'

      handleTraces(data, mockRes, mockSessions, mockLangfuse)

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' })
      expect(mockRes.end).toHaveBeenCalled()
      const errorResponse = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(errorResponse.error).toBe('Invalid JSON')
    })
  })

  describe('handleMetrics', () => {
    test('processes metrics with session', () => {
      const { processMetric } = require('../../src/metricsProcessor')
      const { SessionHandler } = require('../../src/sessionHandler')

      const data = JSON.stringify({
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeMetrics: [{
            metrics: [{
              name: 'claude_code.cost.usage',
              sum: {
                dataPoints: [{
                  asDouble: 0.15,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: 'session.id', value: { stringValue: 'test-session' } },
                    { key: 'model', value: { stringValue: 'claude-3-opus' } },
                  ],
                }],
              },
            }],
          }],
        }],
      })

      handleMetrics(data, mockRes, mockSessions, mockLangfuse)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ partialSuccess: {} }))
      expect(mockSessions.size).toBe(1)
      expect(mockSessions.has('test-session')).toBe(true)
      expect(SessionHandler).toHaveBeenCalledWith('test-session', expect.any(Object), mockLangfuse)
      expect(processMetric).toHaveBeenCalled()
    })

    test('handles metrics without session ID', () => {
      const data = JSON.stringify({
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{
            metrics: [{
              name: 'claude_code.cost.usage',
              sum: {
                dataPoints: [{
                  asDouble: 0.1,
                  attributes: [],
                }],
              },
            }],
          }],
        }],
      })

      handleMetrics(data, mockRes, mockSessions, mockLangfuse)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      expect(mockSessions.size).toBe(0)
    })

    test('logs metrics payload in debug mode', () => {
      const originalLevel = process.env.LOG_LEVEL
      process.env.LOG_LEVEL = 'debug'

      const data = JSON.stringify({
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{
            metrics: [{
              name: 'test.metric',
              gauge: {
                dataPoints: [{
                  asDouble: 42,
                  attributes: [],
                }],
              },
            }],
          }],
        }],
      })

      handleMetrics(data, mockRes, mockSessions, mockLangfuse)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })

      process.env.LOG_LEVEL = originalLevel
    })

    test('returns 400 for invalid JSON', () => {
      const data = '{'

      handleMetrics(data, mockRes, mockSessions, mockLangfuse)

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' })
      expect(mockRes.end).toHaveBeenCalled()
      const errorResponse = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(errorResponse.error).toMatch(/JSON/)
    })
  })

  describe('handleLogs', () => {
    test('processes logs with session ID', () => {
      const data = JSON.stringify({
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeLogs: [{
            logRecords: [{
              timeUnixNano: Date.now() * 1000000,
              body: { stringValue: 'claude_code.user_prompt' },
              attributes: [
                { key: 'session.id', value: { stringValue: 'test-session' } },
                { key: 'prompt', value: { stringValue: 'Test prompt' } },
              ],
            }],
          }],
        }],
      })

      handleLogs(data, mockRes, mockSessions, mockLangfuse)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ partialSuccess: {} }))
      expect(mockSessions.size).toBe(1)
      expect(mockSessions.has('test-session')).toBe(true)
    })

    test('creates session from user ID and timestamp', () => {
      const data = JSON.stringify({
        resourceLogs: [{
          resource: { attributes: [] },
          scopeLogs: [{
            logRecords: [{
              timeUnixNano: Date.now() * 1000000,
              body: { stringValue: 'claude_code.user_prompt' },
              attributes: [
                { key: 'user.email', value: { stringValue: 'test@example.com' } },
                { key: 'event.timestamp', value: { stringValue: '2024-01-01T12:00:00Z' } },
              ],
            }],
          }],
        }],
      })

      handleLogs(data, mockRes, mockSessions, mockLangfuse)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      expect(mockSessions.size).toBe(1)
      const sessionId = Array.from(mockSessions.keys())[0]
      expect(sessionId).toMatch(/test-example-com-2024-01-01T12/)
    })

    test('logs without session are ignored', () => {
      const data = JSON.stringify({
        resourceLogs: [{
          resource: { attributes: [] },
          scopeLogs: [{
            logRecords: [{
              timeUnixNano: Date.now() * 1000000,
              body: { stringValue: 'test log' },
              attributes: [],
            }],
          }],
        }],
      })

      handleLogs(data, mockRes, mockSessions, mockLangfuse)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      expect(mockSessions.size).toBe(0)
    })

    test('returns 400 for invalid JSON', () => {
      const data = 'not json'

      handleLogs(data, mockRes, mockSessions, mockLangfuse)

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' })
      expect(mockRes.end).toHaveBeenCalled()
      const errorResponse = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(errorResponse.error).toMatch(/json/i)
    })
  })

  describe('handleHealthCheck', () => {
    test('returns health status', () => {
      const serverStartTime = Date.now() - 60000 // 1 minute ago
      const requestCount = 100
      const errorCount = 2

      handleHealthCheck(mockRes, serverStartTime, mockSessions, requestCount, errorCount)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })

      const response = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(response).toMatchObject({
        status: 'healthy',
        uptime: expect.any(Number),
        sessions: 0,
        requestCount: 100,
        errorCount: 2,
        langfuse: 'connected',
      })
      expect(response.uptime).toBeGreaterThan(50000) // At least 50 seconds
    })

    test('includes active session count', () => {
      mockSessions.set('session-1', {})
      mockSessions.set('session-2', {})

      const serverStartTime = Date.now()
      const requestCount = 50
      const errorCount = 0

      handleHealthCheck(mockRes, serverStartTime, mockSessions, requestCount, errorCount)

      const response = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(response.sessions).toBe(2)
    })
  })
})
