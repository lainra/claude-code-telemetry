# Security Policy

## Supported Versions

Currently supporting:

| Version | Supported          |
| ------- | ------------------ |
| 3.0.x   | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. Please report security issues privately to maintain the safety of all users.

### How to Report

1. **DO NOT** open a public issue for security vulnerabilities
2. Email security concerns to: lainra@users.noreply.github.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Resolution Timeline**: Depends on severity
  - Critical: 7-14 days
  - High: 14-30 days
  - Medium/Low: 30-60 days

### Security Measures

This project implements:
- No storage of sensitive data (prompts optional)
- Local-only operation by default
- Secure credential handling via environment variables
- Input validation and sanitization
- Request size limits to prevent DoS

## Disclosure Policy

- Security patches will be released as soon as possible
- Public disclosure will occur after patches are available
- Credit will be given to reporters (unless anonymity requested)

Thank you for helping keep Claude Code Telemetry secure!