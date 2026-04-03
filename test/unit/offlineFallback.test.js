const fs = require('fs')
const path = require('path')
const os = require('os')

const { writeReference, getFallbackPath } = require('../../src/offlineFallback')

describe('offlineFallback', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fallback-test-'))
    process.env.FALLBACK_FILE = path.join(tmpDir, 'test-fallback.jsonl')
  })

  afterEach(() => {
    delete process.env.FALLBACK_FILE
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('getFallbackPath', () => {
    test('returns FALLBACK_FILE env var when set', () => {
      process.env.FALLBACK_FILE = '/custom/path.jsonl'
      expect(getFallbackPath()).toBe('/custom/path.jsonl')
    })

    test('returns default path when env var is not set', () => {
      delete process.env.FALLBACK_FILE
      const expected = path.join(process.env.HOME || '/tmp', '.claude', 'telemetry-fallback.jsonl')
      expect(getFallbackPath()).toBe(expected)
    })
  })

  describe('writeReference', () => {
    test('writes a session reference as JSONL', () => {
      const session = {
        sessionId: 'sess-123',
        metadata: { userId: 'user-1' },
        organizationId: 'org-1',
        userAccountUuid: 'uuid-1',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        conversationCount: 5,
        apiCallCount: 10,
        totalTokens: 5000,
        totalCost: 1.23,
      }

      const ref = writeReference(session)

      expect(ref.sessionId).toBe('sess-123')
      expect(ref.userId).toBe('user-1')
      expect(ref.organizationId).toBe('org-1')
      expect(ref.userAccountUuid).toBe('uuid-1')
      expect(ref.createdAt).toBe('2025-01-01T00:00:00.000Z')
      expect(ref.failedAt).toBeDefined()
      expect(ref.stats.conversationCount).toBe(5)
      expect(ref.stats.apiCallCount).toBe(10)
      expect(ref.stats.totalTokens).toBe(5000)
      expect(ref.stats.totalCost).toBe(1.23)

      const content = fs.readFileSync(getFallbackPath(), 'utf8')
      const parsed = JSON.parse(content.trim())
      expect(parsed.sessionId).toBe('sess-123')
    })

    test('creates directory if it does not exist', () => {
      const nestedPath = path.join(tmpDir, 'nested', 'dir', 'fallback.jsonl')
      process.env.FALLBACK_FILE = nestedPath

      writeReference({
        sessionId: 'sess-1',
        conversationCount: 0,
        apiCallCount: 0,
        totalTokens: 0,
        totalCost: 0,
      })

      expect(fs.existsSync(nestedPath)).toBe(true)
    })

    test('appends multiple references as separate lines', () => {
      const session1 = {
        sessionId: 'sess-1',
        conversationCount: 1,
        apiCallCount: 1,
        totalTokens: 100,
        totalCost: 0.1,
      }
      const session2 = {
        sessionId: 'sess-2',
        conversationCount: 2,
        apiCallCount: 2,
        totalTokens: 200,
        totalCost: 0.2,
      }

      writeReference(session1)
      writeReference(session2)

      const lines = fs.readFileSync(getFallbackPath(), 'utf8').trim().split('\n')
      expect(lines).toHaveLength(2)
      expect(JSON.parse(lines[0]).sessionId).toBe('sess-1')
      expect(JSON.parse(lines[1]).sessionId).toBe('sess-2')
    })

    test('handles missing metadata gracefully', () => {
      const session = {
        sessionId: 'sess-no-meta',
        conversationCount: 0,
        apiCallCount: 0,
        totalTokens: 0,
        totalCost: 0,
      }

      const ref = writeReference(session)
      expect(ref.userId).toBeUndefined()
      expect(ref.createdAt).toBeUndefined()
    })
  })
})
