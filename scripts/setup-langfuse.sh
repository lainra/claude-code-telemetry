#!/bin/bash

# Claude Code Telemetry - Official Langfuse Setup Script
# Uses the official Langfuse docker-compose with our telemetry bridge

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ASCII Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║    🤖 Claude Code Telemetry + Official Langfuse Setup 🤖          ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if langfuse-official exists
if [ ! -d "langfuse-official" ]; then
    echo -e "${YELLOW}⚠️  Langfuse repository not found. Cloning...${NC}"
    git clone https://github.com/langfuse/langfuse.git langfuse-official
fi

# Create .env file for Langfuse (always regenerate for unique credentials)
echo -e "${BLUE}📝 Creating Langfuse configuration with unique credentials...${NC}"

# Generate unique IDs and keys
ORG_ID="org-$(openssl rand -hex 6)"
PROJECT_ID="proj-$(openssl rand -hex 6)"
PUBLIC_KEY="pk-lf-$(openssl rand -hex 16)"
SECRET_KEY="sk-lf-$(openssl rand -hex 16)"

# Use hostname and timestamp for unique email
UNIQUE_SUFFIX="$(hostname | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')-$(date +%s)"
USER_EMAIL="admin-${UNIQUE_SUFFIX}@claude-telemetry.local"

# Generate a secure password
USER_PASSWORD="$(openssl rand -base64 12)"

cat > .env.langfuse <<EOF
# Langfuse Headless Init Configuration
LANGFUSE_INIT_ORG_ID=${ORG_ID}
LANGFUSE_INIT_ORG_NAME=my-organization
LANGFUSE_INIT_PROJECT_ID=${PROJECT_ID}
LANGFUSE_INIT_PROJECT_NAME=claude-code-telemetry
LANGFUSE_INIT_PROJECT_PUBLIC_KEY=${PUBLIC_KEY}
LANGFUSE_INIT_PROJECT_SECRET_KEY=${SECRET_KEY}
LANGFUSE_INIT_USER_EMAIL=${USER_EMAIL}
LANGFUSE_INIT_USER_NAME=Admin User
LANGFUSE_INIT_USER_PASSWORD=${USER_PASSWORD}

# Telemetry Bridge Config
LOG_LEVEL=info
SESSION_TIMEOUT=3600000
MAX_REQUEST_SIZE=10485760
EOF
echo -e "${GREEN}✅ Created .env.langfuse with unique configuration${NC}"

# Save credentials to a file for user reference
cat > langfuse-credentials.txt <<EOF
🔐 LANGFUSE CREDENTIALS - SAVE THIS FILE!
Generated: $(date)

Login URL: http://localhost:3000
Email: ${USER_EMAIL}
Password: ${USER_PASSWORD}

API Keys:
Public Key: ${PUBLIC_KEY}
Secret Key: ${SECRET_KEY}

Organization ID: ${ORG_ID}
Project ID: ${PROJECT_ID}
EOF

echo -e "${YELLOW}📋 Credentials saved to: langfuse-credentials.txt${NC}"

# Load the configuration
export $(grep -v '^#' .env.langfuse | xargs)

echo -e "${BLUE}📋 This will start the following services:${NC}"
echo "  • Official Langfuse Stack (web, worker, postgres, clickhouse, redis, minio)"
echo "  • claude-code-telemetry Bridge (OTLP receiver)"
echo ""
echo -e "${YELLOW}⚠️  Resource Requirements:${NC}"
echo "  • ~3GB RAM"
echo "  • ~2GB disk space"
echo "  • Ports: 3000 (Langfuse), 4318 (Telemetry), 9090 (MinIO)"
echo ""

# Confirm with user
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}🚀 Starting services...${NC}"

# Unset OTEL variables that might interfere with Docker
unset OTEL_LOGS_EXPORTER OTEL_METRICS_EXPORTER OTEL_EXPORTER_OTLP_PROTOCOL
unset OTEL_EXPORTER_OTLP_ENDPOINT OTEL_EXPORTER_OTLP_METRICS_PROTOCOL
unset OTEL_EXPORTER_OTLP_LOGS_ENDPOINT OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
unset OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE OTEL_LOG_USER_PROMPTS
unset CLAUDE_CODE_ENABLE_TELEMETRY

# Start services using both compose files
docker compose \
    -f langfuse-official/docker-compose.yml \
    -f docker-compose.langfuse.yml \
    --env-file .env.langfuse \
    up -d

echo ""
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
echo -n "Starting"

# Wait for Langfuse to be healthy
TIMEOUT=180
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo ""
        break
    fi
    echo -n "."
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo ""
    echo -e "${RED}❌ Services failed to start within timeout.${NC}"
    echo "Check logs with: docker compose -f langfuse-official/docker-compose.yml -f docker-compose.langfuse.yml logs"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All services are running!${NC}"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}🌐 Access Points:${NC}"
echo ""
echo "  Langfuse UI:    http://localhost:3000"
echo "  Telemetry:      http://localhost:4318"
echo "  MinIO Console:  http://localhost:9091"
echo ""
echo -e "${BLUE}🔑 Langfuse Login:${NC}"
echo ""
echo "  Email:          ${LANGFUSE_INIT_USER_EMAIL}"
echo "  Password:       ${LANGFUSE_INIT_USER_PASSWORD}"
echo ""
echo -e "${BLUE}🔐 API Keys:${NC}"
echo ""
echo "  Public Key:     ${LANGFUSE_INIT_PROJECT_PUBLIC_KEY}"
echo "  Secret Key:     ${LANGFUSE_INIT_PROJECT_SECRET_KEY}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Save these API keys! Change the default password!${NC}"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}🤖 Configure Claude Code:${NC}"
echo ""
echo "Run these commands in your terminal:"
echo ""
echo -e "${GREEN}export CLAUDE_CODE_ENABLE_TELEMETRY=1"
echo "export OTEL_LOGS_EXPORTER=otlp"
echo "export OTEL_METRICS_EXPORTER=otlp"
echo "export OTEL_EXPORTER_OTLP_PROTOCOL=http/json"
echo "export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/json"
echo "export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318"
echo -e "export OTEL_LOG_USER_PROMPTS=1${NC}"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}📊 View Logs:${NC}"
echo ""
echo "  All services:   docker compose -f langfuse-official/docker-compose.yml -f docker-compose.langfuse.yml logs -f"
echo "  Langfuse only:  docker compose -f langfuse-official/docker-compose.yml -f docker-compose.langfuse.yml logs -f langfuse-web"
echo "  Bridge only:    docker compose -f langfuse-official/docker-compose.yml -f docker-compose.langfuse.yml logs -f telemetry-bridge"
echo ""
echo -e "${BLUE}🛑 Stop Everything:${NC}"
echo ""
echo "  docker compose -f langfuse-official/docker-compose.yml -f docker-compose.langfuse.yml down"
echo ""
echo "════════════════════════════════════════════════════════════════"

