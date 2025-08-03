# Claude Code Telemetry - Development Guide

This guide helps you quickly understand and resume work on the telemetry bridge.

## 🏗️ Project Overview

**Purpose**: Bridge that captures Claude Code's telemetry and forwards to Langfuse for LLM observability.

**Architecture**:
```
Claude Code → OTLP/HTTP → Bridge Server → Langfuse API
             (JSON logs)   (Parse & Map)   (Traces/Spans)
```

**Quick Setup**: Run `./quickstart.sh` for a complete setup with:
- Langfuse stack (PostgreSQL, ClickHouse, Redis, MinIO)
- Unique credentials generated automatically
- Telemetry bridge configured and ready

**Key Modules**:
- `src/server.js` - Main OTLP server (port 4318)
- `src/sessionHandler.js` - Session lifecycle management
- `src/eventProcessor.js` - Maps Claude events to Langfuse
- `src/metricsProcessor.js` - Handles cost/token metrics
- `src/requestHandlers.js` - HTTP request processing
- `src/serverHelpers.js` - Server utilities

## 🚨 Critical Knowledge

### Claude's Non-Standard OTLP Implementation

**MUST REMEMBER**: Claude Code does NOT follow OpenTelemetry defaults!

1. **No default endpoint** - `OTEL_EXPORTER_OTLP_ENDPOINT` must be explicitly set
2. **All 6 env vars required** - No partial configuration works
3. **JSON only** - Protobuf not supported
4. **Custom event names** - Uses `claude_code.*` namespace

### Required Environment Variables (All 6)
```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318  # NO DEFAULT!
```

### Standard Attributes on All Events/Metrics
- `session.id` - Unique session identifier
- `organization.id` - Organization UUID
- `user.account_uuid` - User account UUID  
- `user.email` - User email address
- `terminal.type` - Terminal type (e.g., "vscode")
- `app.version` - Claude Code version

## 📊 Data Flow

### Events (via Logs)
1. `claude_code.user_prompt` - User input received
   - Contains: prompt, prompt_length, event.timestamp
2. `claude_code.api_request` - Model calls (Haiku + Opus)
   - Contains: model, tokens (input/output/cache), cost, duration, request_id
3. `claude_code.tool_result` - Tool execution results
   - Contains: tool_name, success, duration_ms
4. `claude_code.api_error` - Failed API calls
   - Contains: error_message, status_code, model
5. `claude_code.tool_decision` - Tool permission decisions
   - Contains: decision, source, tool_name

### Metrics
- `claude_code.cost.usage` - USD per model
- `claude_code.token.usage` - Token breakdown (input/output/cacheRead/cacheCreation)
- `claude_code.lines_of_code.count` - Code changes (added/removed)
- `claude_code.commit.count` - Git commits
- `claude_code.pull_request.count` - PRs created
- `claude_code.code_edit_tool.decision` - Tool accept/reject decisions
- `claude_code.active_time.total` - Active interaction time
- `claude_code.session.count` - Session starts

### Session Lifecycle
- Auto-created on first event
- 1-hour timeout for cleanup (configurable via SESSION_TIMEOUT)
- Tracks: total cost, tokens, cache usage, tool usage, code changes
- Creates session summary with quality and efficiency scores

### Langfuse Mapping
- **Traces**: One per conversation + session summary
- **Generations**: For each API call with full token/cost data
- **Events**: For tools, decisions, errors, and milestones
- **Scores**: Quality and efficiency on session summary

## 🧪 Testing

### Test Structure
```
test/
├── unit/           # Mocked tests - fast, isolated
├── integration/    # Real Langfuse API tests
└── helpers/        # Test utilities and clients
```

### Running Tests
```bash
# Unit tests only (no external dependencies)
npm run test:unit

# Integration tests (requires Langfuse)
export LANGFUSE_PUBLIC_KEY=xxx
export LANGFUSE_SECRET_KEY=xxx
npm run test:integration

# All tests
npm test
```

### Manual Testing
```bash
# Terminal 1: Start server
npm start

# Terminal 2: Test with real Claude
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
export OTEL_LOG_USER_PROMPTS=1
claude "What is 2+2?"
```

### Integration Test Features
- **LangfuseTestClient**: Direct API access for verification
- **OTLP Test Data Builders**: Consistent test fixtures
- **E2E Tests**: Run real Claude commands
- **Validation Helpers**: Comprehensive data checking

## 🐛 Debugging

