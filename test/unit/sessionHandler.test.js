// Mock dependencies before requiring the module
jest.mock('pino', () => () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({
    trace: jest.fn(() => ({
      update: jest.fn(),
      event: jest.fn(),
      span: jest.fn(() => ({
        update: jest.fn(),
        end: jest.fn(),
        event: jest.fn(),
      })),
      score: jest.fn(),
    })),
    generation: jest.fn(() => ({
      update: jest.fn(),
      end: jest.fn(),
    })),
    flushAsync: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
  })),
}))

// Now require the module after mocks are set up
const { SessionHandler, extractAttributesArray } = require('../../src/sessionHandler')

describe('SessionHandler', () => {
  let session
  let mockLangfuseInstance

  beforeEach(() => {
    jest.clearAllMocks()

    // Create a mock Langfuse instance with all the methods we need
    mockLangfuseInstance = {
      trace: jest.fn(() => ({
        id: 'test-trace-id',
        update: jest.fn(),
        event: jest.fn(),
        span: jest.fn(() => ({
          update: jest.fn(),
          end: jest.fn(),
          event: jest.fn(),
        })),
        score: jest.fn(),
      })),
      generation: jest.fn(() => ({
        id: 'test-generation-id',
        update: jest.fn(),
        end: jest.fn(),
      })),
      event: jest.fn(),
      score: jest.fn(),
      flushAsync: jest.fn(() => Promise.resolve()),
    }

    session = new SessionHandler('test-session-id', {
      'service.name': 'test-service',
      'service.version': '1.0.0',
    }, mockLangfuseInstance)
  })

  describe('constructor', () => {
    test('initializes with correct properties', () => {
      expect(session.sessionId).toBe('test-session-id')
      expect(session.langfuse).toBe(mockLangfuseInstance)
      expect(session.totalCost).toBe(0)
      expect(session.totalTokens).toBe(0)
      expect(session.linesAdded).toBe(0)
      expect(session.linesRemoved).toBe(0)
      expect(session.metadata.service.name).toBe('test-service')
      expect(session.metadata.service.version).toBe('1.0.0')
    })

    test('throws error if sessionId is not provided', () => {
      expect(() => new SessionHandler(null, {}, mockLangfuseInstance)).toThrow('SessionHandler requires a sessionId')
    })
  })

  describe('processMetric', () => {
    test('processes cost usage metrics', () => {
      const metric = { name: 'claude_code.cost.usage' }
      const dataPoint = { asDouble: 0.25 }
      const attrs = { model: 'claude-3-opus' }

      session.processMetric(metric, dataPoint, attrs)

      expect(session.totalCost).toBe(0.25) // Cost is now tracked from metrics
    })

    test('processes token usage metrics', () => {
      const metric = { name: 'claude_code.token.usage' }
      const dataPoint = { asDouble: 1500 }
      const attrs = { type: 'input', model: 'claude-3-opus' }

      session.processMetric(metric, dataPoint, attrs)

      expect(session.totalTokens).toBe(1500) // Tokens are now tracked from metrics
    })

    test('processes lines of code metrics', () => {
      session.currentTrace = mockLangfuseInstance.trace()

      const metric = { name: 'claude_code.lines_of_code.count' }
      const dataPoint = { asDouble: 42 }
      const attrs = { type: 'added' }

      session.processMetric(metric, dataPoint, attrs)

      expect(session.linesAdded).toBe(42)
      expect(session.linesRemoved).toBe(0)
      expect(mockLangfuseInstance.event).toHaveBeenCalledWith({
        traceId: 'test-trace-id',
        name: 'code-modification',
        metadata: {
          lines: 42,
          type: 'added',
          timestamp: expect.any(String),
        },
        level: 'DEFAULT',
      })
    })

    test('processes lines removed metrics', () => {
      session.currentTrace = mockLangfuseInstance.trace()

      const metric = { name: 'claude_code.lines_of_code.count' }
      const dataPoint = { asDouble: 10 }
      const attrs = { type: 'removed' }

      session.processMetric(metric, dataPoint, attrs)

      expect(session.linesAdded).toBe(0)
      expect(session.linesRemoved).toBe(10)
    })

    test('processes session count metrics', () => {
      session.currentTrace = mockLangfuseInstance.trace()

      const metric = { name: 'claude_code.session.count' }
      const dataPoint = { asInt: 1 }
      const attrs = {}

      session.processMetric(metric, dataPoint, attrs)

      expect(session.langfuse.event).toHaveBeenCalledWith({
        name: 'session-started',
        traceId: 'test-trace-id',
        metadata: {
          count: 1,
          timestamp: expect.any(String),
        },
        level: 'DEFAULT',
      })
    })

    test('processes pull request count metrics', () => {
      session.currentTrace = mockLangfuseInstance.trace()

      const metric = { name: 'claude_code.pull_request.count' }
      const dataPoint = { asDouble: 1 }
      const attrs = {}

      session.processMetric(metric, dataPoint, attrs)

      expect(session.langfuse.event).toHaveBeenCalledWith({
        name: 'pull-request-created',
        traceId: 'test-trace-id',
        metadata: {
          count: 1,
          timestamp: expect.any(String),
        },
        level: 'DEFAULT',
      })
    })

    test('processes commit count metrics', () => {
      session.currentTrace = mockLangfuseInstance.trace()

      const metric = { name: 'claude_code.commit.count' }
      const dataPoint = { asInt: 2 }
      const attrs = {}

      session.processMetric(metric, dataPoint, attrs)

      expect(session.langfuse.event).toHaveBeenCalledWith({
        name: 'git-commit-created',
        traceId: 'test-trace-id',
        metadata: {
          count: 2,
          timestamp: expect.any(String),
        },
        level: 'DEFAULT',
      })
    })

    test('processes code edit tool decision metrics', () => {
      session.currentTrace = mockLangfuseInstance.trace()

      const metric = { name: 'claude_code.code_edit_tool.decision' }
      const dataPoint = {}
      const attrs = {
        decision: 'accept',
        tool: 'Write',
        language: 'javascript',
      }

      session.processMetric(metric, dataPoint, attrs)

      expect(session.langfuse.event).toHaveBeenCalledWith({
        name: 'tool-permission-decision',
        traceId: 'test-trace-id',
        metadata: {
          tool: 'Write',
          decision: 'accept',
          language: 'javascript',
          timestamp: expect.any(String),
        },
        level: 'DEFAULT',
      })
    })

    test('processes active time total metrics', () => {
      session.currentTrace = mockLangfuseInstance.trace()

      const metric = { name: 'claude_code.active_time.total' }
      const dataPoint = { asDouble: 300.5 }
      const attrs = {}

      session.processMetric(metric, dataPoint, attrs)

      expect(session.langfuse.event).toHaveBeenCalledWith({
        name: 'active-time-update',
        traceId: 'test-trace-id',
        metadata: {
          seconds: 300.5,
          timestamp: expect.any(String),
        },
        level: 'DEFAULT',
      })
    })

    test('handles unknown metrics gracefully', () => {
      const metric = { name: 'claude_code.unknown.metric' }
      const dataPoint = { asDouble: 123 }
      const attrs = { foo: 'bar' }

      // Should not throw
      expect(() => {
        session.processMetric(metric, dataPoint, attrs)
      }).not.toThrow()
    })
  })

  describe('handleApiError', () => {
    test('logs API errors and creates events', () => {
      session.currentTrace = mockLangfuseInstance.trace()

      const attrs = {
        model: 'claude-3-opus',
        error_message: 'Rate limit exceeded',
        status_code: 429,
      }
      const timestamp = '2024-07-31T10:00:00Z'

      session.handleApiError(attrs, timestamp)

      expect(session.langfuse.event).toHaveBeenCalledWith({
        name: 'api-error',
        traceId: 'test-trace-id',
        metadata: {
          model: 'claude-3-opus',
          error: 'Rate limit exceeded',
          statusCode: 429,
          timestamp: '2024-07-31T10:00:00Z',
        },
        level: 'ERROR',
      })
    })

    test('handles missing error message', () => {
      session.currentTrace = mockLangfuseInstance.trace()

      const attrs = {
        model: 'claude-3-opus',
        status: 500,
      }
      const timestamp = '2024-07-31T10:00:00Z'

      session.handleApiError(attrs, timestamp)

      expect(session.langfuse.event).toHaveBeenCalledWith({
        name: 'api-error',
        traceId: 'test-trace-id',
        metadata: {
          model: 'claude-3-opus',
          error: 'Unknown error',
          statusCode: 500,
          timestamp: '2024-07-31T10:00:00Z',
        },
        level: 'ERROR',
      })
    })

    test('handles API errors without current trace', () => {
      session.currentTrace = null

      const attrs = {
        error: 'Network error',
      }

      // Should not throw
      expect(() => {
        session.handleApiError(attrs, '2024-07-31T10:00:00Z')
      }).not.toThrow()
    })
  })

  describe('handleUserPrompt', () => {
    test('creates a new trace for conversation', () => {
      const attrs = {
        prompt: 'Hello, Claude!',
        prompt_length: 14,
        'user.email': 'test@example.com',
      }
      const timestamp = '2024-07-31T10:00:00Z'

      session.handleUserPrompt(attrs, timestamp)

      expect(session.conversationCount).toBe(1)
      expect(mockLangfuseInstance.trace).toHaveBeenCalledWith({
        name: 'conversation-1',
        sessionId: 'test-session-id',
        userId: 'test@example.com',
        input: {
          prompt: 'Hello, Claude!',
          length: 14,
        },
        metadata: expect.objectContaining({
          conversationIndex: 1,
        }),
        version: '1.0.0',
      })
    })
  })

  describe('handleApiRequest', () => {
    test('creates generation span for API requests', () => {
      session.currentTrace = mockLangfuseInstance.trace()

      const attrs = {
        model: 'claude-3-opus',
        input_tokens: 100,
        output_tokens: 200,
        cost: 0.05,
        cache_read_tokens: 50,
        'api.response_time': 1000,
      }
      const timestamp = '2024-07-31T10:00:00Z'

      session.handleApiRequest(attrs, timestamp)

      expect(session.totalCost).toBe(0.05)
      expect(session.totalTokens).toBe(300)
      expect(session.apiCallCount).toBe(1)
      expect(mockLangfuseInstance.generation).toHaveBeenCalled()
    })
  })

  describe('handleToolResult', () => {
    beforeEach(() => {
      session.currentTrace = mockLangfuseInstance.trace()
    })

    test('extracts tool_name correctly', () => {
      const attrs = {
        tool_name: 'Bash',
        success: 'true',
        duration_ms: '150',
      }
      const timestamp = '2024-07-31T10:00:00Z'

      session.handleToolResult(attrs, timestamp)

      expect(session.toolCallCount).toBe(1)
      expect(session.toolSequence).toHaveLength(1)
      expect(session.toolSequence[0]).toEqual({
        name: 'Bash',
        success: true,
        duration: 150,
        timestamp: '2024-07-31T10:00:00Z',
      })
      expect(session.langfuse.event).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'tool-Bash',
          traceId: 'test-trace-id',
          input: expect.objectContaining({
            toolName: 'Bash',
          }),
        }),
      )
    })

    test('falls back to "unknown" when tool_name is missing', () => {
      const attrs = {
        success: 'true',
        duration_ms: '100',
      }
      const timestamp = '2024-07-31T10:00:00Z'

      session.handleToolResult(attrs, timestamp)

      expect(session.toolSequence[0].name).toBe('unknown')
      expect(session.langfuse.event).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'tool-unknown',
          traceId: 'test-trace-id',
          input: expect.objectContaining({
            toolName: 'unknown',
          }),
        }),
      )
    })

    test('handles legacy tool attribute name', () => {
      const attrs = {
        tool: 'Write', // Legacy attribute name
        success: 'true',
        duration_ms: '200',
      }
      const timestamp = '2024-07-31T10:00:00Z'

      session.handleToolResult(attrs, timestamp)

      expect(session.toolSequence[0].name).toBe('Write')
    })

    test('extracts duration_ms correctly', () => {
      const attrs = {
        tool_name: 'Edit',
        success: 'true',
        duration_ms: '250',
      }
      const timestamp = '2024-07-31T10:00:00Z'

      session.handleToolResult(attrs, timestamp)

      expect(session.toolSequence[0].duration).toBe(250)
      expect(session.langfuse.event).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'test-trace-id',
          output: expect.objectContaining({
            durationMs: 250,
          }),
        }),
      )
    })

    test('handles missing duration_ms', () => {
      const attrs = {
        tool_name: 'Read',
        success: 'true',
        // duration_ms missing
      }
      const timestamp = '2024-07-31T10:00:00Z'

      session.handleToolResult(attrs, timestamp)

      expect(session.toolSequence[0].duration).toBe(0)
      expect(session.langfuse.event).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'test-trace-id',
          output: expect.objectContaining({
            durationMs: 0,
          }),
        }),
      )
    })

    test('parses success correctly', () => {
      const attrsSuccess = {
        tool_name: 'Grep',
        success: 'true',
        duration_ms: '50',
      }

      session.handleToolResult(attrsSuccess, '2024-07-31T10:00:00Z')
      expect(session.toolSequence[0].success).toBe(true)

      // Test failure case
      const attrsFail = {
        tool_name: 'WebFetch',
        success: false,
        duration_ms: '100',
      }

      session.handleToolResult(attrsFail, '2024-07-31T10:00:01Z')
      expect(session.toolSequence[1].success).toBe(false)
    })

    test('increments tool call count', () => {
      const attrs = {
        tool_name: 'TodoWrite',
        success: 'true',
        duration_ms: '30',
      }

      session.handleToolResult(attrs, '2024-07-31T10:00:00Z')
      expect(session.toolCallCount).toBe(1)

      session.handleToolResult(attrs, '2024-07-31T10:00:01Z')
      expect(session.toolCallCount).toBe(2)
    })

    test('tracks consecutive tool calls in sequence', () => {
      // First tool in sequence
      session.handleToolResult({
        tool_name: 'Read',
        success: 'true',
        duration_ms: '100',
      }, '2024-07-31T10:00:00Z')

      // Second tool in sequence
      session.handleToolResult({
        tool_name: 'Edit',
        success: 'true',
        duration_ms: '200',
      }, '2024-07-31T10:00:01Z')

      expect(session.toolSequence).toHaveLength(2)
      expect(session.toolSequence[0].name).toBe('Read')
      expect(session.toolSequence[1].name).toBe('Edit')
      expect(session.toolSequence[0].duration).toBe(100)
      expect(session.toolSequence[1].duration).toBe(200)

      // Tool sequence is reported during session finalization
      expect(session.toolCallCount).toBe(2)
    })
  })

  describe('processLogRecord', () => {
    test('processes user prompt event', () => {
      const logRecord = {
        body: { stringValue: 'claude_code.user_prompt' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [
          { key: 'prompt', value: { stringValue: 'test prompt' } },
          { key: 'user.email', value: { stringValue: 'test@example.com' } },
        ],
      }

      const initialCount = session.conversationCount
      session.processLogRecord(logRecord, {})

      expect(session.conversationCount).toBe(initialCount + 1)
      expect(mockLangfuseInstance.trace).toHaveBeenCalled()
    })

    test('processes api request event', () => {
      const logRecord = {
        body: { stringValue: 'claude_code.api_request' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [
          { key: 'model', value: { stringValue: 'claude-3-opus' } },
          { key: 'input_tokens', value: { stringValue: '100' } },
          { key: 'output_tokens', value: { stringValue: '200' } },
          { key: 'cost_usd', value: { stringValue: '0.1' } },
        ],
      }

      // Should not throw
      expect(() => session.processLogRecord(logRecord, {})).not.toThrow()
    })

    test('processes tool result event', () => {
      // First need to create a trace/span
      session.handleUserPrompt({ prompt: 'test' }, new Date().toISOString())

      const logRecord = {
        body: { stringValue: 'claude_code.tool_result' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [
          { key: 'tool_name', value: { stringValue: 'Bash' } },
          { key: 'success', value: { stringValue: 'true' } },
        ],
      }

      // Should not throw
      expect(() => session.processLogRecord(logRecord, {})).not.toThrow()
    })

    test('processes api error event', () => {
      const logRecord = {
        body: { stringValue: 'claude_code.api_error' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [
          { key: 'error_message', value: { stringValue: 'Rate limit' } },
          { key: 'status_code', value: { stringValue: '429' } },
        ],
      }

      // Should not throw
      expect(() => session.processLogRecord(logRecord, {})).not.toThrow()
    })

    test('ignores unknown event', () => {
      const logRecord = {
        body: { stringValue: 'unknown_event' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [],
      }

      // Should not throw
      expect(() => session.processLogRecord(logRecord, {})).not.toThrow()
    })
  })

  describe('finalize', () => {
    test('calculates session metrics correctly', async () => {
      // Set up session data
      session.totalCost = 0.5
      session.totalTokens = 2000
      session.apiCallCount = 3
      session.toolCallCount = 5
      session.conversationCount = 2
      session.linesAdded = 100
      session.linesRemoved = 20

      await session.finalize()

      expect(mockLangfuseInstance.trace).toHaveBeenCalledWith({
        name: 'session-summary',
        sessionId: 'test-session-id',
        userId: expect.any(String),
        version: '1.0.0',
        input: expect.objectContaining({
          sessionStart: expect.any(String),
          metadata: expect.objectContaining({
            service: {
              name: 'test-service',
              version: '1.0.0',
            },
          }),
        }),
        output: expect.objectContaining({
          conversationCount: 2,
          apiCallCount: 3,
          toolCallCount: 5,
          totalCost: 0.5,
          totalTokens: 2000,
          codeChanges: {
            linesAdded: 100,
            linesRemoved: 20,
            netChange: 80,
          },
        }),
        metadata: expect.any(Object),
      })

      expect(mockLangfuseInstance.flushAsync).toHaveBeenCalled()
    })

    test('closes current span if exists', async () => {
      // Create a mock span
      const mockSpan = {
        end: jest.fn(),
      }
      session.currentSpan = mockSpan
      session.toolSequence = [
        { name: 'Read', success: true, duration: 100 },
        { name: 'Edit', success: false, duration: 200 },
      ]

      await session.finalize()

      expect(mockSpan.end).toHaveBeenCalledWith({
        output: {
          toolCount: 2,
          tools: 'Read:true, Edit:false',
          totalDuration: 300,
        },
      })
      expect(session.currentSpan).toBeNull()
    })

    test('updates current trace if exists', async () => {
      // Create a mock trace
      const mockTrace = {
        update: jest.fn(),
      }
      session.currentTrace = mockTrace
      session.conversationStartTime = Date.now() - 5000 // 5 seconds ago

      await session.finalize()

      expect(mockTrace.update).toHaveBeenCalledWith({
        output: {
          status: 'session_ended',
          duration: expect.any(Number),
        },
      })
      expect(session.latencies.conversation).toHaveLength(1)
      expect(session.latencies.conversation[0]).toBeGreaterThan(4000)
    })

    test('handles empty latency arrays', async () => {
      // Leave latency arrays empty
      session.latencies = {
        api: [],
        tool: [],
        conversation: [],
      }

      await session.finalize()

      const traceCall = mockLangfuseInstance.trace.mock.calls[0][0]
      expect(traceCall.output.performance.api).toBeNull()
      expect(traceCall.output.performance.tool).toBeNull()
      expect(traceCall.output.performance.conversation).toBeNull()
    })

    test('handles errors during finalization', async () => {
      // Make flushAsync throw an error
      mockLangfuseInstance.flushAsync.mockRejectedValue(new Error('Network error'))

      session.totalCost = 0.5
      session.totalTokens = 1000

      // Should not throw
      await expect(session.finalize()).resolves.not.toThrow()

      // Should still attempt to create the trace
      expect(mockLangfuseInstance.trace).toHaveBeenCalled()
    })
  })
})

describe('Helper Functions', () => {
  describe('extractAttributesArray', () => {
    test('extracts string attributes', () => {
      const attributes = [
        { key: 'name', value: { stringValue: 'test' } },
      ]
      const result = extractAttributesArray(attributes)
      expect(result).toEqual({ name: 'test' })
    })

    test('extracts numeric attributes', () => {
      const attributes = [
        { key: 'count', value: { intValue: '42' } },
        { key: 'rate', value: { doubleValue: 3.14 } },
      ]
      const result = extractAttributesArray(attributes)
      expect(result).toEqual({ count: 42, rate: 3.14 })
    })

    test('handles null attributes', () => {
      const result = extractAttributesArray(null)
      expect(result).toEqual({})
    })

    test('extracts array attributes', () => {
      const attributes = [
        {
          key: 'items',
          value: {
            arrayValue: {
              values: [
                { stringValue: 'item1' },
                { stringValue: 'item2' },
              ],
            },
          },
        },
      ]

      const result = extractAttributesArray(attributes)
      expect(result).toEqual({ items: ['item1', 'item2'] })
    })

    test('extracts kvlist attributes', () => {
      const attributes = [
        {
          key: 'metadata',
          value: {
            kvlistValue: {
              values: [
                { key: 'name', value: { stringValue: 'test' } },
                { key: 'count', value: { intValue: '5' } },
              ],
            },
          },
        },
      ]

      const result = extractAttributesArray(attributes)
      expect(result).toEqual({
        metadata: {
          name: 'test',
          count: 5,
        },
      })
    })

    test('extracts boolean attributes', () => {
      const attributes = [
        { key: 'enabled', value: { boolValue: true } },
        { key: 'disabled', value: { boolValue: false } },
      ]

      const result = extractAttributesArray(attributes)
      expect(result).toEqual({ enabled: true, disabled: false })
    })

    test('handles unknown value types', () => {
      const attributes = [
        { key: 'unknown', value: { unknownType: 'value' } },
      ]

      const result = extractAttributesArray(attributes)
      expect(result).toEqual({ unknown: null })
    })
  })
})
