const {
  processMetric,
  processCostMetric,
  processTokenMetric,
  processLinesOfCodeMetric,
  processCommitMetric,
  processToolDecisionMetric,
  processSessionMetric,
  processActiveTimeMetric,
  processPullRequestMetric,
} = require('../../src/metricsProcessor')

describe('Metrics Processor', () => {
  let mockSession

  beforeEach(() => {
    mockSession = {
      sessionId: 'test-session-123',
      totalCost: 0,
      totalTokens: 0,
      linesAdded: 0,
      linesRemoved: 0,
      commitCount: 0,
      prCount: 0,
      activeTime: 0,
      processMetric: jest.fn(), // Mock the processMetric method
    }
  })

  describe('processMetric', () => {
    test('processes cost usage metric', () => {
      const metric = { name: 'claude_code.cost.usage' }
      const dataPoint = {
        asDouble: 0.15,
        timeUnixNano: Date.now() * 1000000,
      }
      const attrs = { model: 'claude-3-opus' }

      const result = processMetric(metric, dataPoint, attrs, mockSession)

      expect(result).toEqual({
        type: 'cost',
        cost: 0.15,
        model: 'claude-3-opus',
        timestamp: expect.any(Number),
      })
      expect(mockSession.processMetric).toHaveBeenCalledWith(metric, dataPoint, attrs)
    })

    test('processes token usage metric', () => {
      const metric = { name: 'claude_code.token.usage' }
      const dataPoint = {
        asDouble: 250,
        timeUnixNano: Date.now() * 1000000,
      }
      const attrs = { type: 'input', model: 'claude-3-haiku' }

      const result = processMetric(metric, dataPoint, attrs, mockSession)

      expect(result.type).toBe('token')
      expect(result.tokens).toBe(250)
      expect(mockSession.processMetric).toHaveBeenCalled()
    })

    test('processes lines of code metric', () => {
      const metric = { name: 'claude_code.lines_of_code.count' }
      const dataPoint = {
        asDouble: 50,
        timeUnixNano: Date.now() * 1000000,
      }
      const attrs = { type: 'added' }

      const result = processMetric(metric, dataPoint, attrs, mockSession)

      expect(result.type).toBe('lines_of_code')
      expect(result.lines).toBe(50)
      expect(mockSession.processMetric).toHaveBeenCalled()
    })

    test('processes commit count metric', () => {
      const metric = { name: 'claude_code.commit.count' }
      const dataPoint = {
        asDouble: 3,
        timeUnixNano: Date.now() * 1000000,
      }
      const attrs = {}

      const result = processMetric(metric, dataPoint, attrs, mockSession)

      expect(result.type).toBe('commit')
      expect(result.commits).toBe(3)
      expect(mockSession.processMetric).toHaveBeenCalled()
    })

    test('processes tool decision metric', () => {
      const metric = { name: 'claude_code.code_edit_tool.decision' }
      const dataPoint = {
        timeUnixNano: Date.now() * 1000000,
      }
      const attrs = { decision: 'accept', tool: 'Edit' }

      const result = processMetric(metric, dataPoint, attrs, mockSession)

      expect(result.type).toBe('tool_decision')
      expect(result.decision).toBe('accept')
      expect(mockSession.processMetric).toHaveBeenCalled()
    })

    test('processes session count metric', () => {
      const metric = { name: 'claude_code.session.count' }
      const dataPoint = {
        timeUnixNano: Date.now() * 1000000,
      }
      const attrs = {}

      const result = processMetric(metric, dataPoint, attrs, mockSession)

      expect(result.type).toBe('session_start')
      expect(mockSession.processMetric).toHaveBeenCalled()
    })

    test('processes active time metric', () => {
      const metric = { name: 'claude_code.active_time.total' }
      const dataPoint = {
        asDouble: 120.5,
        timeUnixNano: Date.now() * 1000000,
      }
      const attrs = {}

      const result = processMetric(metric, dataPoint, attrs, mockSession)

      expect(result.type).toBe('active_time')
      expect(result.activeTime).toBe(120.5)
      expect(mockSession.processMetric).toHaveBeenCalled()
    })

    test('processes pull request metric', () => {
      const metric = { name: 'claude_code.pr.count' }
      const dataPoint = {
        asDouble: 2,
        timeUnixNano: Date.now() * 1000000,
      }
      const attrs = {}

      const result = processMetric(metric, dataPoint, attrs, mockSession)

      expect(result.type).toBe('pull_request')
      expect(result.prCount).toBe(2)
      expect(mockSession.processMetric).toHaveBeenCalled()
    })

    test('processes unknown metric', () => {
      const metric = { name: 'unknown.metric' }
      const dataPoint = { timeUnixNano: Date.now() * 1000000 }
      const attrs = {}

      const result = processMetric(metric, dataPoint, attrs, mockSession)

      expect(result).toBeNull()
    })
  })

  describe('processCostMetric', () => {
    test('processes cost with model', () => {
      const dataPoint = { asDouble: 0.25 }
      const attrs = { model: 'claude-3-sonnet' }
      const timestamp = Date.now()

      const result = processCostMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result).toEqual({
        type: 'cost',
        cost: 0.25,
        model: 'claude-3-sonnet',
        timestamp,
      })
    })

    test('handles missing cost value', () => {
      const dataPoint = {}
      const attrs = {}
      const timestamp = Date.now()

      const result = processCostMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result.cost).toBe(0)
      expect(result.model).toBe('unknown')
    })
  })

  describe('processTokenMetric', () => {
    test('processes input tokens', () => {
      const dataPoint = { asDouble: 500 }
      const attrs = { type: 'input', model: 'claude-3-opus' }
      const timestamp = Date.now()

      const result = processTokenMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result).toEqual({
        type: 'token',
        tokens: 500,
        tokenType: 'input',
        model: 'claude-3-opus',
        timestamp,
      })
    })

    test('processes output tokens', () => {
      const dataPoint = { asDouble: 1000 }
      const attrs = { type: 'output', model: 'claude-3-haiku' }
      const timestamp = Date.now()

      const result = processTokenMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result.tokenType).toBe('output')
    })

    test('handles unknown token type', () => {
      const dataPoint = { asDouble: 100 }
      const attrs = { type: 'unknown' }
      const timestamp = Date.now()

      const result = processTokenMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result.tokenType).toBe('unknown')
    })
  })

  describe('processLinesOfCodeMetric', () => {
    test('processes lines added', () => {
      const dataPoint = { asDouble: 42 }
      const attrs = { type: 'added' }
      const timestamp = Date.now()

      const result = processLinesOfCodeMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result).toEqual({
        type: 'lines_of_code',
        lines: 42,
        changeType: 'added',
        timestamp,
      })
    })

    test('processes lines removed', () => {
      const dataPoint = { asDouble: 15 }
      const attrs = { type: 'removed' }
      const timestamp = Date.now()

      const result = processLinesOfCodeMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result.changeType).toBe('removed')
    })

    test('handles unknown change type', () => {
      const dataPoint = { asDouble: 20 }
      const attrs = { type: 'modified' } // Not 'added' or 'removed'
      const timestamp = Date.now()

      const result = processLinesOfCodeMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result).toEqual({
        type: 'lines_of_code',
        lines: 20,
        changeType: 'modified',
        timestamp,
      })
      // Lines tracking now handled by session.processMetric
    })

    test('handles missing type attribute', () => {
      const dataPoint = { asDouble: 10 }
      const attrs = {} // No type
      const timestamp = Date.now()

      const result = processLinesOfCodeMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result.changeType).toBe('unknown')
      // Lines tracking now handled by session.processMetric
    })
  })

  describe('processCommitMetric', () => {
    test('processes commit count', () => {
      const dataPoint = { asInt: '2' }
      const attrs = {}
      const timestamp = Date.now()

      const result = processCommitMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result).toEqual({
        type: 'commit',
        commits: 2,
        timestamp,
      })
    })

    test('handles missing commit count', () => {
      const dataPoint = {}
      const attrs = {}
      const timestamp = Date.now()

      const result = processCommitMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result.commits).toBe(0)
    })
  })

  describe('processToolDecisionMetric', () => {
    test('processes tool decision', () => {
      const dataPoint = {}
      const attrs = {
        decision: 'accept',
        tool: 'Write',
        language: 'javascript',
      }
      const timestamp = Date.now()

      const result = processToolDecisionMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result).toEqual({
        type: 'tool_decision',
        decision: 'accept',
        tool: 'Write',
        language: 'javascript',
        count: 1,
        timestamp,
      })
      // Tool decisions now tracked by session.processMetric
    })

    test('initializes toolDecisions array if missing', () => {
      const dataPoint = {}
      const attrs = { decision: 'reject' }
      const timestamp = Date.now()

      // Initial state verification removed - handled by session.processMetric

      processToolDecisionMetric(dataPoint, attrs, timestamp, mockSession)

      // Tool decisions now tracked by session.processMetric
    })
  })

  describe('processSessionMetric', () => {
    test('marks session as started', () => {
      const dataPoint = {}
      const attrs = {}
      const timestamp = Date.now()

      const result = processSessionMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result).toEqual({
        type: 'session_start',
        timestamp,
      })
    })
  })

  describe('processActiveTimeMetric', () => {
    test('processes active time', () => {
      const dataPoint = { asDouble: 300.5 }
      const attrs = {}
      const timestamp = Date.now()

      const result = processActiveTimeMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result).toEqual({
        type: 'active_time',
        activeTime: 300.5,
        timestamp,
      })
    })

    test('handles missing active time', () => {
      const dataPoint = {}
      const attrs = {}
      const timestamp = Date.now()

      const result = processActiveTimeMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result.activeTime).toBe(0)
    })
  })

  describe('processPullRequestMetric', () => {
    test('processes PR count', () => {
      const dataPoint = { asInt: '3' }
      const attrs = {}
      const timestamp = Date.now()

      const result = processPullRequestMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result).toEqual({
        type: 'pull_request',
        prCount: 3,
        timestamp,
      })
    })

    test('accumulates PR count', () => {
      mockSession.prCount = 2
      const dataPoint = { asInt: '1' }
      const attrs = {}
      const timestamp = Date.now()

      const result = processPullRequestMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result.prCount).toBe(1)
      // Total tracking handled by session.processMetric
    })

    test('initializes PR count if missing', () => {
      delete mockSession.prCount
      const dataPoint = { asInt: '1' }
      const attrs = {}
      const timestamp = Date.now()

      const result = processPullRequestMetric(dataPoint, attrs, timestamp, mockSession)

      expect(result.prCount).toBe(1)
    })
  })
})
