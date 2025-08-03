#!/bin/bash

# Cleanup script for Langfuse setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  This will remove the Langfuse setup and all data!${NC}"
echo ""
read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}🧹 Cleaning up Langfuse setup...${NC}"

# Stop and remove containers
if docker compose -f langfuse-official/docker-compose.yml -f docker-compose.langfuse.yml ps -q 2>/dev/null | grep -q .; then
    echo "Stopping services..."
    docker compose -f langfuse-official/docker-compose.yml -f docker-compose.langfuse.yml down -v
fi

# Remove cloned repository
if [ -d "langfuse-official" ]; then
    echo "Removing Langfuse repository..."
    rm -rf langfuse-official
fi

# Remove configuration file
if [ -f ".env.langfuse" ]; then
    echo "Removing configuration file..."
    rm -f .env.langfuse
fi

echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo ""
echo "To set up Langfuse again, run: ./scripts/setup-langfuse.sh"