/**
 * Langfuse Test Client
 *
 * Provides direct API access to Langfuse for integration testing
 */

const https = require('https')
const http = require('http')

class LangfuseTestClient {
  constructor(config = {}) {
    this.host = config.host || process.env.LANGFUSE_HOST || 'http://localhost:3000'
    this.publicKey = config.publicKey || process.env.LANGFUSE_PUBLIC_KEY
    this.secretKey = config.secretKey || process.env.LANGFUSE_SECRET_KEY

    if (!this.publicKey || !this.secretKey) {
      throw new Error('Langfuse credentials required: LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY')
    }

    this.auth = Buffer.from(`${this.publicKey}:${this.secretKey}`).toString('base64')
  }

  /**
   * Make authenticated request to Langfuse API
   */
  async request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.host)
      const client = url.protocol === 'https:' ? https : http

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: `Basic ${this.auth}`,
          'Content-Type': 'application/json',
        },
      }

      const req = client.request(options, (res) => {
        let data = ''
        res.on('data', chunk => {
          data += chunk
        })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (res.statusCode >= 400) {
              reject(new Error(`Langfuse API Error ${res.statusCode}: ${json.message || data}`))
            } else {
              resolve(json)
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`))
          }
        })
      })

      req.on('error', reject)

      if (body) {
        req.write(JSON.stringify(body))
      }

      req.end()
    })
  }

  /**
   * Get recent sessions
   */
  async getSessions(limit = 10) {
    const response = await this.request(`/api/public/sessions?limit=${limit}`)
    return response.data || []
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    return await this.request(`/api/public/sessions/${sessionId}`)
  }

  /**
   * Get recent traces
   */
  async getTraces(limit = 10, sessionId = null) {
    let path = `/api/public/traces?limit=${limit}`
    if (sessionId) {
      path += `&sessionId=${sessionId}`
    }
    const response = await this.request(path)
    return response.data || []
  }

  /**
   * Get trace with full details including observations
   */
  async getTrace(traceId) {
    return await this.request(`/api/public/traces/${traceId}`)
  }

  /**
   * Get observations for a trace
   */
  async getObservations(traceId) {
    const trace = await this.getTrace(traceId)
    return trace.observations || []
  }

  /**
   * Wait for a trace to appear with specific criteria
   */
  async waitForTrace(criteria, options = {}) {
    const { timeout = 10000, interval = 500 } = options
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const traces = await this.getTraces(20)

      const found = traces.find(trace => {
        if (criteria.name && !trace.name?.includes(criteria.name)) return false
        if (criteria.sessionId && trace.sessionId !== criteria.sessionId) return false
        if (criteria.hasObservations) {
          // Need to fetch full trace to check observations
          return this.getTrace(trace.id).then(fullTrace => {
            return (fullTrace.observations?.length || 0) > 0
          }).catch(() => false)
        }
        return true
      })

      if (found) {
        // If we need to check observations, fetch full trace
        if (criteria.hasObservations) {
          return await this.getTrace(found.id)
        }
        return found
      }

      await new Promise(resolve => setTimeout(resolve, interval))
    }

    throw new Error(`Trace not found after ${timeout}ms with criteria: ${JSON.stringify(criteria)}`)
  }

  /**
   * Clean up test data
   */
  async cleanup(sessionPrefix = 'test-') {
    // Note: Langfuse doesn't provide delete endpoints in the public API
    // In real tests, we'd use unique session IDs and filter them out
    // For now, this is a placeholder
    console.log('Cleanup: Langfuse public API does not support deletion')
  }

  /**
   * Verify a complete telemetry flow
   */
  async verifyTelemetryFlow(sessionId) {
    const validation = {
      session: false,
      conversationTrace: false,
      summaryTrace: false,
      generations: 0,
      events: 0,
      scores: 0,
      metadata: {
        organization: false,
        user: false,
        terminal: false,
        cache: false,
      },
    }

    // Check session exists
    const sessions = await this.getSessions()
    validation.session = sessions.some(s => s.id === sessionId)

    // Get traces for session
    const traces = await this.getTraces(20, sessionId)

    // Check for conversation trace
    const conversationTrace = traces.find(t => t.name?.startsWith('conversation-'))
    if (conversationTrace) {
      validation.conversationTrace = true

      // Get full trace details
      const fullTrace = await this.getTrace(conversationTrace.id)

      // Check metadata
      const metadata = fullTrace.metadata || {}
      validation.metadata.organization = !!metadata.organizationId
      validation.metadata.user = !!(metadata.userAccountUuid || metadata.userEmail)
      validation.metadata.terminal = !!metadata.terminalType

      // Count observations
      const observations = fullTrace.observations || []
      validation.generations = observations.filter(o => o.type === 'GENERATION').length
      validation.events = observations.filter(o => o.type === 'EVENT').length

      // Check for cache data in generations
      const generation = observations.find(o => o.type === 'GENERATION')
      if (generation?.metadata?.cache) {
        validation.metadata.cache = true
      }

      // Check scores
      validation.scores = fullTrace.scores?.length || 0
    }

    // Check for session summary trace
    validation.summaryTrace = traces.some(t => t.name === 'session-summary')

    return validation
  }
}

module.exports = { LangfuseTestClient }
