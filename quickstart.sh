#!/bin/bash

# Claude Code Telemetry - Ultra Quick Start
# One command to rule them all!

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Claude Code Telemetry - 30 Second Setup${NC}"
echo ""

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Auto-accept and run setup
echo "y" | ./scripts/setup-langfuse.sh

# Generate config file for Claude
cat > claude-telemetry.env <<EOF
# Add this to your shell profile (.bashrc, .zshrc, etc) or run before using Claude
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
export OTEL_LOG_USER_PROMPTS=1
EOF


echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}Quick Start Commands:${NC}"
echo ""
echo "1. Configure Claude (run this in your terminal):"
echo -e "${GREEN}   source claude-telemetry.env${NC}"
echo ""
echo "2. Test it:"
echo -e "${GREEN}   claude \"What is 2+2?\"${NC}"
echo ""
echo "3. View your data:"
echo -e "${GREEN}   open http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}📋 Your unique login credentials have been saved to:${NC}"
echo -e "${GREEN}   langfuse-credentials.txt${NC}"
echo ""
echo -e "${BLUE}That's it! Your telemetry is now being tracked.${NC}"