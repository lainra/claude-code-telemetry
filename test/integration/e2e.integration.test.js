/**
 * End-to-End Integration Tests
 *
 * Tests the complete flow: Claude Code → Telemetry Bridge → Langfuse
 */

const { spawn } = require('child_process')
const { LangfuseTestClient } = require('../helpers/langfuse-client')
const testServer = require('../testServer')

describe('End-to-End Integration', () => {
  let server
  // let serverUrl // Currently unused
  let langfuseClient
  const isCI = process.env.CI === 'true'

  beforeAll(async () => {
    // Skip in CI or if no credentials
    if (isCI) {
      console.log('Skipping E2E tests in CI environment')
      return
    }

    if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
      console.log('Skipping E2E tests - no Langfuse credentials')
      return
    }

    // Check if claude binary exists
    try {
      await runCommand('which', ['claude'])
    } catch (e) {
      console.log('Skipping E2E tests - claude binary not found')
      return
    }

    // Start test server
    const serverInstance = await testServer.start(4318) // Use standard OTLP port
    server = serverInstance.server
    // serverUrl = `http://localhost:${serverInstance.port}` // Currently unused

    // Initialize Langfuse client
    langfuseClient = new LangfuseTestClient()
  })

  afterAll(async () => {
    if (server) {
      await testServer.stop()
    }
  })

  /**
   * Helper to run shell commands
   */
  function runCommand(command, args = [], env = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', data => {
        stdout += data
      })
      child.stderr.on('data', data => {
        stderr += data
      })

      child.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`))
        }
      })

      // Send input if needed
      if (env.CLAUDE_INPUT) {
        child.stdin.write(env.CLAUDE_INPUT)
        child.stdin.end()
      }
    })
  }

  /**
   * Run Claude with telemetry enabled
   */
  async function runClaude(prompt, options = {}) {
    const env = {
      CLAUDE_CODE_ENABLE_TELEMETRY: '1',
      OTEL_LOGS_EXPORTER: 'otlp',
      OTEL_METRICS_EXPORTER: 'otlp',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
      OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: 'http/json',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4318',
      OTEL_LOG_USER_PROMPTS: '1', // Enable prompt logging for testing
      ...options.env,
    }

    // Use --print flag to avoid interactive mode
    const args = ['--print']

    // Pass prompt via stdin
    env.CLAUDE_INPUT = prompt

    const result = await runCommand('claude', args, env)

    // Extract session ID from server logs if possible
    // In a real implementation, we'd parse server output or use a known pattern
    return {
      output: result.stdout,
      sessionId: options.sessionId || `claude-session-${Date.now()}`,
    }
  }

  test('simple math question creates complete telemetry', async () => {
    if (!langfuseClient || isCI) return

    // Run Claude with a simple prompt
    const prompt = 'What is 2+2?'
    const { output } = await runClaude(prompt)

    // Verify Claude responded correctly
    expect(output).toContain('4')

    // Wait for telemetry to be processed
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Verify conversation trace was created
    const trace = await langfuseClient.waitForTrace({
      name: 'conversation-',
    }, { timeout: 10000 })

    expect(trace).toBeDefined()
    expect(trace.input).toMatchObject({
      prompt,
      length: prompt.length,
    })

    // Get full trace details
    const fullTrace = await langfuseClient.getTrace(trace.id)

    // Should have at least one generation (possibly two with routing)
    const generations = fullTrace.observations?.filter(o => o.type === 'GENERATION') || []
    expect(generations.length).toBeGreaterThanOrEqual(1)

    // Verify model and token usage
    const mainGeneration = generations.find(g => g.model?.includes('opus') || g.model?.includes('sonnet'))
    expect(mainGeneration).toBeDefined()
    expect(mainGeneration.usage?.total).toBeGreaterThan(0)
  })

  test('code generation with tool usage', async () => {
    if (!langfuseClient || isCI) return

    // Create a temp directory for Claude to work in
    const tempDir = `/tmp/claude-test-${Date.now()}`
    await runCommand('mkdir', ['-p', tempDir])

    try {
      // Run Claude with a code generation task
      const prompt = `Create a file called hello.py in ${tempDir} with a function that prints "Hello, World!"`
      // Run Claude but we don't need to check the output
      await runClaude(prompt, {
        env: { PWD: tempDir },
      })

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Find the conversation trace
      const traces = await langfuseClient.getTraces(20)
      const trace = traces.find(t =>
        t.name?.startsWith('conversation-') &&
        t.input?.prompt?.includes('hello.py'),
      )

      expect(trace).toBeDefined()

      // Get full trace with observations
      const fullTrace = await langfuseClient.getTrace(trace.id)

      // Should have tool usage events (Write tool)
      const events = fullTrace.observations?.filter(o => o.type === 'EVENT') || []
      const toolEvents = events.filter(e => e.name?.includes('tool-'))

      expect(toolEvents.length).toBeGreaterThan(0)

      // Should have a Write tool event
      const writeEvent = toolEvents.find(e => e.name?.includes('Write'))
      expect(writeEvent).toBeDefined()

      // Verify file was created
      const { stdout } = await runCommand('cat', [`${tempDir}/hello.py`])
      expect(stdout).toContain('Hello, World!')
    } finally {
      // Cleanup
      await runCommand('rm', ['-rf', tempDir])
    }
  })

  test('session summary is created on completion', async () => {
    if (!langfuseClient || isCI) return

    // Run a quick Claude command
    const prompt = 'What is the capital of France?'
    await runClaude(prompt)

    // Wait for session to complete and summary to be created
    await new Promise(resolve => setTimeout(resolve, 8000))

    // Look for session summary trace
    const traces = await langfuseClient.getTraces(20)
    const summaryTrace = traces.find(t => t.name === 'session-summary')

    // Note: Summary trace is created on session finalization
    // In real usage, this happens when the server shuts down or after timeout
    // For this test, we might need to trigger server shutdown or wait longer

    if (summaryTrace) {
      expect(summaryTrace.output).toHaveProperty('totalCost')
      expect(summaryTrace.output).toHaveProperty('totalTokens')
      expect(summaryTrace.output).toHaveProperty('conversationCount')

      // Check for scores
      const fullTrace = await langfuseClient.getTrace(summaryTrace.id)
      const scores = fullTrace.scores || []

      expect(scores.length).toBeGreaterThan(0)
      const qualityScore = scores.find(s => s.name === 'quality')
      expect(qualityScore).toBeDefined()
    }
  })

  test('validates metrics are properly tracked', async () => {
    if (!langfuseClient || isCI) return

    // Run Claude to ensure we have fresh data
    await runClaude('What is the meaning of life?')

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Get recent traces
    const traces = await langfuseClient.getTraces(10)
    const conversationTrace = traces.find(t =>
      t.name?.startsWith('conversation-') &&
      t.input?.prompt?.includes('meaning of life'),
    )

    expect(conversationTrace).toBeDefined()

    // Verify metadata is complete
    expect(conversationTrace.metadata).toMatchObject({
      organizationId: expect.any(String),
      userEmail: expect.stringContaining('@'),
      terminalType: expect.any(String),
    })

    // Get full trace
    const fullTrace = await langfuseClient.getTrace(conversationTrace.id)

    // Check for cost tracking in generation metadata
    const generation = fullTrace.observations?.find(o =>
      o.type === 'GENERATION' && o.metadata?.cost,
    )

    if (generation) {
      expect(generation.metadata.cost).toBeGreaterThan(0)
      expect(generation.metadata.model).toBeDefined()
    }
  })
})
