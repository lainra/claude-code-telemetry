# Claude Code Telemetry Complete Guide

This guide consolidates all information about Claude Code's telemetry implementation, including events, metrics, and analysis from real testing.

## Table of Contents

1. [Overview](#overview)
2. [Environment Configuration](#environment-configuration)
3. [Events (Logs)](#events-logs)
4. [Metrics](#metrics)
5. [Implementation Coverage](#implementation-coverage)
6. [Real-World Examples](#real-world-examples)
7. [Troubleshooting](#troubleshooting)

## Overview

Claude Code uses OpenTelemetry (OTLP) to send telemetry data in two forms:
- **Logs**: Events like user prompts, API requests, tool usage
- **Metrics**: Numerical data like costs, tokens, code changes

The telemetry flows as follows:
```
Claude Code → OTLP/HTTP → Bridge Server → Langfuse API
             (JSON logs)   (Parse & Map)   (Traces/Spans)
```

## Environment Configuration

### Required Variables (All 6 Must Be Set)

```bash
# Master switch - enables all telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1

# Enable OTLP exporters
export OTEL_LOGS_EXPORTER=otlp         # For events
export OTEL_METRICS_EXPORTER=otlp      # For metrics

# Protocol MUST be http/json (not protobuf)
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json

# Endpoint MUST be set (Claude has NO default)
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
```

**CRITICAL**: Unlike OpenTelemetry spec, Claude Code does NOT default the endpoint to localhost:4318. You MUST set it explicitly.

### Optional Variables

```bash
# Specific endpoints (auto-derived from base endpoint if not set)
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://127.0.0.1:4318/v1/logs
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://127.0.0.1:4318/v1/metrics

# Include prompt text (privacy consideration)
export OTEL_LOG_USER_PROMPTS=1
```

## Events (Logs)

Claude sends events as OTLP log records with the event name in the body.

### Event Types

#### `claude_code.user_prompt`
- **When**: User sends a prompt to Claude
- **Attributes**:
  - `session.id`: Unique session identifier
  - `prompt`: User's input text (if `OTEL_LOG_USER_PROMPTS=1`)
  - `prompt_length`: Character count
  - `user.email`: User email if available

#### `claude_code.api_request`
- **When**: Claude makes API calls (typically 2 per prompt)
- **Models**: `claude-3-haiku` (routing), `claude-3-opus` or `claude-3-5-sonnet` (generation)
- **Attributes**:
  - `model`: Model name
  - `input_tokens`, `output_tokens`: Token counts (as strings)
  - `cost` or `cost_usd`: Cost in USD
  - `cache_read_tokens`, `cache_creation_tokens`: Cache token counts
  - `duration` or `duration_ms`: Response time in milliseconds
  - `request_id`: Unique request identifier
  - `api.response_time`: Alternative duration field

#### `claude_code.tool_result`
- **When**: Claude uses tools (Read, Write, Bash, etc.)
- **Attributes**:
  - `tool_name`: Tool name (or `tool` in legacy format)
  - `success`: Boolean result ("true"/"false" as string)
  - `duration_ms`: Execution time in milliseconds

#### `claude_code.tool_decision`
- **When**: User makes a decision about tool usage permissions
- **Attributes**:
  - `decision`: User's decision ("accept"/"reject")
  - `source`: Decision source ("user")
  - `tool_name`: Tool being decided on

#### `claude_code.api_error`
- **When**: API calls fail
- **Attributes**:
  - `model`: Model that failed
  - `error_message`: Error description
  - `status_code`: HTTP status

## Metrics

Metrics provide numerical measurements of Claude's operation.

### Confirmed Metrics (Received in Testing)

#### `claude_code.cost.usage`
- **Type**: Sum
- **Unit**: USD
- **Purpose**: Track API costs per model
- **Example**: Haiku: $0.006, Opus: $0.265

#### `claude_code.token.usage`
- **Type**: Sum
- **Unit**: tokens
- **Purpose**: Detailed token tracking
- **Attributes**:
  - `type`: `input`, `output`, `cacheRead`, `cacheCreation`
  - `model`: Model name

#### `claude_code.lines_of_code.count`
- **Type**: Sum
- **Unit**: lines
- **Purpose**: Track code modifications
- **Attributes**:
  - `type`: `added` or `removed`
- **Triggered**: When modifying files with Edit/Write tools

#### `claude_code.commit.count`
- **Type**: Sum
- **Unit**: commits
- **Purpose**: Track git commits created
- **Triggered**: When using `git commit` command

### Additional Metrics (Less Common)

These metrics are fully implemented and handled, but occur less frequently:

- `claude_code.session.count`: Session starts (sent when a new session begins)
- `claude_code.pull_request.count`: PR creations (when using `gh pr create`)
- `claude_code.code_edit_tool.decision`: Tool permission decisions (when user accepts/rejects tool usage)
- `claude_code.active_time.total`: Active usage time (tracks time spent in active conversation)

## Implementation Coverage

### Events - 100% Coverage ✅

| Event | Documentation | Observed | Implemented |
|-------|--------------|----------|-------------|
| `user_prompt` | ✅ Yes | ✅ Yes | ✅ Yes |
| `api_request` | ✅ Yes | ✅ Yes | ✅ Yes |
| `tool_result` | ✅ Yes | ✅ Yes | ✅ Yes |
| `tool_decision` | ✅ Yes | ✅ Yes | ✅ Yes |
| `api_error` | ✅ Yes | ✅ Yes | ✅ Yes |

### Metrics - 100% Implementation ✅

| Metric | Purpose | Frequency | Implemented |
|--------|---------|-----------|-------------|
| `cost.usage` | Track API costs | Every API call | ✅ Yes |
| `token.usage` | Track token usage | Every API call | ✅ Yes |
| `lines_of_code.count` | Track code changes | When editing files | ✅ Yes |
| `commit.count` | Track git commits | When committing | ✅ Yes |
| `session.count` | Track new sessions | Session start | ✅ Yes |
| `pull_request.count` | Track PRs created | When creating PRs | ✅ Yes |
| `code_edit_tool.decision` | Track tool permissions | User decisions | ✅ Yes |
| `active_time.total` | Track active time | Periodically | ✅ Yes |

## Real-World Examples

### Typical User Prompt Flow

1. **User Prompt Event**
   ```json
   {
     "body": "claude_code.user_prompt",
     "attributes": {
       "session.id": "abc-123",
       "prompt_length": 45
     }
   }
   ```

2. **Haiku API Request** (routing)
   ```json
   {
     "body": "claude_code.api_request",
     "attributes": {
       "model": "claude-3-haiku-20240307",
       "input_tokens": 195,
       "output_tokens": 566,
       "cost": 0.001907
     }
   }
   ```

3. **Opus API Request** (generation)
   ```json
   {
     "body": "claude_code.api_request",
     "attributes": {
       "model": "claude-3-opus-20240229",
       "input_tokens": 1026,
       "output_tokens": 2466,
       "cache_read_tokens": 10950,
       "cost": 0.22695
     }
   }
   ```

### Code Modification Example

When Claude modifies a file:
```json
{
  "name": "claude_code.lines_of_code.count",
  "sum": {
    "dataPoints": [{
      "asDouble": 10,
      "attributes": [
        { "key": "type", "value": { "stringValue": "added" } },
        { "key": "session.id", "value": { "stringValue": "abc-123" } }
      ]
    }]
  }
}
```

## Troubleshooting

### No Telemetry Received

1. Verify all 6 required environment variables are set (including OTEL_EXPORTER_OTLP_ENDPOINT)
2. Check server is running on configured endpoint
3. Ensure protocol is `http/json` not `protobuf`
4. Remember: Claude does NOT default endpoint to localhost:4318

### Only Logs, No Metrics

- Missing `OTEL_METRICS_EXPORTER=otlp`
- Missing `OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json`

### Incomplete Data

- Cache tokens often dominate (10,950 observed vs 1,026 input)
- Some metrics require specific actions (commits, PRs)
- Tool decisions may require `--dangerously-skip-permissions`

### Cost Observations

Typical costs per interaction:
- Haiku (routing): $0.001-0.002
- Opus (generation): $0.22-0.28
- Total per prompt: ~$0.23-0.30

### Performance Notes

- Multiple API calls per prompt (typically 2)
- Cache usage significantly reduces costs
- Tool execution adds to response time

