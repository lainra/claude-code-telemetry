#!/usr/bin/env node

/**
 * Claude Code Telemetry Server
 *
 * OTLP-compatible telemetry receiver that captures observability data from Claude Code
 * and forwards it to Langfuse for comprehensive LLM monitoring and analytics.
 *
 * Production-ready implementation with:
 * - Structured logging with pino
 * - Configuration validation
 * - Health check endpoint
 * - Graceful shutdown
 * - Error handling with retries
 * - Request size limits
 */

'use strict'

require('dotenv').config()

const http = require('http')
const { Langfuse } = require('langfuse')
// const { v4: uuidv4 } = require('uuid') // Currently unused
const pino = require('pino')
const { retry } = require('./sessionHandler')
const { handleTraces, handleMetrics, handleLogs, handleHealthCheck } = require('./requestHandlers')
const {
  validateConfig: validateConfigHelper,
  createConfig,
  cleanupSessions: cleanupSessionsHelper,
  finalizeAllSessions,
  handleAuth,
  setCorsHeaders,
  handlePreflight,
  generateStartupBanner,
} = require('./serverHelpers')

// Configuration with validation
const config = createConfig()

// Logger setup
const logger = pino({
  level: config.logLevel,
  transport: config.nodeEnv === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          colorize: true,
        },
      }
    : undefined,
})

// Validate configuration
function validateConfig() {
  const errors = validateConfigHelper(config)

  if (errors.length > 0) {
    logger.error({ errors }, 'Configuration validation failed')
    const { printConfigHelp } = require('./serverHelpers')
    printConfigHelp()
    process.exit(1)
  }
}

// Initialize Langfuse with error handling
const langfuse = new Langfuse({
  publicKey: config.langfuse.publicKey,
  secretKey: config.langfuse.secretKey,
  baseUrl: config.langfuse.baseUrl,
  flushAt: config.langfuse.flushAt,
  flushInterval: config.langfuse.flushInterval,
})

// In test environment, try to prevent Langfuse from keeping process alive
if (process.env.NODE_ENV === 'test' && langfuse._flushInterval) {
  langfuse._flushInterval.unref()
}

langfuse.on('error', (error) => {
  logger.error({ error }, 'Langfuse SDK error')
})

// Session management
const sessions = new Map()
const serverStartTime = Date.now()
let requestCount = 0
let errorCount = 0

// HTTP Server with request size limit and authentication
const server = http.createServer((req, res) => {
  requestCount++

  // CORS headers
  setCorsHeaders(res)

  // Handle preflight
  if (handlePreflight(req, res)) {
    return
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    handleHealthCheck(res, serverStartTime, sessions, requestCount, errorCount)
    return
  }

  // API key authentication if configured
  if (!handleAuth(req, res, config.apiKey)) {
    return
  }

  // Only accept POST requests for telemetry
  if (req.method === 'POST') {
    const chunks = []
    let size = 0

    req.on('data', (chunk) => {
      size += chunk.length
      if (size > config.maxRequestSize) {
        res.writeHead(413, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Request entity too large' }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      // Route based on path
      try {
        const body = Buffer.concat(chunks)
        if (req.url === '/v1/traces') {
          handleTraces(body, res, sessions, langfuse)
        } else if (req.url === '/v1/metrics') {
          handleMetrics(body, res, sessions, langfuse)
        } else if (req.url === '/v1/logs') {
          handleLogs(body, res, sessions, langfuse)
        } else {
          res.writeHead(404)
          res.end('Not found')
        }
      } catch (error) {
        errorCount++
        logger.error({ error, url: req.url }, 'Error handling request')
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    })
  } else {
    res.writeHead(405)
    res.end('Method not allowed')
  }
})

// Session cleanup
function cleanupSessions() {
  cleanupSessionsHelper(sessions, config.sessionTimeout).catch((error) => {
    logger.error({ error }, 'Error during session cleanup')
  })
}

// Schedule periodic cleanup
const cleanupInterval = setInterval(cleanupSessions, 60000) // Every minute
cleanupInterval.unref() // Allow process to exit even if interval is active

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down gracefully...')

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed')
  })

  // Clear cleanup interval
  clearInterval(cleanupInterval)

  // Finalize all active sessions
  await finalizeAllSessions(sessions)

  try {
    await retry(() => langfuse.flushAsync())
    // Shutdown Langfuse SDK to close any remaining connections
    await langfuse.shutdownAsync()
  } catch (error) {
    logger.error({ error }, 'Error during Langfuse shutdown')
  }

  logger.info('Shutdown complete')

  // In test environment, ensure all handles are closed
  if (process.env.NODE_ENV === 'test') {
    // Force close any remaining handles
    process.exit(0)
  } else {
    process.exit(0)
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception')
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection')
  process.exit(1)
})

// Start server only if not in test environment or if this file is run directly
if (process.env.NODE_ENV !== 'test' || require.main === module) {
  validateConfig()

  server.listen(config.port, config.host, () => {
    console.log(generateStartupBanner(config))
  })
}

// Export for testing
module.exports = { server, config, sessions, langfuse }
