const fs = require('fs')
const path = require('path')

const DEFAULT_PATH = path.join(process.env.HOME || '/tmp', '.claude', 'telemetry-fallback.jsonl')

function getFallbackPath() {
  return process.env.FALLBACK_FILE || DEFAULT_PATH
}

function writeReference(session) {
  const ref = {
    sessionId: session.sessionId,
    userId: session.metadata?.userId,
    organizationId: session.organizationId,
    userAccountUuid: session.userAccountUuid,
    createdAt: session.createdAt?.toISOString(),
    failedAt: new Date().toISOString(),
    stats: {
      conversationCount: session.conversationCount,
      apiCallCount: session.apiCallCount,
      totalTokens: session.totalTokens,
      totalCost: session.totalCost,
    },
  }

  const dir = path.dirname(getFallbackPath())
  fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(getFallbackPath(), JSON.stringify(ref) + '\n')
  return ref
}

module.exports = { writeReference, getFallbackPath }
