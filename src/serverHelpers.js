/**
 * Server Helper Functions
 *
 * Extracted server logic for better testability
 */

const pino = require('pino')

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

/**
 * Validate server configuration
 * @param {Object} config - Server configuration
 * @returns {Array} Array of validation errors
 */
function validateConfig(config) {
  const errors = []

  if (!config.langfuse.publicKey) {
    errors.push('LANGFUSE_PUBLIC_KEY is required')
  }
  if (!config.langfuse.secretKey) {
    errors.push('LANGFUSE_SECRET_KEY is required')
  }
  if (config.port < 1 || config.port > 65535) {
    errors.push('OTLP_RECEIVER_PORT must be between 1 and 65535')
  }

  return errors
}

/**
 * Create configuration object from environment
 * @returns {Object} Configuration object
 */
function createConfig() {
  return {
    port: parseInt(process.env.OTLP_RECEIVER_PORT || '4318', 10),
    host: process.env.OTLP_RECEIVER_HOST || '127.0.0.1',
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000', 10), // 1 hour
    maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || '10485760', 10), // 10MB
    langfuse: {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
      secretKey: process.env.LANGFUSE_SECRET_KEY || '',
      baseUrl: process.env.LANGFUSE_HOST || 'http://localhost:3000',
      flushAt: parseInt(process.env.LANGFUSE_FLUSH_AT || '20', 10),
      flushInterval: parseInt(process.env.LANGFUSE_FLUSH_INTERVAL || '10000', 10),
    },
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
    apiKey: process.env.API_KEY,
    nodeEnv: process.env.NODE_ENV || 'production',
    logLevel: process.env.LOG_LEVEL || 'info',
  }
}

/**
 * Print configuration help
 */
function printConfigHelp() {
  logger.info('Required environment variables:')
  logger.info('  LANGFUSE_PUBLIC_KEY - Your Langfuse public API key')
  logger.info('  LANGFUSE_SECRET_KEY - Your Langfuse secret API key')
  logger.info('Optional environment variables:')
  logger.info('  LANGFUSE_HOST - Langfuse API URL (default: http://localhost:3000)')
  logger.info('  OTLP_RECEIVER_PORT - Port to listen on (default: 4318)')
  logger.info('  OTLP_RECEIVER_HOST - Host to bind to (default: 127.0.0.1)')
  logger.info('  SESSION_TIMEOUT - Session timeout in ms (default: 3600000)')
  logger.info('  MAX_REQUEST_SIZE - Maximum request size in bytes (default: 10485760)')
  logger.info('  LOG_LEVEL - Logging level (default: info)')
  logger.info('  NODE_ENV - Environment (default: production)')
}

/**
 * Clean up expired sessions
 * @param {Map} sessions - Sessions map
 * @param {number} timeout - Session timeout in milliseconds
 * @returns {Array} Array of cleaned session IDs
 */
async function cleanupSessions(sessions, timeout) {
  const now = Date.now()
  const sessionsToDelete = []

  for (const [sessionId, session] of sessions) {
    if (now - session.lastActivity > timeout) {
      sessionsToDelete.push(sessionId)
    }
  }

  for (const sessionId of sessionsToDelete) {
    const session = sessions.get(sessionId)
    try {
      await session.finalize()
    } catch (error) {
      logger.error({ error, sessionId }, 'Error finalizing session during cleanup')
    }
    sessions.delete(sessionId)
    logger.info({ sessionId }, 'Session expired and cleaned up')
  }

  if (sessions.size > 0) {
    logger.debug({ activeSessions: sessions.size }, 'Active sessions')
  }

  return sessionsToDelete
}

/**
 * Finalize all active sessions
 * @param {Map} sessions - Sessions map
 */
async function finalizeAllSessions(sessions) {
  const finalizePromises = []

  for (const [sessionId, session] of sessions) {
    logger.info({ sessionId }, 'Finalizing session')
    finalizePromises.push(
      session.finalize().catch((error) => {
        logger.error({ error, sessionId }, 'Error finalizing session during shutdown')
      }),
    )
  }

  await Promise.all(finalizePromises)
}

/**
 * Handle request authentication
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @param {string} apiKey - API key if configured
 * @returns {boolean} Whether authentication passed
 */
function handleAuth(req, res, apiKey) {
  if (!apiKey) {
    return true
  }

  const authHeader = req.headers.authorization
  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return false
  }

  return true
}

/**
 * Set CORS headers
 * @param {Object} res - HTTP response
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/**
 * Handle preflight requests
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @returns {boolean} Whether request was handled
 */
function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }
  return false
}

/**
 * Generate server startup banner
 * @param {Object} config - Server configuration
 * @returns {string} Startup banner
 */
function generateStartupBanner(config) {
  return `
🚀 Claude Code Telemetry Server Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Server: http://${config.host}:${config.port}
✅ Health: http://${config.host}:${config.port}/health
✅ Langfuse: ${config.langfuse.baseUrl}

📋 Quick Setup (copy-paste this entire block):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://${config.host}:${config.port}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Next step: Run Claude with any command:
   claude "What files are in this directory?"

💡 Tip: To see user prompts in telemetry, also set:
   export OTEL_LOG_USER_PROMPTS=1

`
}

module.exports = {
  validateConfig,
  createConfig,
  printConfigHelp,
  cleanupSessions,
  finalizeAllSessions,
  handleAuth,
  setCorsHeaders,
  handlePreflight,
  generateStartupBanner,
}
