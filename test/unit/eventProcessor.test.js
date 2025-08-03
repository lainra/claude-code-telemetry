// Mock dependencies before requiring the module
jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({
    trace: jest.fn(),
    generation: jest.fn(),
    event: jest.fn(),
    flushAsync: jest.fn(() => Promise.resolve()),
  })),
}))

jest.mock('../../src/sessionHandler', () => ({
  SessionHandler: jest.fn().mockImplementation(() => ({
    sessionId: 'test-session-123',
    handleUserPrompt: jest.fn(),
    handleApiRequest: jest.fn(),
    handleApiError: jest.fn(),
    handleToolResult: jest.fn(),
    handleToolDecision: jest.fn(),
  })),
  extractAttributesArray: (attrs) => {
    // Simple implementation for testing
    const result = {}
    if (attrs && Array.isArray(attrs)) {
      attrs.forEach(attr => {
        const key = attr.key
        const value = attr.value?.stringValue ||
                     attr.value?.intValue ||
                     attr.value?.doubleValue ||
                     attr.value?.boolValue
        if (key && value !== undefined) {
          result[key] = value
        }
      })
    }
    return result
  },
}))

const { processEvent } = require('../../src/eventProcessor')

describe('Event Processor', () => {
  let mockSession

  beforeEach(() => {
    mockSession = {
      sessionId: 'test-session-123',
      userEmail: null,
      handleUserPrompt: jest.fn(),
      handleApiRequest: jest.fn(),
      handleApiError: jest.fn(),
      handleToolResult: jest.fn(),
      handleToolDecision: jest.fn(),
    }
  })

  describe('processEvent', () => {
    test('processes user prompt event', () => {
      const logRecord = {
        body: { stringValue: 'claude_code.user_prompt' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [
          { key: 'prompt_length', value: { stringValue: '42' } },
          { key: 'prompt', value: { stringValue: 'Test prompt' } },
          { key: 'session.id', value: { stringValue: 'test-session-123' } },
          { key: 'organization.id', value: { stringValue: 'org-123' } },
          { key: 'user.account_uuid', value: { stringValue: 'user-123' } },
          { key: 'user.email', value: { stringValue: 'test@example.com' } },
          { key: 'terminal.type', value: { stringValue: 'vscode' } },
          { key: 'app.version', value: { stringValue: '1.0.0' } },
        ],
      }

      const resource = {} // Resource is typically empty in tests

      const result = processEvent(logRecord, resource, mockSession)

      expect(result).toEqual({
        type: 'user_prompt',
        prompt: 'Test prompt',
        promptLength: 42,
        sessionId: 'test-session-123',
        organizationId: 'org-123',
        userAccountUuid: 'user-123',
        userEmail: 'test@example.com',
        terminalType: 'vscode',
        appVersion: '1.0.0',
        timestamp: expect.any(String),
      })
      expect(mockSession.handleUserPrompt).toHaveBeenCalled()
    })

    test('processes api request event', () => {
      const logRecord = {
        body: { stringValue: 'claude_code.api_request' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [
          { key: 'model', value: { stringValue: 'claude-3-opus' } },
          { key: 'input_tokens', value: { stringValue: '100' } },
          { key: 'output_tokens', value: { stringValue: '200' } },
          { key: 'cost_usd', value: { stringValue: '0.15' } },
          { key: 'duration_ms', value: { stringValue: '1500' } },
          { key: 'session.id', value: { stringValue: 'test-session-123' } },
          { key: 'organization.id', value: { stringValue: 'org-123' } },
          { key: 'user.account_uuid', value: { stringValue: 'user-123' } },
          { key: 'user.email', value: { stringValue: 'test@example.com' } },
          { key: 'terminal.type', value: { stringValue: 'vscode' } },
          { key: 'app.version', value: { stringValue: '1.0.0' } },
        ],
      }

      const resource = {}

      const result = processEvent(logRecord, resource, mockSession)

      expect(result).toEqual({
        type: 'api_request',
        model: 'claude-3-opus',
        inputTokens: 100,
        outputTokens: 200,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0.15,
        durationMs: 1500,
        requestId: undefined,
        sessionId: 'test-session-123',
        organizationId: 'org-123',
        userAccountUuid: 'user-123',
        userEmail: 'test@example.com',
        terminalType: 'vscode',
        appVersion: '1.0.0',
        timestamp: expect.any(String),
      })
      expect(mockSession.handleApiRequest).toHaveBeenCalled()
    })

    test('processes unknown event', () => {
      const logRecord = {
        body: { stringValue: 'unknown_event' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [],
      }

      const resource = {}

      const result = processEvent(logRecord, resource, mockSession)

      expect(result).toBeNull()
    })

    test('processes api error event', () => {
      const logRecord = {
        body: { stringValue: 'claude_code.api_error' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [
          { key: 'error_message', value: { stringValue: 'Rate limit' } },
          { key: 'status_code', value: { stringValue: '429' } },
          { key: 'session.id', value: { stringValue: 'test-session-123' } },
          { key: 'organization.id', value: { stringValue: 'org-123' } },
          { key: 'user.account_uuid', value: { stringValue: 'user-123' } },
          { key: 'user.email', value: { stringValue: 'test@example.com' } },
          { key: 'terminal.type', value: { stringValue: 'vscode' } },
          { key: 'app.version', value: { stringValue: '1.0.0' } },
        ],
      }

      const resource = {}

      const result = processEvent(logRecord, resource, mockSession)

      expect(result).toEqual({
        type: 'api_error',
        errorMessage: 'Rate limit',
        statusCode: 429,
        model: 'unknown',
        requestId: undefined,
        sessionId: 'test-session-123',
        organizationId: 'org-123',
        userAccountUuid: 'user-123',
        userEmail: 'test@example.com',
        terminalType: 'vscode',
        appVersion: '1.0.0',
        timestamp: expect.any(String),
      })
      expect(mockSession.handleApiError).toHaveBeenCalled()
    })

    test('processes tool result event', () => {
      const logRecord = {
        body: { stringValue: 'claude_code.tool_result' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [
          { key: 'tool_name', value: { stringValue: 'Bash' } },
          { key: 'success', value: { stringValue: 'true' } },
          { key: 'session.id', value: { stringValue: 'test-session-123' } },
          { key: 'organization.id', value: { stringValue: 'org-123' } },
          { key: 'user.account_uuid', value: { stringValue: 'user-123' } },
          { key: 'user.email', value: { stringValue: 'test@example.com' } },
          { key: 'terminal.type', value: { stringValue: 'vscode' } },
          { key: 'app.version', value: { stringValue: '1.0.0' } },
        ],
      }

      const resource = {}

      const result = processEvent(logRecord, resource, mockSession)

      expect(result).toEqual({
        type: 'tool_result',
        toolName: 'Bash',
        success: true,
        durationMs: 0,
        sessionId: 'test-session-123',
        organizationId: 'org-123',
        userAccountUuid: 'user-123',
        userEmail: 'test@example.com',
        terminalType: 'vscode',
        appVersion: '1.0.0',
        timestamp: expect.any(String),
      })
      expect(mockSession.handleToolResult).toHaveBeenCalled()
    })

    test('handles empty standard attributes', () => {
      const logRecord = {
        body: { stringValue: 'claude_code.user_prompt' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [
          { key: 'prompt_length', value: { stringValue: '10' } },
        ],
      }

      const resource = {}

      const result = processEvent(logRecord, resource, mockSession)

      expect(result).toEqual({
        type: 'user_prompt',
        prompt: '',
        promptLength: 10,
        sessionId: 'test-session-123', // Falls back to session.sessionId
        organizationId: undefined,
        userAccountUuid: undefined,
        userEmail: undefined,
        terminalType: undefined,
        appVersion: undefined,
        timestamp: expect.any(String),
      })
    })

    test('processes tool decision event', () => {
      const logRecord = {
        body: { stringValue: 'claude_code.tool_decision' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [
          { key: 'tool_name', value: { stringValue: 'Edit' } },
          { key: 'decision', value: { stringValue: 'accept' } },
          { key: 'source', value: { stringValue: 'user' } },
          { key: 'session.id', value: { stringValue: 'test-session-123' } },
          { key: 'organization.id', value: { stringValue: 'org-123' } },
          { key: 'user.account_uuid', value: { stringValue: 'user-123' } },
          { key: 'user.email', value: { stringValue: 'test@example.com' } },
          { key: 'terminal.type', value: { stringValue: 'vscode' } },
          { key: 'app.version', value: { stringValue: '1.0.0' } },
        ],
      }

      const resource = {}

      const result = processEvent(logRecord, resource, mockSession)

      expect(result).toEqual({
        type: 'tool_decision',
        toolName: 'Edit',
        decision: 'accept',
        source: 'user',
        sessionId: 'test-session-123',
        organizationId: 'org-123',
        userAccountUuid: 'user-123',
        userEmail: 'test@example.com',
        terminalType: 'vscode',
        appVersion: '1.0.0',
        timestamp: expect.any(String),
      })
      // Note: handleToolDecision is not implemented in SessionHandler
      // Tool decisions are handled directly in processToolDecision by creating a Langfuse event
    })

    test('extracts attributes from array format', () => {
      const logRecord = {
        body: { stringValue: 'claude_code.api_request' },
        timeUnixNano: Date.now() * 1000000,
        attributes: [
          { key: 'model', value: { stringValue: 'claude-3-haiku' } },
          { key: 'input_tokens', value: { intValue: 50 } },
          { key: 'output_tokens', value: { doubleValue: 150.0 } },
          { key: 'cost_usd', value: { stringValue: '0.05' } },
        ],
      }

      const result = processEvent(logRecord, {}, mockSession)

      expect(result.model).toBe('claude-3-haiku')
      expect(result.inputTokens).toBe(50)
      expect(result.outputTokens).toBe(150)
      expect(result.costUsd).toBe(0.05)
    })
  })
})
