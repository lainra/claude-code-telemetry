const {
  validateConfig,
  createConfig,
  printConfigHelp,
  cleanupSessions,
  finalizeAllSessions,
  handleAuth,
  setCorsHeaders,
  handlePreflight,
  generateStartupBanner,
} = require('../../src/serverHelpers')

describe('Server Helpers', () => {
  describe('validateConfig', () => {
    test('returns empty array for valid config', () => {
      const config = {
        langfuse: {
          publicKey: 'test-public',
          secretKey: 'test-secret',
        },
        port: 4318,
      }

      const errors = validateConfig(config)
      expect(errors).toEqual([])
    })

    test('returns errors for missing Langfuse keys', () => {
      const config = {
        langfuse: {
          publicKey: '',
          secretKey: '',
        },
        port: 4318,
      }

      const errors = validateConfig(config)
      expect(errors).toContain('LANGFUSE_PUBLIC_KEY is required')
      expect(errors).toContain('LANGFUSE_SECRET_KEY is required')
    })

    test('returns error for invalid port', () => {
      const config = {
        langfuse: {
          publicKey: 'test',
          secretKey: 'test',
        },
        port: 70000,
      }

      const errors = validateConfig(config)
      expect(errors).toContain('OTLP_RECEIVER_PORT must be between 1 and 65535')
    })
  })

  describe('createConfig', () => {
    let originalEnv

    beforeEach(() => {
      originalEnv = { ...process.env }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    test('creates config with default values', () => {
      const config = createConfig()

      expect(config).toMatchObject({
        port: 4318,
        host: '127.0.0.1',
        sessionTimeout: 3600000, // 1 hour
        maxRequestSize: 10485760,
        langfuse: {
          publicKey: '',
          secretKey: '',
          baseUrl: 'http://localhost:3000',
          flushAt: 20,
          flushInterval: 10000,
        },
        retryAttempts: 3,
        nodeEnv: expect.any(String), // Can be 'test' or 'production'
        logLevel: 'info',
      })
    })

    test('creates config from environment variables', () => {
      process.env.OTLP_RECEIVER_PORT = '5000'
      process.env.OTLP_RECEIVER_HOST = '0.0.0.0'
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test'
      process.env.LANGFUSE_SECRET_KEY = 'sk-test'
      process.env.API_KEY = 'test-api-key'

      const config = createConfig()

      expect(config.port).toBe(5000)
      expect(config.host).toBe('0.0.0.0')
      expect(config.langfuse.publicKey).toBe('pk-test')
      expect(config.langfuse.secretKey).toBe('sk-test')
      expect(config.apiKey).toBe('test-api-key')
    })
  })

  describe('cleanupSessions', () => {
    test('removes expired sessions', async () => {
      const mockSession1 = {
        lastActivity: Date.now() - 400000, // 400 seconds ago
        finalize: jest.fn().mockResolvedValue(undefined),
      }
      const mockSession2 = {
        lastActivity: Date.now() - 100000, // 100 seconds ago
        finalize: jest.fn().mockResolvedValue(undefined),
      }

      const sessions = new Map([
        ['session-1', mockSession1],
        ['session-2', mockSession2],
      ])

      const cleaned = await cleanupSessions(sessions, 300000) // 5 minute timeout

      expect(cleaned).toEqual(['session-1'])
      expect(mockSession1.finalize).toHaveBeenCalled()
      expect(mockSession2.finalize).not.toHaveBeenCalled()
      expect(sessions.size).toBe(1)
      expect(sessions.has('session-2')).toBe(true)
    })

    test('handles finalize errors gracefully', async () => {
      const mockSession = {
        lastActivity: Date.now() - 400000,
        finalize: jest.fn().mockRejectedValue(new Error('Finalize failed')),
      }

      const sessions = new Map([
        ['session-1', mockSession],
      ])

      const cleaned = await cleanupSessions(sessions, 300000)

      expect(cleaned).toEqual(['session-1'])
      expect(sessions.size).toBe(0)
    })
  })

  describe('finalizeAllSessions', () => {
    test('finalizes all sessions', async () => {
      const mockSession1 = {
        finalize: jest.fn().mockResolvedValue(undefined),
      }
      const mockSession2 = {
        finalize: jest.fn().mockResolvedValue(undefined),
      }

      const sessions = new Map([
        ['session-1', mockSession1],
        ['session-2', mockSession2],
      ])

      await finalizeAllSessions(sessions)

      expect(mockSession1.finalize).toHaveBeenCalled()
      expect(mockSession2.finalize).toHaveBeenCalled()
    })

    test('handles finalize errors', async () => {
      const mockSession = {
        finalize: jest.fn().mockRejectedValue(new Error('Finalize failed')),
      }

      const sessions = new Map([
        ['session-1', mockSession],
      ])

      await finalizeAllSessions(sessions)

      expect(mockSession.finalize).toHaveBeenCalled()
    })
  })

  describe('handleAuth', () => {
    test('returns true when no API key configured', () => {
      const req = { headers: {} }
      const res = {
        writeHead: jest.fn(),
        end: jest.fn(),
      }

      const result = handleAuth(req, res, null)

      expect(result).toBe(true)
      expect(res.writeHead).not.toHaveBeenCalled()
    })

    test('returns true with valid authorization', () => {
      const req = {
        headers: {
          authorization: 'Bearer test-api-key',
        },
      }
      const res = {
        writeHead: jest.fn(),
        end: jest.fn(),
      }

      const result = handleAuth(req, res, 'test-api-key')

      expect(result).toBe(true)
      expect(res.writeHead).not.toHaveBeenCalled()
    })

    test('returns false with invalid authorization', () => {
      const req = {
        headers: {
          authorization: 'Bearer wrong-key',
        },
      }
      const res = {
        writeHead: jest.fn(),
        end: jest.fn(),
      }

      const result = handleAuth(req, res, 'test-api-key')

      expect(result).toBe(false)
      expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' })
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Unauthorized' }))
    })

    test('returns false with missing authorization', () => {
      const req = { headers: {} }
      const res = {
        writeHead: jest.fn(),
        end: jest.fn(),
      }

      const result = handleAuth(req, res, 'test-api-key')

      expect(result).toBe(false)
      expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' })
    })
  })

  describe('setCorsHeaders', () => {
    test('sets all CORS headers', () => {
      const res = {
        setHeader: jest.fn(),
      }

      setCorsHeaders(res)

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    })
  })

  describe('handlePreflight', () => {
    test('handles OPTIONS request', () => {
      const req = { method: 'OPTIONS' }
      const res = {
        writeHead: jest.fn(),
        end: jest.fn(),
      }

      const handled = handlePreflight(req, res)

      expect(handled).toBe(true)
      expect(res.writeHead).toHaveBeenCalledWith(204)
      expect(res.end).toHaveBeenCalled()
    })

    test('ignores non-OPTIONS request', () => {
      const req = { method: 'POST' }
      const res = {
        writeHead: jest.fn(),
        end: jest.fn(),
      }

      const handled = handlePreflight(req, res)

      expect(handled).toBe(false)
      expect(res.writeHead).not.toHaveBeenCalled()
    })
  })

  describe('generateStartupBanner', () => {
    test('generates banner with config values', () => {
      const config = {
        host: 'localhost',
        port: 4318,
        langfuse: {
          baseUrl: 'http://langfuse.local',
        },
      }

      const banner = generateStartupBanner(config)

      expect(banner).toContain('http://localhost:4318')
      expect(banner).toContain('http://langfuse.local')
      expect(banner).toContain('export CLAUDE_CODE_ENABLE_TELEMETRY=1')
      expect(banner).toContain('export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318')
    })
  })

  describe('printConfigHelp', () => {
    test('prints configuration help', () => {
      // Just verify it runs without error
      expect(() => printConfigHelp()).not.toThrow()
    })
  })
})
