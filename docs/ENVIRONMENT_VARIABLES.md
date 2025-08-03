# Claude Code Telemetry Environment Variables Guide

This document explains all environment variables needed to configure Claude Code telemetry.

## Overview

Claude Code uses OpenTelemetry (OTLP) to send telemetry data. The telemetry includes:
- **Logs**: User prompts, API requests, tool usage, and errors
- **Metrics**: Cost tracking, token usage, code modifications, and performance data

## Required Variables

These variables MUST be set for telemetry to work:

### `CLAUDE_CODE_ENABLE_TELEMETRY=1`
- **Purpose**: Master switch that enables all telemetry
- **Required**: YES
- **Default**: Not set (telemetry disabled)
- **Note**: Without this, no telemetry will be sent regardless of other settings

### `OTEL_LOGS_EXPORTER=otlp`
- **Purpose**: Enables OTLP exporter for logs (events)
- **Required**: YES
- **Default**: Not set
- **Note**: Needed to capture user prompts, API calls, and tool usage

### `OTEL_METRICS_EXPORTER=otlp`
- **Purpose**: Enables OTLP exporter for metrics
- **Required**: YES
- **Default**: Not set
- **Note**: Needed to capture cost, token usage, and performance metrics

### `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`
- **Purpose**: Sets the OTLP protocol format
- **Required**: YES
- **Default**: May default to protobuf (which won't work)
- **Note**: MUST be `http/json` - Claude doesn't support protobuf

### `OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json`
- **Purpose**: Sets the OTLP protocol specifically for metrics
- **Required**: YES
- **Default**: May default to protobuf
- **Note**: MUST be `http/json` for metrics to work

### `OTEL_EXPORTER_OTLP_ENDPOINT`
- **Purpose**: Base endpoint for all OTLP data
- **Required**: YES (Claude Code does not provide a default)
- **Default**: None - must be explicitly set
- **Example**: `http://127.0.0.1:4318`
- **Note**: Other endpoints are derived from this if not explicitly set

## Optional Variables

These variables have sensible defaults:

### `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`
- **Purpose**: Specific endpoint for logs
- **Required**: NO
- **Default**: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`
- **Example**: `http://127.0.0.1:4318/v1/logs`
- **Note**: Only set if you need a different endpoint than the base

### `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`
- **Purpose**: Specific endpoint for metrics
- **Required**: NO
- **Default**: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`
- **Example**: `http://127.0.0.1:4318/v1/metrics`
- **Note**: Only set if you need a different endpoint than the base

### `OTEL_LOG_USER_PROMPTS`
- **Purpose**: Include full user prompt text in telemetry
- **Required**: NO
- **Default**: `1` (enabled in quickstart setup)
- **Values**: `1` to enable, unset to disable
- **Privacy Note**: When enabled, full prompt text is sent to the telemetry server
- **Note**: The quickstart script enables this by default for better observability

## Quick Start Examples

### Minimal Configuration (Recommended)
```bash
# Copy and paste this block:
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
export OTEL_LOG_USER_PROMPTS=1
```

### Full Configuration with All Options
```bash
# Required
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318

# Optional
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://127.0.0.1:4318/v1/logs
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://127.0.0.1:4318/v1/metrics
export OTEL_LOG_USER_PROMPTS=1
```

### Remote Server Configuration
```bash
# Required
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://telemetry.example.com:4318
```

## Troubleshooting

### No telemetry received
1. Check `CLAUDE_CODE_ENABLE_TELEMETRY=1` is set
2. Verify all required exporters are enabled
3. Ensure protocol is `http/json` not `protobuf`
4. Check server is running on the configured endpoint

### Only logs, no metrics
- Set `OTEL_METRICS_EXPORTER=otlp`
- Set `OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json`

### Authentication errors
- Check if your server requires API key authentication
- Set `API_KEY` environment variable on the server side

## Shell Configuration

To make these settings permanent, add them to your shell configuration:

### Bash (~/.bashrc or ~/.bash_profile)
```bash
# Claude Code Telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
export OTEL_LOG_USER_PROMPTS=1
```

### Zsh (~/.zshrc)
```bash
# Claude Code Telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
export OTEL_LOG_USER_PROMPTS=1
```

### Fish (~/.config/fish/config.fish)
```fish
# Claude Code Telemetry
set -x CLAUDE_CODE_ENABLE_TELEMETRY 1
set -x OTEL_LOGS_EXPORTER otlp
set -x OTEL_METRICS_EXPORTER otlp
set -x OTEL_EXPORTER_OTLP_PROTOCOL http/json
set -x OTEL_EXPORTER_OTLP_METRICS_PROTOCOL http/json
set -x OTEL_EXPORTER_OTLP_ENDPOINT http://127.0.0.1:4318
set -x OTEL_LOG_USER_PROMPTS 1
```

