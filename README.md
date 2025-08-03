# Claude Code Telemetry 📊

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Coverage-95.44%25-brightgreen" alt="Code Coverage">
  <img src="https://img.shields.io/badge/Docker-Required-blue" alt="Docker">
  <img src="https://img.shields.io/badge/Node.js-18+-green" alt="Node.js">
</p>

<p align="center">
  <strong>See exactly how you/your team uses Claude Code</strong><br>
  Track costs, usage patterns, and session data in real-time
</p>

---

## 🎯 What This Actually Does

Claude Code Telemetry is a lightweight bridge that captures telemetry data from Claude Code and forwards it to Langfuse for visualization. You get:

- 💰 **Cost Tracking** - See costs per session, user, and model
- 📊 **Usage Metrics** - Token counts, cache hits, and tool usage
- ⏱️ **Session Grouping** - Automatically groups work into 1-hour sessions
- 🔍 **Full Transparency** - Every API call logged with complete details
- 🔐 **Safe local data** - The packaged self-hosted Langfuse keeps your data local

The original motivation from the author was that when using Claude Code Pro/Max, it didn't have good options for telemetry out of the box compared to API-based requests that can be integrated with various solutions and wanted to provide a secure turnkey local setup for people using Claude Code to benefit from.

### 🏗️ Built on Standards
Uses **OpenTelemetry** for data collection, **Langfuse** for visualization, and **Claude's native observability** APIs. No proprietary formats, no vendor lock-in.

## 🚀 Quick Start (30 seconds)

### Prerequisites
🐳 **Docker Desktop** - [Install here](https://docker.com/products/docker-desktop) if you don't see the whale icon in your menu bar

### Setup
```bash
# Clone and enter directory
git clone https://github.com/lainra/claude-code-telemetry && cd claude-code-telemetry

# Run automated setup
./quickstart.sh

# Enable telemetry
source claude-telemetry.env

# Test it works
claude "What is 2+2?"
```

**That's it!** View your dashboard at http://localhost:3000

### Need Help?
Let Claude guide you through the setup:
```bash
claude "Set up the telemetry dashboard"
```

## 📸 What You'll See in Langfuse

### Session View
Every conversation becomes a trackable session:
```
Session: 4:32 PM - 5:15 PM (43 minutes)
├── Total Cost: $18.43
├── API Calls: 6 (2 Haiku, 4 Opus)
├── Total Tokens: 45,231 (31,450 cached)
├── Tools Used:
│   ├── Read: 23 calls
│   ├── Edit: 8 calls
│   ├── Bash: 4 calls
│   └── Grep: 2 calls
└── Cache Savings: $12.30 (40% cost reduction)
```

### Individual API Calls
Full details for every Claude interaction:
```
4:45 PM - claude-3-opus-20240229
├── Input: 12,453 tokens (8,234 from cache)
├── Output: 3,221 tokens
├── Cost: $4.87
├── Duration: 3.2s
└── Context: Feature implementation
```

### Cost Breakdown
Track spending by model and user:
```
Today's Usage:
├── Total: $67.43
├── By Model:
│   ├── Opus: $61.20 (91%)
│   └── Haiku: $6.23 (9%)
└── By User:
    ├── alex@team.com: $28.90
    ├── sarah@team.com: $22.15
    └── mike@team.com: $16.38
```

## 🔧 How It Works

```
Claude Code → OpenTelemetry → Telemetry Bridge → Langfuse
     ↓              ↓               ↓                ↓
  User asks     Sends OTLP    Parses & forwards   Shows in
  questions    telemetry data   to Langfuse       dashboard
```

The bridge:
1. Listens for OpenTelemetry data from Claude Code
2. Enriches it with session context
3. Forwards to Langfuse for visualization
4. Groups related work into analyzable sessions

## 🌟 What This Tool Is (and Isn't)

### ✅ What It Does:
- **Tracks costs** - Know exactly what you're spending
- **Shows usage patterns** - See when and how Claude is used
- **Groups work sessions** - Understand complete tasks, not just individual calls
- **Provides full transparency** - Every token and dollar accounted for
- **Runs locally** - Your data stays on your infrastructure

### ❌ What It Doesn't Do:
- **Measure productivity** - Can't tell if you're working faster
- **Analyze code quality** - Doesn't evaluate AI-generated code
- **Provide strategic insights** - Just shows raw data, not recommendations
- **Enable team collaboration** - No sharing or pattern discovery features
- **Calculate ROI** - You'll need to determine value yourself

## 🛠️ Installation Options

### Option 1: Full Stack (Recommended)
Includes Langfuse dashboard + telemetry bridge:
```bash
./quickstart.sh
```

### Option 2: Bridge Only (Manual w/NPM)
Already have Langfuse? Just run the bridge:
```bash
# Configure your existing Langfuse credentials
export LANGFUSE_PUBLIC_KEY=your-public-key
export LANGFUSE_SECRET_KEY=your-secret-key
export LANGFUSE_HOST=your-langfuse-url

# Install and start the bridge
npm install
npm start
```

### Option 3: Bridge Only (Docker)
Already have Langfuse? Run the bridge in Docker:
```bash
# Create .env file with your Langfuse credentials
cp .env.example .env
# Edit .env with your LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_HOST

# Run just the telemetry bridge container
docker compose up telemetry-bridge
```

## 📋 Requirements

- Docker Desktop ([install](https://docker.com/products/docker-desktop)) - For quickstart
- Claude Code CLI (`claude`)
- Node.js 18+ (optional) - For bridge-only mode

## 🎛️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `SESSION_TIMEOUT` | 1 hour | Groups related work into sessions |
| `OTLP_RECEIVER_PORT` | 4318 | OpenTelemetry standard port |
| `LANGFUSE_HOST` | http://localhost:3000 | Langfuse dashboard URL |
| `LOG_LEVEL` | info | Logging verbosity |

See `.env.example` for all options.

## 🔒 Privacy & Security

- **100% Local** - No external services unless you configure them
- **No Code Storage** - Only metadata about interactions
- **You Control the Data** - Runs on your infrastructure
- **Optional Prompt Logging** - Choose whether to log prompts

## 📚 Documentation

- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md) - Complete configuration guide
- [Telemetry Guide](docs/TELEMETRY_GUIDE.md) - Understanding the data format

## 🤔 Should You Use This?

**Use this if you want to:**
- Track Claude Code costs across your team
- Understand usage patterns and peak times  
- Have transparency into AI tool spending
- Keep telemetry data on your own infrastructure

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Simple, honest telemetry for Claude Code</strong><br>
  <em>100% AI-assisted repository, made with ❤️ by Claude and <a href="https://github.com/lainra">@lainra</a></em><br><br>
  <a href="https://github.com/lainra/claude-code-telemetry/issues">Report Issue</a> · 
  <a href="https://github.com/lainra/claude-code-telemetry/pulls">Submit PR</a>
</p>
