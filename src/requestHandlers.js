/**
 * Request Handlers Module
 *
 * Handles OTLP endpoint requests for traces, metrics, and logs
 */

const pino = require('pino')
const { SessionHandler, extractAttributesArray } = require('./sessionHandler')
const { processEvent } = require('./eventProcessor')
const { processMetric } = require('./metricsProcessor')

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

/**
 * Handle OTLP traces endpoint
 */
function handleTraces(data, res, sessions, langfuse) {
  try {
    JSON.parse(data.toString()) // Validate JSON but Claude doesn't send traces
    logger.debug({ size: data.length }, 'Received traces')
    // Claude doesn't send traces, but handle the endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ partialSuccess: {} }))
  } catch (error) {
    logger.error({ error }, 'Error parsing traces')
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
  }
}

/**
 * Handle OTLP metrics endpoint
 */
function handleMetrics(data, res, sessions, langfuse) {
  try {
    const metrics = JSON.parse(data.toString())
    logger.info({ size: data.length }, 'Received metrics')

    // Log the actual metrics structure
    if (logger.level === 'debug') {
      logger.debug({ metrics: JSON.stringify(metrics, null, 2) }, 'Metrics payload')
    }

    // Process each resource metric
    if (metrics && metrics.resourceMetrics) {
      for (const resourceMetric of metrics.resourceMetrics) {
        const resource = resourceMetric.resource

        for (const scopeMetric of resourceMetric.scopeMetrics || []) {
          for (const metric of scopeMetric.metrics || []) {
            logger.info({
              metricName: metric.name,
              metricDescription: metric.description,
              metricUnit: metric.unit,
              dataPoints: metric.sum?.dataPoints?.length ||
                         metric.gauge?.dataPoints?.length ||
                         metric.histogram?.dataPoints?.length || 0,
            }, 'Processing metric')

            // Process metric data points
            const dataPoints = metric.sum?.dataPoints || metric.gauge?.dataPoints || metric.histogram?.dataPoints || []

            for (const dataPoint of dataPoints) {
              const attrs = extractAttributesArray(dataPoint.attributes)
              const sessionId = attrs['session.id']

              if (sessionId) {
                // Get or create session
                if (!sessions.has(sessionId)) {
                  const resourceAttrs = extractAttributesArray(resource?.attributes)
                  sessions.set(sessionId, new SessionHandler(sessionId, resourceAttrs, langfuse))
                }

                const session = sessions.get(sessionId)
                processMetric(metric, dataPoint, attrs, session)
              }
            }
          }
        }
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ partialSuccess: {} }))
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error processing metrics')
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: error.message || 'Invalid JSON' }))
  }
}

/**
 * Handle OTLP logs endpoint
 */
function handleLogs(data, res, sessions, langfuse) {
  try {
    const logs = JSON.parse(data.toString())
    logger.debug({ size: data.length }, 'Received logs')

    // Process each resource log
    if (logs && logs.resourceLogs) {
      for (const resourceLog of logs.resourceLogs) {
        const resource = resourceLog.resource

        for (const scopeLog of resourceLog.scopeLogs || []) {
          logger.debug({ scope: scopeLog.scope?.name }, 'Processing scope logs')

          for (const logRecord of scopeLog.logRecords || []) {
            // Extract session ID
            const attrs = extractAttributesArray(logRecord.attributes)
            const sessionId = attrs['session.id'] || attrs['claude.session.id']

            if (sessionId) {
              // Get or create session
              if (!sessions.has(sessionId)) {
                const resourceAttrs = extractAttributesArray(resource?.attributes)
                sessions.set(sessionId, new SessionHandler(sessionId, resourceAttrs, langfuse))
              }

              const session = sessions.get(sessionId)
              processEvent(logRecord, resource, session)
            } else {
              // Try to create session from other identifiers
              const userId = attrs['user.id'] || attrs['user.email']
              const eventTimestamp = attrs['event.timestamp']
              if (userId && eventTimestamp) {
                const timeWindow = new Date(eventTimestamp).toISOString().substring(0, 13)
                const sessionId = `${userId}-${timeWindow}`.replace(/[^a-zA-Z0-9-]/g, '-')

                if (!sessions.has(sessionId)) {
                  const resourceAttrs = extractAttributesArray(resource?.attributes)
                  sessions.set(sessionId, new SessionHandler(sessionId, resourceAttrs, langfuse))
                }

                const session = sessions.get(sessionId)
                processEvent(logRecord, resource, session)
              } else {
                logger.debug({ body: logRecord.body?.stringValue, attrs }, 'Log without session')
              }
            }
          }
        }
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ partialSuccess: {} }))
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error processing logs')
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: error.message || 'Invalid JSON' }))
  }
}

/**
 * Handle health check endpoint
 */
function handleHealthCheck(res, serverStartTime, sessions, requestCount, errorCount) {
  const uptime = Date.now() - serverStartTime
  const health = {
    status: 'healthy',
    uptime,
    sessions: sessions.size,
    requestCount,
    errorCount,
    langfuse: 'connected',
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(health))
}

module.exports = {
  handleTraces,
  handleMetrics,
  handleLogs,
  handleHealthCheck,
}
