/**
 * Event Processor Module
 *
 * Handles processing of Claude Code events from OTLP logs
 * Based on https://docs.anthropic.com/en/docs/claude-code/monitoring-usage
 */

const pino = require('pino')
const { extractAttributesArray } = require('./sessionHandler')
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

/**
 * Process a Claude Code event from log record
 * @param {Object} logRecord - OTLP log record
 * @param {Object} resource - Resource information
 * @param {Object} session - Session handler instance
 * @returns {Object} Processed event data
 */
function processEvent(logRecord, resource, session) {
  const eventName = logRecord.body?.stringValue
  const attrs = extractAttributesArray(logRecord.attributes)
  const timestamp = logRecord.timeUnixNano / 1000000

  // Extract standard attributes that should be on all events
  const standardAttrs = {
    sessionId: attrs['session.id'] || session.sessionId,
    organizationId: attrs['organization.id'],
    userAccountUuid: attrs['user.account_uuid'],
    userEmail: attrs['user.email'],
    terminalType: attrs['terminal.type'],
    appVersion: attrs['app.version'],
    timestamp: new Date(timestamp).toISOString(),
  }

  // Store standard attributes in session if not already present
  if (standardAttrs.organizationId && !session.organizationId) {
    session.organizationId = standardAttrs.organizationId
  }
  if (standardAttrs.userAccountUuid && !session.userAccountUuid) {
    session.userAccountUuid = standardAttrs.userAccountUuid
  }
  if (standardAttrs.userEmail && !session.userEmail) {
    session.userEmail = standardAttrs.userEmail
  }
  if (standardAttrs.terminalType && !session.terminalType) {
    session.terminalType = standardAttrs.terminalType
  }

  switch (eventName) {
    case 'claude_code.user_prompt':
      return processUserPrompt(attrs, standardAttrs, timestamp, session)

    case 'claude_code.api_request':
      return processApiRequest(attrs, standardAttrs, timestamp, session)

    case 'claude_code.api_error':
      return processApiError(attrs, standardAttrs, timestamp, session)

    case 'claude_code.tool_result':
      return processToolResult(attrs, standardAttrs, timestamp, session)

    case 'claude_code.tool_decision':
      return processToolDecision(attrs, standardAttrs, timestamp, session)

    default:
      logger.debug({ eventName, attrs }, 'Unknown event')
      return null
  }
}

/**
 * Process user prompt event
 * Attributes:
 * - event.name: "user_prompt"
 * - event.timestamp: ISO 8601 timestamp
 * - prompt_length: Integer
 * - prompt: Optional (requires OTEL_LOG_USER_PROMPTS=1)
 */
function processUserPrompt(attrs, standardAttrs, timestamp, session) {
  const prompt = attrs.prompt || attrs['user.prompt'] || ''
  const promptLength = parseInt(attrs.prompt_length || attrs['prompt.length'] || '0', 10)
  const eventTimestamp = attrs['event.timestamp'] || standardAttrs.timestamp

  logger.debug({ attrs, prompt, promptLength, standardAttrs }, 'Processing user prompt with attributes')

  // Pass all attributes to session handler
  session.handleUserPrompt({
    prompt,
    prompt_length: promptLength,
    'user.email': standardAttrs.userEmail,
    'event.timestamp': eventTimestamp,
    'session.id': standardAttrs.sessionId,
    'organization.id': standardAttrs.organizationId,
    'user.account_uuid': standardAttrs.userAccountUuid,
    'terminal.type': standardAttrs.terminalType,
    'app.version': standardAttrs.appVersion,
  }, eventTimestamp)

  logger.info({
    sessionId: session.sessionId,
    userEmail: standardAttrs.userEmail,
    promptLength,
    timestamp: eventTimestamp,
  }, 'User prompt received')

  return {
    type: 'user_prompt',
    prompt,
    promptLength,
    ...standardAttrs,
  }
}

/**
 * Process API request event
 * Attributes:
 * - event.name: "api_request"
 * - event.timestamp: ISO 8601 timestamp
 * - model: Model identifier (e.g., "claude-3-5-sonnet-20241022")
 * - input_tokens: Integer
 * - output_tokens: Integer
 * - cache_read_tokens: Integer
 * - cache_creation_tokens: Integer
 * - cost_usd: Float
 * - duration_ms: Integer
 * - request_id: Optional
 */
