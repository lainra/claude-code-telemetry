FROM node:24-alpine

WORKDIR /app

# Update npm to latest version to fix vulnerabilities
RUN npm install -g npm@latest

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose OTLP receiver port
EXPOSE 4318

# Set default environment for Docker container
ENV OTLP_RECEIVER_HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4318/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "src/server.js"]