### No Telemetry Received
1. Verify ALL 6 env vars set (use server startup banner)
2. Check endpoint has no typos (common: missing http://)
3. Confirm server health: `curl http://localhost:4318/health`
4. Enable debug: `LOG_LEVEL=debug npm start`

### Missing Data in Langfuse
- Run validation: `node test/helpers/validate-langfuse.js`
- Check for conversation traces vs session-summary traces
- Verify all standard attributes are present
- Ensure metrics are being sent (not just logs)

### Common Issues
- **No generations**: Check logs are being sent, not just metrics
- **No scores**: Created only on session finalization
- **Missing cache tokens**: Verify token metrics include all types
- **No events**: Tool usage creates events, simple prompts don't

### Langfuse Connection Issues
- Check `.env` has valid keys
- Verify `LANGFUSE_HOST` is correct
- Use `scripts/debug-generations.js` for manual testing

## 🔧 Development Workflow

### Making Changes
1. **Event Processing**: Edit `src/eventProcessor.js`
2. **Metrics**: Edit `src/metricsProcessor.js`
3. **Session Logic**: Edit `src/sessionHandler.js`
4. **Request Handling**: Edit `src/requestHandlers.js`
5. **New Endpoints**: Edit `src/server.js`

### Adding New Event Types
```javascript
// In eventProcessor.js
case 'claude_code.new_event':
  return processNewEvent(attrs, standardAttrs, timestamp, session)

// Don't forget to:
// 1. Extract standard attributes
// 2. Pass to session handler
// 3. Create appropriate Langfuse entities
```

### Testing Changes
1. Write unit test with mocks
2. Write integration test with real Langfuse
3. Test manually with Claude (see Quick Commands)
4. Check Langfuse dashboard for results

## 📝 Recent Changes & Context

### Major Refactoring (Latest)
1. **Comprehensive telemetry capture** - All Claude Code events and metrics
2. **Fixed Langfuse SDK usage** - Use traceId, not parentObservationId
3. **True integration tests** - Test with real Langfuse API
4. **Modular architecture** - Separated concerns for testability
5. **Complete metadata tracking** - Organization, user, terminal info
6. **Cache token support** - Track cache read/creation separately

### Architecture Decision
- **Stateful session management** is the correct approach
- Session aggregation provides the actual value customers need
- Complexity is worth it for actionable insights (costs, efficiency, productivity)
- Focus on making the aggregated data more valuable, not simpler

### Test Coverage
- **96%+ coverage** on business logic
- **Real integration tests** catch actual issues
- **E2E tests** validate full flow

### Known Limitations
- Sessions accumulate in memory (1-hour cleanup helps manage this)
- Some metrics rarely observed (PR count, active time)
- Session summary created on timeout or graceful shutdown

## 🎯 Future Improvements That Actually Matter

### Customer-Focused Features
1. **Cost Alerts**: Notify when session exceeds threshold
2. **Daily Reports**: Email summary of team AI usage
3. **Efficiency Tips**: "You could save 80% by using cache"
4. **Team Dashboard**: Compare developer AI efficiency
5. **ROI Calculator**: Hours saved vs dollars spent

### What NOT to Build
- Alternative architectures (stateless, event sourcing, etc.)
- Complex configuration options
- Multiple storage backends
- Theoretical performance optimizations

**Remember**: Customers need insights, not infrastructure.

## 💡 Quick Commands

```bash
# Full setup with Langfuse included
./quickstart.sh

# Start standalone server (requires existing Langfuse)
npm start

# Manage Langfuse services
./scripts/langfuse up    # Start
./scripts/langfuse down  # Stop
./scripts/langfuse logs  # View logs

# Run tests
npm test                      # All tests
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests (needs Langfuse)

# Test with real Claude
source claude-telemetry.env
claude "What is 2+2?"

# Debug mode
LOG_LEVEL=debug npm start

# Check what's running
lsof -i:4318

# Clean up everything
./scripts/cleanup-langfuse.sh
```

## 🔗 Key Resources

- [OpenTelemetry Spec](https://opentelemetry.io/docs/specs/otel/protocol/exporter/)
- [Langfuse SDK Docs](https://langfuse.com/docs/sdk/typescript)
- [Claude Code Telemetry Docs](https://docs.anthropic.com/en/docs/claude-code/monitoring-usage)
- [Langfuse API Reference](https://cloud.langfuse.com/generated/api/openapi.yml)

---

**Remember**: 
1. Claude's OTLP implementation is non-standard - no defaults!
2. Always test with real Claude binary when making changes
3. Integration tests are your friend - they catch real issues
4. Check all standard attributes are captured and forwarded
