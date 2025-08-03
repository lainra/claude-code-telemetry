/**
 * OTLP Test Data Builders
 *
 * Helper functions to create valid OTLP data for testing
 */

const crypto = require('crypto')

/**
 * Generate a unique session ID for testing
 */
function generateTestSessionId() {
  return `test-session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
}

/**
 * Create standard resource attributes
 */
function createResourceAttributes(overrides = {}) {
  return [
    { key: 'host.arch', value: { stringValue: 'arm64' } },
    { key: 'os.type', value: { stringValue: 'darwin' } },
    { key: 'os.version', value: { stringValue: '24.5.0' } },
    { key: 'service.name', value: { stringValue: 'claude-code' } },
    { key: 'service.version', value: { stringValue: '1.0.64' } },
    ...Object.entries(overrides).map(([key, value]) => ({
      key,
      value: { stringValue: String(value) },
    })),
  ]
}

/**
 * Create standard event attributes
 */
function createStandardAttributes(sessionId, overrides = {}) {
  return {
    'session.id': sessionId,
    'organization.id': 'test-org-id',
    'user.account_uuid': 'test-user-uuid',
    'user.email': 'test@example.com',
    'terminal.type': 'test-terminal',
    'app.version': '1.0.0',
    ...overrides,
  }
}

/**
 * Create a user prompt log record
 */
function createUserPromptLog(sessionId, prompt = 'Test prompt', overrides = {}) {
  const attrs = createStandardAttributes(sessionId, overrides)
  const timestamp = Date.now() * 1000000 // nanoseconds

  return {
    timeUnixNano: String(timestamp),
    severityNumber: 9,
    severityText: 'INFO',
    body: { stringValue: 'claude_code.user_prompt' },
    attributes: [
      ...Object.entries(attrs).map(([k, v]) => ({
        key: k,
        value: { stringValue: String(v) },
      })),
      { key: 'prompt', value: { stringValue: prompt } },
      { key: 'prompt_length', value: { intValue: prompt.length } },
      { key: 'event.timestamp', value: { stringValue: new Date().toISOString() } },
    ],
  }
}

/**
 * Create an API request log record
 */
function createApiRequestLog(sessionId, options = {}) {
  const {
    model = 'claude-3-opus-20240229',
    inputTokens = 100,
    outputTokens = 200,
    cacheReadTokens = 50,
    cacheCreationTokens = 25,
    cost = 0.015,
    duration = 1500,
  } = options

  const attrs = createStandardAttributes(sessionId, options.attrs || {})
  const timestamp = Date.now() * 1000000

  return {
    timeUnixNano: String(timestamp),
    severityNumber: 9,
    severityText: 'INFO',
    body: { stringValue: 'claude_code.api_request' },
    attributes: [
      ...Object.entries(attrs).map(([k, v]) => ({
        key: k,
        value: { stringValue: String(v) },
      })),
      { key: 'model', value: { stringValue: model } },
      { key: 'input_tokens', value: { intValue: inputTokens } },
      { key: 'output_tokens', value: { intValue: outputTokens } },
      { key: 'cache_read_tokens', value: { intValue: cacheReadTokens } },
      { key: 'cache_creation_tokens', value: { intValue: cacheCreationTokens } },
      { key: 'cost_usd', value: { doubleValue: cost } },
      { key: 'duration_ms', value: { intValue: duration } },
      { key: 'event.timestamp', value: { stringValue: new Date().toISOString() } },
    ],
  }
}

/**
 * Create a tool result log record
 */
function createToolResultLog(sessionId, toolName = 'Read', success = true, duration = 250) {
  const attrs = createStandardAttributes(sessionId)
  const timestamp = Date.now() * 1000000

  return {
    timeUnixNano: String(timestamp),
    severityNumber: 9,
    severityText: 'INFO',
    body: { stringValue: 'claude_code.tool_result' },
    attributes: [
      ...Object.entries(attrs).map(([k, v]) => ({
        key: k,
        value: { stringValue: String(v) },
      })),
      { key: 'tool_name', value: { stringValue: toolName } },
      { key: 'success', value: { boolValue: success } },
      { key: 'duration_ms', value: { intValue: duration } },
      { key: 'event.timestamp', value: { stringValue: new Date().toISOString() } },
    ],
  }
}

/**
 * Create cost metric data point
 */
function createCostMetric(sessionId, model = 'claude-3-opus-20240229', cost = 0.015) {
  const attrs = createStandardAttributes(sessionId)
  const timestamp = Date.now() * 1000000

  return {
    name: 'claude_code.cost.usage',
    description: 'Cost of the Claude Code session',
    unit: 'USD',
    sum: {
      aggregationTemporality: 1,
      isMonotonic: true,
      dataPoints: [{
        attributes: [
          ...Object.entries(attrs).map(([k, v]) => ({
            key: k,
            value: { stringValue: String(v) },
          })),
          { key: 'model', value: { stringValue: model } },
        ],
        startTimeUnixNano: String(timestamp - 1000000),
        timeUnixNano: String(timestamp),
        asDouble: cost,
      }],
    },
  }
}

/**
 * Create token usage metric data points
 */
function createTokenMetrics(sessionId, model = 'claude-3-opus-20240229', tokens = {}) {
  const {
    input = 100,
    output = 200,
    cacheRead = 50,
    cacheCreation = 25,
  } = tokens

  const attrs = createStandardAttributes(sessionId)
  const timestamp = Date.now() * 1000000

  const tokenTypes = [
    { type: 'input', value: input },
    { type: 'output', value: output },
    { type: 'cacheRead', value: cacheRead },
    { type: 'cacheCreation', value: cacheCreation },
  ]

  return {
    name: 'claude_code.token.usage',
    description: 'Number of tokens used',
    unit: 'tokens',
    sum: {
      aggregationTemporality: 1,
      isMonotonic: true,
      dataPoints: tokenTypes.map(({ type, value }) => ({
        attributes: [
          ...Object.entries(attrs).map(([k, v]) => ({
            key: k,
            value: { stringValue: String(v) },
          })),
          { key: 'type', value: { stringValue: type } },
          { key: 'model', value: { stringValue: model } },
        ],
        startTimeUnixNano: String(timestamp - 1000000),
        timeUnixNano: String(timestamp),
        asDouble: value,
      })),
    },
  }
}

/**
 * Create a complete OTLP logs request
 */
function createOTLPLogsRequest(logRecords) {
  return {
    resourceLogs: [{
      resource: {
        attributes: createResourceAttributes(),
      },
      scopeLogs: [{
        scope: {
          name: 'com.anthropic.claude_code',
          version: '1.0.64',
        },
        logRecords,
      }],
    }],
  }
}

/**
 * Create a complete OTLP metrics request
 */
function createOTLPMetricsRequest(metrics) {
  return {
    resourceMetrics: [{
      resource: {
        attributes: createResourceAttributes(),
      },
      scopeMetrics: [{
        scope: {
          name: 'com.anthropic.claude_code',
          version: '1.0.64',
        },
        metrics,
      }],
    }],
  }
}

module.exports = {
  generateTestSessionId,
  createResourceAttributes,
  createStandardAttributes,
  createUserPromptLog,
  createApiRequestLog,
  createToolResultLog,
  createCostMetric,
  createTokenMetrics,
  createOTLPLogsRequest,
  createOTLPMetricsRequest,
}
