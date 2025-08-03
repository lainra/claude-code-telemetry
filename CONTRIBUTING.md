# Contributing to Claude Code Telemetry

Thank you for your interest in contributing to Claude Code Telemetry! This document provides guidelines for contributing to the project.

## Documentation Structure

This project maintains two distinct documentation files for different audiences:

### CLAUDE.md (User Documentation)
- **Purpose**: Guide non-technical users through setup and usage
- **Audience**: End users who want to track their Claude Code usage
- **Content**: Step-by-step instructions, troubleshooting, visual guides
- **Style**: Conversational, friendly, assumes no technical knowledge
- **Note**: This file is automatically read by Claude when users ask for help

### DEVELOPMENT.md (Developer Documentation)
- **Purpose**: Technical guide for contributors and developers
- **Audience**: Engineers working on or with the codebase
- **Content**: Architecture, APIs, implementation details, debugging info
- **Style**: Technical, precise, assumes programming knowledge
- **Topics**: OTLP implementation, Langfuse integration, session management

When contributing, please maintain this distinction and update the appropriate documentation.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/claude-code-telemetry.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run integration tests
npm run test:integration
```

## Testing

Before submitting a PR, ensure all tests pass:

```bash
# Unit tests
npm test

# Integration tests with Claude
./test.sh

# Linting
npm run lint

# Formatting
npm run format
```

## Pull Request Process

1. Update documentation for any new features
2. Add tests for new functionality
3. Ensure all tests pass
4. Update the README.md if needed
5. Submit a pull request with a clear description

## Code Style

- Use ES6+ features
- Follow the existing code style
- Add JSDoc comments for public functions
- Keep functions small and focused

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include steps to reproduce for bugs
- Provide context and use cases for feature requests

## Code of Conduct

Please be respectful and professional in all interactions. We aim to maintain a welcoming and inclusive community.

