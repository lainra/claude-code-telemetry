/**
 * Unit tests for helper functions
 * These tests do not require a running server
 */

describe('Helper Functions', () => {
  describe('extractAttributeValue', () => {
    // Mock the extractAttributeValue function behavior
    const extractAttributeValue = (value) => {
      if (value.stringValue !== undefined) return value.stringValue
      if (value.intValue !== undefined) return parseInt(value.intValue)
      if (value.doubleValue !== undefined) return parseFloat(value.doubleValue)
      if (value.boolValue !== undefined) return value.boolValue
      if (value.arrayValue !== undefined) {
        return value.arrayValue.values.map(v => extractAttributeValue(v))
      }
      if (value.kvlistValue !== undefined) {
        const obj = {}
        for (const kv of value.kvlistValue.values) {
          obj[kv.key] = extractAttributeValue(kv.value)
        }
        return obj
      }
      return null
    }

    test('extracts string values', () => {
      const value = { stringValue: 'hello' }
      expect(extractAttributeValue(value)).toBe('hello')
    })

    test('extracts integer values', () => {
      const value = { intValue: '42' }
      expect(extractAttributeValue(value)).toBe(42)
    })

    test('extracts double values', () => {
      const value = { doubleValue: '3.14' }
      expect(extractAttributeValue(value)).toBeCloseTo(3.14)
    })

    test('extracts boolean values', () => {
      expect(extractAttributeValue({ boolValue: true })).toBe(true)
      expect(extractAttributeValue({ boolValue: false })).toBe(false)
    })

    test('extracts array values', () => {
      const value = {
        arrayValue: {
          values: [
            { stringValue: 'a' },
            { stringValue: 'b' },
            { intValue: '1' },
          ],
        },
      }
      expect(extractAttributeValue(value)).toEqual(['a', 'b', 1])
    })

    test('extracts object values', () => {
      const value = {
        kvlistValue: {
          values: [
            { key: 'name', value: { stringValue: 'test' } },
            { key: 'count', value: { intValue: '5' } },
          ],
        },
      }
      expect(extractAttributeValue(value)).toEqual({
        name: 'test',
        count: 5,
      })
    })

    test('returns null for unknown types', () => {
      expect(extractAttributeValue({})).toBeNull()
    })
  })

  describe('calculatePercentiles', () => {
    const calculatePercentiles = (data) => {
      if (!data || data.length === 0) return null
      const sorted = [...data].sort((a, b) => a - b)
      return {
        count: data.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: Math.round(data.reduce((a, b) => a + b, 0) / data.length),
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      }
    }

    test('calculates percentiles correctly', () => {
      const data = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
      const result = calculatePercentiles(data)

      expect(result).toEqual({
        count: 10,
        min: 100,
        max: 1000,
        avg: 550,
        p50: 600,
        p95: 1000,
        p99: 1000,
      })
    })

    test('handles empty data', () => {
      expect(calculatePercentiles([])).toBeNull()
      expect(calculatePercentiles(null)).toBeNull()
    })

    test('handles single value', () => {
      const result = calculatePercentiles([100])
      expect(result).toEqual({
        count: 1,
        min: 100,
        max: 100,
        avg: 100,
        p50: 100,
        p95: 100,
        p99: 100,
      })
    })
  })

  describe('Configuration Validation', () => {
    test('validates port range', () => {
      const isValidPort = (port) => port >= 1 && port <= 65535

      expect(isValidPort(4318)).toBe(true)
      expect(isValidPort(80)).toBe(true)
      expect(isValidPort(0)).toBe(false)
      expect(isValidPort(70000)).toBe(false)
      expect(isValidPort(-1)).toBe(false)
    })

    test('validates required environment variables', () => {
      const validateConfig = (config) => {
        const errors = []

        if (!config.publicKey || config.publicKey === 'your-langfuse-public-key') {
          errors.push('LANGFUSE_PUBLIC_KEY is required')
        }
        if (!config.secretKey || config.secretKey === 'your-langfuse-secret-key') {
          errors.push('LANGFUSE_SECRET_KEY is required')
        }

        return errors
      }

      expect(validateConfig({ publicKey: 'pk-test', secretKey: 'sk-test' })).toEqual([])
      expect(validateConfig({ publicKey: '', secretKey: 'sk-test' })).toContain('LANGFUSE_PUBLIC_KEY is required')
      expect(validateConfig({ publicKey: 'pk-test', secretKey: '' })).toContain('LANGFUSE_SECRET_KEY is required')
    })
  })

  describe('Session ID Generation', () => {
    test('generates valid session ID from user and timestamp', () => {
      const generateSessionId = (userId, timestamp) => {
        const timeWindow = new Date(timestamp).toISOString().substring(0, 13)
        return `${userId}-${timeWindow}`.replace(/[^a-zA-Z0-9-]/g, '-')
      }

      const timestamp = '2024-01-15T10:30:45.123Z'
      const sessionId = generateSessionId('test@example.com', timestamp)

      expect(sessionId).toBe('test-example-com-2024-01-15T10')
      expect(sessionId).toMatch(/^[a-zA-Z0-9-]+$/)
    })
  })
})
