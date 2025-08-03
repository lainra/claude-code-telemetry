/**
 * Metrics Processor Module
 *
 * Handles processing of Claude Code metrics from OTLP metrics
 */

const pino = require('pino')
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

/**
 * Process a Claude Code metric
 * @param {Object} metric - OTLP metric object
 * @param {Object} dataPoint - Metric data point
 * @param {Object} attrs - Extracted attributes
 * @param {Object} session - Session handler instance
 * @returns {Object} Processed metric data
 */
function processMetric(metric, dataPoint, attrs, session) {
  const metricName = metric.name
  const timestamp = dataPoint.timeUnixNano / 1000000

  // IMPORTANT: Call session.processMetric to ensure Langfuse events are created
  session.processMetric(metric, dataPoint, attrs)

  // Also process locally for return values and logging
  switch (metricName) {
    case 'claude_code.cost.usage':
      return processCostMetric(dataPoint, attrs, timestamp, session)

    case 'claude_code.token.usage':
      return processTokenMetric(dataPoint, attrs, timestamp, session)

    case 'claude_code.lines_of_code.count':
      return processLinesOfCodeMetric(dataPoint, attrs, timestamp, session)

    case 'claude_code.commit.count':
      return processCommitMetric(dataPoint, attrs, timestamp, session)

    case 'claude_code.code_edit_tool.decision':
      return processToolDecisionMetric(dataPoint, attrs, timestamp, session)

    case 'claude_code.session.count':
      return processSessionMetric(dataPoint, attrs, timestamp, session)

    case 'claude_code.active_time.total':
      return processActiveTimeMetric(dataPoint, attrs, timestamp, session)

    case 'claude_code.pr.count':
    case 'claude_code.pull_request.count': // Support both metric names
      return processPullRequestMetric(dataPoint, attrs, timestamp, session)

    default:
      logger.debug({ metricName, attrs }, 'Unknown metric')
      return null
  }
}

/**
 * Process cost usage metric
 */
function processCostMetric(dataPoint, attrs, timestamp, session) {
  const cost = dataPoint.asDouble || 0
  const model = attrs.model || 'unknown'

  // Cost is now handled by session.processMetric()
  logger.info({
    sessionId: session.sessionId,
    cost,
    model,
    totalCost: session.totalCost,
  }, 'Cost metric processed')

  return {
    type: 'cost',
    cost,
    model,
    timestamp,
  }
}

/**
 * Process token usage metric
 */
function processTokenMetric(dataPoint, attrs, timestamp, session) {
  const tokens = dataPoint.asDouble || 0
  const tokenType = attrs.type || 'unknown'
  const model = attrs.model || 'unknown'

  // Tokens are now handled by session.processMetric()
  logger.info({
    sessionId: session.sessionId,
    tokens,
    tokenType,
    model,
  }, 'Token metric processed')

  return {
    type: 'token',
    tokens,
    tokenType,
    model,
    timestamp,
  }
}

/**
 * Process lines of code metric
 */
function processLinesOfCodeMetric(dataPoint, attrs, timestamp, session) {
  const lines = dataPoint.asDouble || 0
  const changeType = attrs.type || 'unknown'

  // Lines tracking is now handled by session.processMetric()
  logger.info({
    sessionId: session.sessionId,
    lines,
    changeType,
    totalAdded: session.linesAdded,
    totalRemoved: session.linesRemoved,
  }, 'Lines of code metric processed')

  return {
    type: 'lines_of_code',
    lines,
    changeType,
    timestamp,
  }
}

/**
 * Process commit count metric
 */
function processCommitMetric(dataPoint, attrs, timestamp, session) {
  const commits = parseInt(dataPoint.asInt || dataPoint.asDouble || '0', 10)

  // Initialize if not exists
  if (!session.commitCount) {
    session.commitCount = 0
  }
  session.commitCount += commits

  logger.info({
    sessionId: session.sessionId,
    commits,
    totalCommits: session.commitCount,
  }, 'Commit metric processed')

  return {
    type: 'commit',
    commits,
    timestamp,
  }
}

/**
 * Process tool decision metric
 * This tracks accept/reject decisions for code editing tools
 * Attributes:
 * - tool: "Edit", "MultiEdit", "Write", "NotebookEdit"
 * - decision: "accept" or "reject"
 * - language: Programming language
 */
function processToolDecisionMetric(dataPoint, attrs, timestamp, session) {
  const decision = attrs.decision || 'unknown'
  const tool = attrs.tool || 'unknown'
  const language = attrs.language || 'unknown'
  const count = dataPoint.asDouble || dataPoint.asInt || 1

  if (!session.toolDecisions) {
    session.toolDecisions = []
  }

  session.toolDecisions.push({
    decision,
    tool,
    language,
    count,
    timestamp,
  })

  // Create Langfuse event for tool decision
  if (session.currentTrace && session.langfuse) {
    session.langfuse.event({
      name: 'code-edit-decision',
      traceId: session.currentTrace.id,
      input: {
        tool,
        language,
      },
      output: {
        decision,
        count,
      },
      metadata: {
        tool,
        decision,
        language,
        count,
        timestamp: new Date(timestamp).toISOString(),
      },
      level: decision === 'accept' ? 'DEFAULT' : 'WARNING',
    })
  }

  logger.info({
    sessionId: session.sessionId,
    decision,
    tool,
    language,
    count,
  }, 'Tool decision metric processed')

  return {
    type: 'tool_decision',
    decision,
    tool,
    language,
    count,
    timestamp,
  }
}

/**
 * Process session count metric
 */
function processSessionMetric(dataPoint, attrs, timestamp, session) {
  // This metric indicates a new session started
  session.sessionStarted = true

  logger.info({
    sessionId: session.sessionId,
    timestamp: new Date(timestamp).toISOString(),
  }, 'Session start metric processed')

  return {
    type: 'session_start',
    timestamp,
  }
}

/**
 * Process active time metric
 */
function processActiveTimeMetric(dataPoint, attrs, timestamp, session) {
  const activeTime = dataPoint.asDouble || 0

  session.activeTime = activeTime

  logger.info({
    sessionId: session.sessionId,
    activeTime,
  }, 'Active time metric processed')

  return {
    type: 'active_time',
    activeTime,
    timestamp,
  }
}

/**
 * Process pull request count metric
 */
function processPullRequestMetric(dataPoint, attrs, timestamp, session) {
  const prCount = parseInt(dataPoint.asInt || dataPoint.asDouble || '0', 10)

  session.prCount = (session.prCount || 0) + prCount

  logger.info({
    sessionId: session.sessionId,
    prCount,
    totalPRs: session.prCount,
  }, 'Pull request metric processed')

  return {
    type: 'pull_request',
    prCount,
    timestamp,
  }
}

module.exports = {
  processMetric,
  processCostMetric,
  processTokenMetric,
  processLinesOfCodeMetric,
  processCommitMetric,
  processToolDecisionMetric,
  processSessionMetric,
  processActiveTimeMetric,
  processPullRequestMetric,
}
