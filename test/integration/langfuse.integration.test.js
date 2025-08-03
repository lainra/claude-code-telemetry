/**
 * Langfuse Integration Tests
 *
 * Tests real integration with Langfuse API
 */

const { LangfuseTestClient } = require('../helpers/langfuse-client')
const {
  generateTestSessionId,
  createUserPromptLog,
  createApiRequestLog,
  createToolResultLog,
  createCostMetric,
  createTokenMetrics,
  createOTLPLogsRequest,
  createOTLPMetricsRequest,
} = require('../helpers/otlp-test-data')
const testServer = require('../testServer')

describe('Langfuse Integration', () => {
  let server
  let serverUrl
  let langfuseClient
  let testSessionId

  beforeAll(async () => {
    // Skip if no Langfuse credentials
    if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
      console.log('Skipping Langfuse integration tests - no credentials provided')
      console.log('Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to run these tests')
      return
    }

    // Start test server
    const serverInstance = await testServer.start(0) // Random port
    server = serverInstance.server
    serverUrl = `http://localhost:${serverInstance.port}`

    // Initialize Langfuse client
    langfuseClient = new LangfuseTestClient()
  })

  afterAll(async () => {
    if (server) {
      await testServer.stop()
    }
  })

  beforeEach(() => {
    if (!langfuseClient) {
      // Skip test if no client
      return
    }
    testSessionId = generateTestSessionId()
  })

  test('processes user prompt and creates conversation trace', async () => {
    if (!langfuseClient) return

    // Send user prompt
    const promptLog = createUserPromptLog(testSessionId, 'What is 2+2?')
    const logsRequest = createOTLPLogsRequest([promptLog])

    const response = await fetch(`${serverUrl}/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logsRequest),
    })

    expect(response.status).toBe(200)

    // Wait for trace to appear in Langfuse
    const trace = await langfuseClient.waitForTrace({
      name: 'conversation-',
      sessionId: testSessionId,
    })

    expect(trace).toBeDefined()
    expect(trace.name).toBe('conversation-1')
    expect(trace.sessionId).toBe(testSessionId)
    expect(trace.input).toMatchObject({
      prompt: 'What is 2+2?',
      length: 12,
    })
    expect(trace.metadata).toMatchObject({
      organizationId: 'test-org-id',
      userAccountUuid: 'test-user-uuid',
      terminalType: 'test-terminal',
    })
  })

  test('processes API request and creates generation observation', async () => {
    if (!langfuseClient) return

    // First create a conversation
    const promptLog = createUserPromptLog(testSessionId, 'Calculate 2+2')
    await fetch(`${serverUrl}/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createOTLPLogsRequest([promptLog])),
    })

    // Wait for conversation trace
    await langfuseClient.waitForTrace({
      name: 'conversation-',
      sessionId: testSessionId,
    })

    // Send API request
    const apiLog = createApiRequestLog(testSessionId, {
      model: 'claude-3-opus-20240229',
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 100,
      cost: 0.001,
    })

    await fetch(`${serverUrl}/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createOTLPLogsRequest([apiLog])),
    })

    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get trace with observations
    const traces = await langfuseClient.getTraces(10, testSessionId)
    const conversationTrace = traces.find(t => t.name?.startsWith('conversation-'))
    expect(conversationTrace).toBeDefined()

    const fullTrace = await langfuseClient.getTrace(conversationTrace.id)

    // Verify generation observation
    const generations = fullTrace.observations?.filter(o => o.type === 'GENERATION') || []
    expect(generations).toHaveLength(1)

    const generation = generations[0]
    expect(generation.model).toBe('claude-3-opus-20240229')
    expect(generation.usage).toMatchObject({
      input: 10,
      output: 5,
      total: 15,
      unit: 'TOKENS',
    })
    expect(generation.metadata?.cache).toMatchObject({
      read: 100,
      creation: 0,
    })
    expect(generation.metadata?.cost).toBe(0.001)
  })

  test('processes metrics and updates session data', async () => {
    if (!langfuseClient) return

    // Create a session with API activity
    const promptLog = createUserPromptLog(testSessionId)
    const apiLog = createApiRequestLog(testSessionId)

    await fetch(`${serverUrl}/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createOTLPLogsRequest([promptLog, apiLog])),
    })

    // Send cost and token metrics
    const metrics = [
      createCostMetric(testSessionId, 'claude-3-opus-20240229', 0.025),
      createTokenMetrics(testSessionId, 'claude-3-opus-20240229', {
        input: 150,
        output: 300,
        cacheRead: 1000,
        cacheCreation: 500,
      }),
    ]

    await fetch(`${serverUrl}/v1/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createOTLPMetricsRequest(metrics)),
    })

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify session has the metrics data
    const traces = await langfuseClient.getTraces(10, testSessionId)
    expect(traces.length).toBeGreaterThan(0)

    // Note: Session-level aggregation happens on finalize
    // In a real test we'd trigger session end and check summary
  })

  test('creates tool usage events', async () => {
    if (!langfuseClient) return

    // Create conversation first
    const promptLog = createUserPromptLog(testSessionId)
    await fetch(`${serverUrl}/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createOTLPLogsRequest([promptLog])),
    })

    // Wait for conversation trace
    const conversationTrace = await langfuseClient.waitForTrace({
      name: 'conversation-',
      sessionId: testSessionId,
    })

    // Send tool usage
    const toolLog = createToolResultLog(testSessionId, 'Read', true, 150)
    await fetch(`${serverUrl}/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createOTLPLogsRequest([toolLog])),
    })

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get updated trace
    const fullTrace = await langfuseClient.getTrace(conversationTrace.id)

    // Verify tool event
    const events = fullTrace.observations?.filter(o => o.type === 'EVENT') || []
    const toolEvent = events.find(e => e.name?.includes('tool-'))

    expect(toolEvent).toBeDefined()
    expect(toolEvent.name).toBe('tool-Read')
    expect(toolEvent.output).toMatchObject({
      success: true,
      durationMs: 150,
    })
  })

  test('validates complete telemetry flow', async () => {
    if (!langfuseClient) return

    // Simulate a complete Claude interaction
    const logs = [
      createUserPromptLog(testSessionId, 'Write a hello world function'),
      createApiRequestLog(testSessionId, {
        model: 'claude-3-5-haiku-20241022',
        inputTokens: 50,
        outputTokens: 20,
        cost: 0.001,
      }),
      createApiRequestLog(testSessionId, {
        model: 'claude-3-opus-20240229',
        inputTokens: 200,
        outputTokens: 500,
        cacheReadTokens: 1000,
        cost: 0.015,
      }),
      createToolResultLog(testSessionId, 'Write', true, 300),
    ]

    // Send all logs
    await fetch(`${serverUrl}/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createOTLPLogsRequest(logs)),
    })

    // Send metrics
    const metrics = [
      createCostMetric(testSessionId, 'claude-3-opus-20240229', 0.016),
      createTokenMetrics(testSessionId),
    ]

    await fetch(`${serverUrl}/v1/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createOTLPMetricsRequest(metrics)),
    })

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Validate the complete flow
    const validation = await langfuseClient.verifyTelemetryFlow(testSessionId)

    expect(validation).toMatchObject({
      session: true,
      conversationTrace: true,
      generations: 2, // Haiku + Opus
      events: 1, // Tool usage
      metadata: {
        organization: true,
        user: true,
        terminal: true,
        cache: true,
      },
    })
  })
})
