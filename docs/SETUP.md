# SentinelX Development Setup

This document covers the repository foundation only. Application dependencies and runtime commands will be expanded by the task that introduces them.

## Prerequisites

- Git
- Node.js 20 or later and npm
- PostgreSQL for the database work beginning in Task 04

No Supabase or Firebase service is required or approved for SentinelX.

## Local setup

1. Clone the repository.
2. Copy `.env.example` to `.env`.
3. Replace placeholder values with local development values.
4. Never commit `.env` or real credentials.
5. Run `npm run quality` to execute the repository foundation checks.

At the current foundation stage there is intentionally no application server to start. Later tasks will add runtime dependencies and commands when the corresponding implementation exists.

## Repository structure

- `docs/` — approved specification, architecture, requirements, testing and development documentation.
- `tasks/` — numbered implementation contracts; complete them in order.
- `scripts/` — repository-level quality checks.
- `.env.example` — non-secret environment-variable template.

## Development rules

Read `README.md`, `docs/IMPLEMENTATION_ORDER.md`, and the current task contract before making changes. Do not implement later tasks early.

PostgreSQL is the approved database. Secrets belong in environment variables. Security testing must use synthetic data or explicitly authorized environments.