function processApiRequest(attrs, standardAttrs, timestamp, session) {
  const model = attrs.model || attrs['model.name'] || 'unknown'
  const inputTokens = parseInt(attrs.input_tokens || attrs['tokens.input'] || '0', 10)
  const outputTokens = parseInt(attrs.output_tokens || attrs['tokens.output'] || '0', 10)
  const cacheReadTokens = parseInt(attrs.cache_read_tokens || attrs['cache.read_tokens'] || '0', 10)
  const cacheCreationTokens = parseInt(attrs.cache_creation_tokens || attrs['cache.creation_tokens'] || '0', 10)
  const costUsd = parseFloat(attrs.cost_usd || attrs.cost || attrs['cost.usd'] || '0')
  const durationMs = parseInt(attrs.duration_ms || attrs.duration || '0', 10)
  const requestId = attrs.request_id || attrs['request.id']
  const eventTimestamp = attrs['event.timestamp'] || standardAttrs.timestamp

  // Pass all attributes to session handler
  session.handleApiRequest({
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_creation_tokens: cacheCreationTokens,
    cost: costUsd,
    duration_ms: durationMs,
    'api.response_time': durationMs,
    request_id: requestId,
    'event.timestamp': eventTimestamp,
    ...standardAttrs,
  }, eventTimestamp)

  logger.info({
    sessionId: session.sessionId,
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    costUsd,
    durationMs,
    requestId,
  }, 'API request processed')

  return {
    type: 'api_request',
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    costUsd,
    durationMs,
    requestId,
    ...standardAttrs,
  }
}

/**
 * Process API error event
 * Attributes:
 * - event.name: "api_error"
 * - event.timestamp: ISO 8601 timestamp
 * - error_message: String
 * - status_code: Integer
 * - model: Model identifier
 * - request_id: Optional
 */
function processApiError(attrs, standardAttrs, timestamp, session) {
  const errorMessage = attrs.error_message || attrs.error || attrs.message || 'Unknown error'
  const statusCode = parseInt(attrs.status_code || attrs.status || '0', 10)
  const model = attrs.model || 'unknown'
  const requestId = attrs.request_id || attrs['request.id']
  const eventTimestamp = attrs['event.timestamp'] || standardAttrs.timestamp

  session.handleApiError({
    error_message: errorMessage,
    status_code: statusCode,
    model,
    request_id: requestId,
    'event.timestamp': eventTimestamp,
    ...standardAttrs,
  }, eventTimestamp)

  logger.warn({
    sessionId: session.sessionId,
    errorMessage,
    statusCode,
    model,
    requestId,
  }, 'API error occurred')

  return {
    type: 'api_error',
    errorMessage,
    statusCode,
    model,
    requestId,
    ...standardAttrs,
  }
}

/**
 * Process tool result event
 * Attributes:
 * - event.name: "tool_result"
 * - event.timestamp: ISO 8601 timestamp
 * - tool_name: String (e.g., "Read", "Edit", "Bash")
 * - success: Boolean
 * - duration_ms: Integer
 */
function processToolResult(attrs, standardAttrs, timestamp, session) {
  const toolName = attrs.tool_name || attrs.tool || attrs.name || 'unknown'
  const success = attrs.success === 'true' || attrs.success === true
  const durationMs = parseInt(attrs.duration_ms || attrs.duration || '0', 10)
  const eventTimestamp = attrs['event.timestamp'] || standardAttrs.timestamp

  session.handleToolResult({
    tool_name: toolName,
    success,
    duration_ms: durationMs,
    'event.timestamp': eventTimestamp,
    ...standardAttrs,
  }, eventTimestamp)

  logger.info({
    sessionId: session.sessionId,
    toolName,
    success,
    durationMs,
  }, 'Tool result processed')

  return {
    type: 'tool_result',
    toolName,
    success,
    durationMs,
    ...standardAttrs,
  }
}

/**
 * Process tool decision event (from logs)
 * This is different from the metric version which tracks accept/reject decisions
 * Attributes:
 * - event.name: "tool_decision"
 * - event.timestamp: ISO 8601 timestamp
 * - decision: String
 * - source: String
 * - tool_name: String
 */
function processToolDecision(attrs, standardAttrs, timestamp, session) {
  const decision = attrs.decision || 'unknown'
  const source = attrs.source || 'unknown'
  const toolName = attrs.tool_name || attrs.tool || 'unknown'
  const eventTimestamp = attrs['event.timestamp'] || standardAttrs.timestamp

  logger.info({
    sessionId: session.sessionId,
    decision,
    source,
    toolName,
  }, 'Tool decision processed')

  // Create event in current trace if exists
  if (session.currentTrace && session.langfuse) {
    session.langfuse.event({
      name: 'tool-permission-decision',
      traceId: session.currentTrace.id,
      input: {
        tool: toolName,
        source,
      },
      output: {
        decision,
      },
      metadata: {
        tool: toolName,
        decision,
        source,
        timestamp: eventTimestamp,
        ...standardAttrs,
      },
      level: decision === 'accept' ? 'DEFAULT' : 'WARNING',
    })
  }

  return {
    type: 'tool_decision',
    decision,
    source,
    toolName,
    ...standardAttrs,
  }
}

// Helper function to extract standard attributes
function extractStandardAttributes(attrs) {
  return {
    sessionId: attrs['session.id'],
    organizationId: attrs['organization.id'],
    userAccountUuid: attrs['user.account_uuid'],
    userEmail: attrs['user.email'],
    terminalType: attrs['terminal.type'],
    appVersion: attrs['app.version'],
  }
}

module.exports = {
  processEvent,
  processUserPrompt,
  processApiRequest,
  processApiError,
  processToolResult,
  processToolDecision,
  extractStandardAttributes,
}
