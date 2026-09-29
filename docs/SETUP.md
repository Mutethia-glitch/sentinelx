# SentinelX Development Setup

This document covers the repository foundation and PostgreSQL setup. Task 05 authentication runtime and Windows instructions are in `docs/AUTHENTICATION.md`.

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

## Task 04: PostgreSQL migrations

Provision PostgreSQL 16 or later on your chosen host and create a dedicated
SentinelX database. The execution workspace is not the hosting environment.
Install the PostgreSQL `psql` client on the machine running migrations.

Provide `DATABASE_URL` securely through your shell/deployment environment, or
use standard `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` and
`PGSSLMODE` variables. Use TLS settings appropriate to your database host.
`DATABASE_URL` supports PostgreSQL URLs and an optional `sslmode` query value;
other URL options are rejected rather than silently ignored. Never put a real
URL/password in committed SQL, shell scripts or documentation.

```sh
npm run db:migrate
```

The command does not read `.env` automatically. If you keep local secrets there,
load them privately into your process environment using your own tooling.
Connection strings are not passed in command-line arguments or printed in
errors. `.env` and `.env.*` remain ignored; `.env.example` is a placeholder only.

For integration checks, select a separate disposable test database through the
same environment variables, then run:

```sh
SENTINELX_TEST_DATABASE=1 npm run test:database
```

This applies/replays migrations and tests database integrity with synthetic rows
in a rolled-back transaction. The schema remains in the disposable test database.
The flag is a deliberate acknowledgement, not automatic detection of a safe
host. Do not use an operational database for this command. `npm run quality`
performs foundation and JavaScript syntax checks without requiring a database;
the database integration checks are separate and must also pass for Task 04.

See `docs/DATA_MODEL.md` for relationships, indexes, migration policy and limits.

## Task 05 authentication

Install the locked runtime dependencies using `npm ci`. Run `npm run db:migrate`
to apply `002_auth_sessions.sql`, then use the local provisioning command
`npm run auth:create-user` and start the loopback API with `npm start`.
Supply database/provisioning secrets through environment variables. The Windows
credential prompts and complete login/logout verification are documented in
`docs/AUTHENTICATION.md`; no credentials belong in source control.
