#!/usr/bin/env node

/**
 * Comprehensive validation script for Langfuse integration
 * Validates all Claude Code telemetry data is properly captured
 */

const https = require('https')
const http = require('http')
require('dotenv').config()

const LANGFUSE_HOST = process.env.LANGFUSE_HOST || 'http://localhost:3000'
const PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY
const SECRET_KEY = process.env.LANGFUSE_SECRET_KEY

if (!PUBLIC_KEY || !SECRET_KEY) {
  console.error('❌ Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY in .env')
  process.exit(1)
}

const auth = Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString('base64')

function langfuseRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, LANGFUSE_HOST)
    const client = url.protocol === 'https:' ? https : http

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
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
            reject(new Error(`API Error ${res.statusCode}: ${json.message || data}`))
          } else {
            resolve(json)
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.end()
  })
}

async function validateComprehensive() {
  console.log('\n🔍 Comprehensive Langfuse Validation')
  console.log('=====================================\n')

  const validationResults = {
    sessions: { found: false, details: {} },
    traces: { found: false, conversation: false, sessionSummary: false },
    observations: { generations: 0, events: 0, spans: 0 },
    metadata: { organization: false, user: false, terminal: false, cache: false },
    metrics: { cost: false, tokens: false, tools: false, code: false },
    scores: { quality: false, efficiency: false },
  }

  try {
    // 1. Check Sessions
    console.log('1️⃣  Validating Sessions...')
    const sessions = await langfuseRequest('/api/public/sessions?limit=5')
    validationResults.sessions.found = sessions.data?.length > 0

    if (sessions.data?.length > 0) {
      const latestSession = sessions.data[0]
      validationResults.sessions.details = {
        id: latestSession.id,
        userId: latestSession.userId,
        createdAt: latestSession.createdAt,
      }
      console.log(`   ✅ Found ${sessions.data.length} sessions`)
      console.log(`   📋 Latest: ${latestSession.id}`)
    } else {
      console.log('   ❌ No sessions found')
    }

    // 2. Check Traces
    console.log('\n2️⃣  Validating Traces...')
    const traces = await langfuseRequest('/api/public/traces?limit=20')
    validationResults.traces.found = traces.data?.length > 0

    if (traces.data?.length > 0) {
      // Check for conversation traces
      const conversationTrace = traces.data.find(t => t.name?.startsWith('conversation-'))
      validationResults.traces.conversation = !!conversationTrace

      // Check for session-summary trace
      const summaryTrace = traces.data.find(t => t.name === 'session-summary')
      validationResults.traces.sessionSummary = !!summaryTrace

      console.log(`   ✅ Found ${traces.data.length} traces`)
      console.log(`   ${conversationTrace ? '✅' : '❌'} Conversation traces`)
      console.log(`   ${summaryTrace ? '✅' : '❌'} Session summary trace`)

      // Analyze a conversation trace in detail
      if (conversationTrace) {
        console.log(`\n3️⃣  Analyzing conversation trace: ${conversationTrace.name}`)
        const traceDetails = await langfuseRequest(`/api/public/traces/${conversationTrace.id}`)

        // Check metadata
        const metadata = traceDetails.metadata || {}
        validationResults.metadata.organization = !!metadata.organizationId
        validationResults.metadata.user = !!(metadata.userAccountUuid || metadata.userEmail)
        validationResults.metadata.terminal = !!metadata.terminalType

        console.log(`   ${metadata.organizationId ? '✅' : '❌'} Organization ID: ${metadata.organizationId || 'missing'}`)
        console.log(`   ${metadata.userAccountUuid ? '✅' : '❌'} User Account UUID: ${metadata.userAccountUuid || 'missing'}`)
        console.log(`   ${metadata.terminalType ? '✅' : '❌'} Terminal Type: ${metadata.terminalType || 'missing'}`)

        // Check observations
        const observations = traceDetails.observations || []
        const generations = observations.filter(o => o.type === 'GENERATION')
        const events = observations.filter(o => o.type === 'EVENT')
        const spans = observations.filter(o => o.type === 'SPAN')

        validationResults.observations.generations = generations.length
        validationResults.observations.events = events.length
        validationResults.observations.spans = spans.length

        console.log('\n   📊 Observations:')
        console.log(`      ${generations.length > 0 ? '✅' : '❌'} Generations: ${generations.length}`)
        console.log(`      ${events.length > 0 ? '✅' : '❌'} Events: ${events.length}`)
        console.log(`      ${spans.length > 0 ? '✅' : '❌'} Spans: ${spans.length}`)

        // Check generation details
        if (generations.length > 0) {
          const gen = generations[0]
          validationResults.metadata.cache = !!(gen.metadata?.cache?.read !== undefined)
          validationResults.metrics.cost = !!gen.metadata?.cost
          validationResults.metrics.tokens = !!gen.usage?.total

          console.log('\n   🤖 Generation details:')
          console.log(`      Model: ${gen.model}`)
          console.log(`      ${gen.usage?.total ? '✅' : '❌'} Token usage: ${gen.usage?.input || 0} in, ${gen.usage?.output || 0} out`)
          console.log(`      ${gen.metadata?.cache ? '✅' : '❌'} Cache tokens: ${gen.metadata?.cache?.read || 0} read, ${gen.metadata?.cache?.creation || 0} creation`)
          console.log(`      ${gen.metadata?.cost ? '✅' : '❌'} Cost: $${gen.metadata?.cost || 0}`)
        }

        // Check events
        if (events.length > 0) {
          const eventTypes = [...new Set(events.map(e => e.name))]
          console.log(`\n   📌 Event types: ${eventTypes.join(', ')}`)

          validationResults.metrics.tools = eventTypes.some(e => e.includes('tool'))
          validationResults.metrics.code = eventTypes.some(e => e.includes('code'))
        }
      }

      // Check session summary trace
      if (summaryTrace) {
        console.log('\n4️⃣  Analyzing session summary...')
        const summaryDetails = await langfuseRequest(`/api/public/traces/${summaryTrace.id}`)

        // Check scores
        const scores = summaryDetails.scores || []
        validationResults.scores.quality = scores.some(s => s.name === 'quality')
        validationResults.scores.efficiency = scores.some(s => s.name === 'efficiency')

        console.log(`   ${scores.length > 0 ? '✅' : '❌'} Scores: ${scores.length} found`)
        scores.forEach(score => {
          console.log(`      - ${score.name}: ${score.value} - ${score.comment || 'No comment'}`)
        })

        // Check output metrics
        const output = summaryTrace.output || {}
        console.log('\n   📊 Session metrics:')
        console.log(`      Conversations: ${output.conversationCount || 0}`)
        console.log(`      API calls: ${output.apiCallCount || 0}`)
        console.log(`      Tool calls: ${output.toolCallCount || 0}`)
        console.log(`      Total cost: $${output.totalCost || 0}`)
        console.log(`      Total tokens: ${output.totalTokens || 0}`)

        if (output.cacheTokens) {
          console.log(`      Cache tokens: ${output.cacheTokens.read || 0} read, ${output.cacheTokens.creation || 0} creation`)
        }

        if (output.additionalMetrics) {
          console.log('\n   📈 Additional metrics:')
          console.log(`      Active time: ${output.additionalMetrics.activeTime || 0}s`)
          console.log(`      Commits: ${output.additionalMetrics.commitCount || 0}`)
          console.log(`      Pull requests: ${output.additionalMetrics.pullRequestCount || 0}`)
          console.log(`      Tool decisions: ${output.additionalMetrics.toolDecisions?.length || 0}`)
        }
      }
    }

    // Final validation summary
    console.log('\n\n📋 VALIDATION SUMMARY')
    console.log('====================')

    const checks = [
      { name: 'Sessions created', passed: validationResults.sessions.found },
      { name: 'Conversation traces', passed: validationResults.traces.conversation },
      { name: 'Session summary trace', passed: validationResults.traces.sessionSummary },
      { name: 'API generations tracked', passed: validationResults.observations.generations > 0 },
      { name: 'Events captured', passed: validationResults.observations.events > 0 },
      { name: 'Organization metadata', passed: validationResults.metadata.organization },
      { name: 'User metadata', passed: validationResults.metadata.user },
      { name: 'Terminal type', passed: validationResults.metadata.terminal },
      { name: 'Cache tokens tracked', passed: validationResults.metadata.cache },
      { name: 'Cost metrics', passed: validationResults.metrics.cost },
      { name: 'Token metrics', passed: validationResults.metrics.tokens },
      { name: 'Tool events', passed: validationResults.metrics.tools },
      { name: 'Quality score', passed: validationResults.scores.quality },
      { name: 'Efficiency score', passed: validationResults.scores.efficiency },
    ]

    const passed = checks.filter(c => c.passed).length
    const total = checks.length

    checks.forEach(check => {
      console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}`)
    })

    console.log(`\n   Score: ${passed}/${total} (${Math.round(passed / total * 100)}%)`)

    if (passed === total) {
      console.log('\n   🎉 ALL VALIDATIONS PASSED!')
    } else {
      console.log('\n   ⚠️  Some validations failed. Check the details above.')
    }
  } catch (error) {
    console.error(`\n❌ Validation failed: ${error.message}`)
    console.error('\nMake sure:')
    console.error('1. Langfuse is running at', LANGFUSE_HOST)
    console.error('2. Your credentials are correct')
    console.error('3. The telemetry bridge is running')
    console.error('4. You have run Claude with telemetry enabled')
  }
}

// Run validation
validateComprehensive().catch(console.error)
